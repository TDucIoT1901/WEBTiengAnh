/**
 * VocabDaily - Daily Vocabulary Tracker
 * Author: Antigravity Pair Programmer
 */

// API HELPER FUNCTIONS
function getAuthHeaders() {
  const token = localStorage.getItem('vocabdaily_token');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

async function apiRequest(url, options = {}) {
  const headers = getAuthHeaders();
  const response = await fetch(url, { ...options, headers });
  if (response.status === 401) {
    localStorage.removeItem('vocabdaily_token');
    localStorage.removeItem('vocabdaily_user');
    window.location.href = '/login.html';
    return null;
  }
  return response;
}

// STATE MANAGEMENT
let vocabState = {
  items: [],
  activeTab: 'timelineTab',
  searchQuery: '',
  filterDate: '',
  filterTag: 'all',
  filterStatus: 'all',
  quickDaysFilter: 'all',
  // Flashcard state
  fcDeck: [],
  fcIndex: 0,
  fcIsFlipped: false,
  // AI Tutor state
  chatHistory: [],
  currentScenario: 'daily',
  currentLevel: 'intermediate',
  aiActivePanel: 'writingPanel',
  isAIProcessing: false
};

// HELPER DATE UTILS
function getTodayString() {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

function getOffsetDateString(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return '';
  const today = getTodayString();
  const yesterday = getOffsetDateString(-1);

  const [year, month, day] = dateStr.split('-');
  const formattedDate = `${day}/${month}/${year}`;

  if (dateStr === today) {
    return `Hôm nay - ${formattedDate}`;
  } else if (dateStr === yesterday) {
    return `Hôm qua - ${formattedDate}`;
  }
  return `Ngày ${formattedDate}`;
}

// STORAGE LOAD / SAVE
async function loadVocabData() {
  try {
    const response = await apiRequest('/api/vocab');
    if (!response) return;
    if (response.ok) {
      vocabState.items = await response.json();
    } else {
      vocabState.items = [];
    }
  } catch (e) {
    console.error('Error loading vocab data:', e);
    vocabState.items = [];
  }
}

function saveVocabData() {
  updateHeaderStats();
  renderCurrentView();
}

// SPEECH AUDIO SYNTHESIS
function speakWord(word) {
  if (!word) return;
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel(); // Stop any active speech
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
    showToast(`🔊 Đang phát âm: "${word}"`, 'info');
  } else {
    showToast('Trình duyệt của bạn không hỗ trợ phát âm tự động.', 'warning');
  }
}

// TOAST NOTIFICATIONS
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let iconClass = 'fa-circle-info';
  if (type === 'success') iconClass = 'fa-circle-check';
  if (type === 'warning') iconClass = 'fa-triangle-exclamation';

  toast.innerHTML = `<i class="fa-solid ${iconClass}"></i> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// INITIALIZATION & EVENT LISTENERS
document.addEventListener('DOMContentLoaded', async () => {
  // Check authentication
  const token = localStorage.getItem('vocabdaily_token');
  if (!token) {
    window.location.href = '/login.html';
    return;
  }

  await loadVocabData();
  initEventListeners();
  updateHeaderStats();
  renderTimelineFeed();
  populateTagFilterSelect();

  // Load user info for header display
  try {
    const res = await apiRequest('/api/auth/me');
    if (res && res.ok) {
      const userData = await res.json();
      const userNameEl = document.getElementById('userName');
      if (userNameEl) userNameEl.textContent = userData.username || 'User';
    }
  } catch(e) {
    console.error('Error fetching user:', e);
  }
});

function logout() {
  localStorage.removeItem('vocabdaily_token');
  localStorage.removeItem('vocabdaily_user');
  window.location.href = '/login.html';
}

function initEventListeners() {
  // Navigation Tabs
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));

      btn.classList.add('active');
      const tabId = btn.getAttribute('data-tab');
      document.getElementById(tabId).classList.add('active');
      vocabState.activeTab = tabId;

      if (tabId === 'flashcardTab') {
        initFlashcardDeck();
      } else if (tabId === 'statsTab') {
        renderStatsPage();
      } else if (tabId === 'aiTutorTab') {
        updateApiKeyBanner();
      } else {
        renderTimelineFeed();
      }
    });
  });

  // Modal Open / Close
  const modal = document.getElementById('vocabModal');
  document.getElementById('openAddModalBtn').addEventListener('click', () => openVocabModal());
  document.getElementById('closeVocabModalBtn').addEventListener('click', () => closeVocabModal());
  document.getElementById('cancelVocabModalBtn').addEventListener('click', () => closeVocabModal());

  // Quick Date Buttons in Form
  document.getElementById('setTodayBtn').addEventListener('click', () => {
    document.getElementById('vocabDateInput').value = getTodayString();
  });
  document.getElementById('setYesterdayBtn').addEventListener('click', () => {
    document.getElementById('vocabDateInput').value = getOffsetDateString(-1);
  });

  // Form Submit
  document.getElementById('vocabForm').addEventListener('submit', handleVocabFormSubmit);

  // Search Input Live
  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');

  searchInput.addEventListener('input', (e) => {
    vocabState.searchQuery = e.target.value.trim().toLowerCase();
    if (vocabState.searchQuery) {
      clearSearchBtn.classList.remove('hidden');
    } else {
      clearSearchBtn.classList.add('hidden');
    }
    renderTimelineFeed();
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    vocabState.searchQuery = '';
    clearSearchBtn.classList.add('hidden');
    renderTimelineFeed();
  });

  // Date Filter & Clear Date
  const filterDateInput = document.getElementById('filterDateInput');
  filterDateInput.addEventListener('change', (e) => {
    vocabState.filterDate = e.target.value;
    renderTimelineFeed();
  });

  document.getElementById('clearDateBtn').addEventListener('click', () => {
    filterDateInput.value = '';
    vocabState.filterDate = '';
    vocabState.quickDaysFilter = 'all';
    updateQuickDaysChips();
    renderTimelineFeed();
  });

  // Quick Days Chips
  document.querySelectorAll('.day-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.day-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      vocabState.quickDaysFilter = chip.getAttribute('data-days');
      renderTimelineFeed();
    });
  });

  // Tag & Status Select Filters
  document.getElementById('filterTagSelect').addEventListener('change', (e) => {
    vocabState.filterTag = e.target.value;
    renderTimelineFeed();
  });

  document.getElementById('filterStatusSelect').addEventListener('change', (e) => {
    vocabState.filterStatus = e.target.value;
    renderTimelineFeed();
  });

  // Data Backup / Restore Modal
  const dataModal = document.getElementById('dataModal');
  document.getElementById('openDataModalBtn').addEventListener('click', () => dataModal.classList.remove('hidden'));
  document.getElementById('closeDataModalBtn').addEventListener('click', () => dataModal.classList.add('hidden'));

  document.getElementById('exportDataBtn').addEventListener('click', exportJSONData);
  document.getElementById('importDataBtn').addEventListener('click', () => document.getElementById('importFileInput').click());
  document.getElementById('importFileInput').addEventListener('change', importJSONData);

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }

  // Flashcard Deck Interactions
  const card3d = document.getElementById('card3d');
  card3d.addEventListener('click', (e) => {
    // Prevent flip if audio button clicked
    if (e.target.closest('#fcFrontAudioBtn')) return;
    card3d.classList.toggle('flipped');
    vocabState.fcIsFlipped = card3d.classList.contains('flipped');
  });

  document.getElementById('fcFrontAudioBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    const currentCard = vocabState.fcDeck[vocabState.fcIndex];
    if (currentCard) speakWord(currentCard.word);
  });

  document.getElementById('fcFilterSelect').addEventListener('change', initFlashcardDeck);
  document.getElementById('restartFcBtn').addEventListener('click', initFlashcardDeck);
  document.getElementById('fcRestartCompleteBtn').addEventListener('click', initFlashcardDeck);

  document.getElementById('fcBtnHard').addEventListener('click', () => rateFlashcard('new'));
  document.getElementById('fcBtnGood').addEventListener('click', () => rateFlashcard('reviewing'));
  document.getElementById('fcBtnEasy').addEventListener('click', () => rateFlashcard('mastered'));

  // AI Tutor Listeners
  initAITutorListeners();
}

function updateQuickDaysChips() {
  document.querySelectorAll('.day-chip').forEach(c => {
    c.classList.toggle('active', c.getAttribute('data-days') === vocabState.quickDaysFilter);
  });
}

function renderCurrentView() {
  if (vocabState.activeTab === 'timelineTab') renderTimelineFeed();
  if (vocabState.activeTab === 'flashcardTab') initFlashcardDeck();
  if (vocabState.activeTab === 'statsTab') renderStatsPage();
  if (vocabState.activeTab === 'aiTutorTab') updateApiKeyBanner();
}

// HEADER STATS & STREAK CALCULATOR
function updateHeaderStats() {
  const total = vocabState.items.length;
  document.getElementById('totalVocabCount').textContent = total;

  // Calculate Streak: consecutive active days with entries leading up to today or yesterday
  const streak = calculateStreak();
  document.getElementById('streakCount').textContent = streak;
}

function calculateStreak() {
  if (vocabState.items.length === 0) return 0;

  // Extract unique sorted dates descending
  const dates = [...new Set(vocabState.items.map(item => item.date))].sort().reverse();
  const today = getTodayString();
  const yesterday = getOffsetDateString(-1);

  if (!dates.includes(today) && !dates.includes(yesterday)) {
    return 0; // Streak broken if no entry today or yesterday
  }

  let streak = 0;
  let checkDate = new Date();
  
  // If today has no entry yet, start checking from yesterday
  if (!dates.includes(today)) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  while (true) {
    const dateStr = checkDate.toISOString().split('T')[0];
    if (dates.includes(dateStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

// TIMELINE FEED RENDERER
function renderTimelineFeed() {
  const container = document.getElementById('vocabFeedContainer');
  let filtered = [...vocabState.items];

  // 1. Search Query Filter
  if (vocabState.searchQuery) {
    const q = vocabState.searchQuery;
    filtered = filtered.filter(item => 
      item.word.toLowerCase().includes(q) ||
      (item.phonetic && item.phonetic.toLowerCase().includes(q)) ||
      item.meaning.toLowerCase().includes(q) ||
      (item.example && item.example.toLowerCase().includes(q)) ||
      item.tags.some(t => t.toLowerCase().includes(q))
    );
  }

  // 2. Specific Date Picker Filter
  if (vocabState.filterDate) {
    filtered = filtered.filter(item => item.date === vocabState.filterDate);
  }

  // 3. Quick Days Chip Filter
  if (vocabState.quickDaysFilter !== 'all') {
    const today = getTodayString();
    const yesterday = getOffsetDateString(-1);

    if (vocabState.quickDaysFilter === 'today') {
      filtered = filtered.filter(item => item.date === today);
    } else if (vocabState.quickDaysFilter === 'yesterday') {
      filtered = filtered.filter(item => item.date === yesterday);
    } else if (vocabState.quickDaysFilter === 'week') {
      const sevenDaysAgo = getOffsetDateString(-7);
      filtered = filtered.filter(item => item.date >= sevenDaysAgo);
    }
  }

  // 4. Tag Filter
  if (vocabState.filterTag !== 'all') {
    filtered = filtered.filter(item => item.tags.includes(vocabState.filterTag));
  }

  // 5. Status Filter
  if (vocabState.filterStatus !== 'all') {
    filtered = filtered.filter(item => item.status === vocabState.filterStatus);
  }

  // Update Result Summary Text
  document.getElementById('resultCountText').textContent = `Đang hiển thị ${filtered.length} từ vựng`;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-feed glass-panel">
        <i class="fa-solid fa-folder-open empty-icon"></i>
        <h3>Không tìm thấy từ vựng nào</h3>
        <p>Thử thay đổi bộ lọc hoặc thêm từ vựng mới cho ngày hôm nay nhé!</p>
        <button class="btn btn-primary" onclick="openVocabModal()"><i class="fa-solid fa-plus"></i> Thêm từ mới ngay</button>
      </div>
    `;
    return;
  }

  // Group items by Date descending
  const groupedByDate = {};
  filtered.forEach(item => {
    if (!groupedByDate[item.date]) {
      groupedByDate[item.date] = [];
    }
    groupedByDate[item.date].push(item);
  });

  const sortedDates = Object.keys(groupedByDate).sort().reverse();

  let html = '';
  sortedDates.forEach(dateStr => {
    const dateItems = groupedByDate[dateStr];
    const displayDate = formatDateDisplay(dateStr);

    html += `
      <div class="date-group">
        <div class="date-header">
          <div class="date-badge">
            <i class="fa-regular fa-calendar-check"></i> ${displayDate}
          </div>
          <span class="date-count">(${dateItems.length} từ vựng)</span>
        </div>

        <div class="vocab-grid">
          ${dateItems.map(item => createVocabCardHTML(item)).join('')}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function createVocabCardHTML(item) {
  // Highlight search term in example if searching
  let exampleHTML = item.example || '';
  if (exampleHTML && item.word) {
    const regex = new RegExp(`(${item.word})`, 'gi');
    exampleHTML = exampleHTML.replace(regex, '<mark>$1</mark>');
  }

  const tagsHTML = item.tags.map(t => `<span class="tag-badge">#${t}</span>`).join('');

  return `
    <div class="vocab-card glass-panel" data-id="${item.id}">
      <div class="card-top">
        <div class="word-heading">
          <h3 class="word-text">${escapeHTML(item.word)}</h3>
          ${item.phonetic ? `<span class="word-phonetic">${escapeHTML(item.phonetic)}</span>` : ''}
          <span class="type-tag">${escapeHTML(item.type || 'other')}</span>
        </div>
        <button class="audio-btn" onclick="speakWord('${escapeJS(item.word)}')" title="Nghe phát âm">
          <i class="fa-solid fa-volume-high"></i>
        </button>
      </div>

      <div class="meaning-text">
        ${escapeHTML(item.meaning)}
      </div>

      ${item.example ? `
        <div class="example-box">
          <i class="fa-solid fa-quote-left"></i> ${exampleHTML}
        </div>
      ` : ''}

      ${tagsHTML ? `<div class="card-tags">${tagsHTML}</div>` : ''}

      <div class="card-bottom">
        <div class="status-select-wrapper">
          <select class="status-${item.status}" onchange="changeVocabStatus('${item.id}', this.value)">
            <option value="new" ${item.status === 'new' ? 'selected' : ''}>🆕 Mới học</option>
            <option value="reviewing" ${item.status === 'reviewing' ? 'selected' : ''}>🔄 Đang ôn</option>
            <option value="mastered" ${item.status === 'mastered' ? 'selected' : ''}>✅ Thành thạo</option>
          </select>
        </div>

        <div class="card-actions">
          <button class="icon-action-btn" onclick="openVocabModal('${item.id}')" title="Chỉnh sửa">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="icon-action-btn delete-btn" onclick="deleteVocab('${item.id}')" title="Xóa từ">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
    </div>
  `;
}

function populateTagFilterSelect() {
  const select = document.getElementById('filterTagSelect');
  const allTags = new Set();
  vocabState.items.forEach(item => {
    item.tags.forEach(t => allTags.add(t));
  });

  let options = '<option value="all">Tất cả chủ đề</option>';
  allTags.forEach(tag => {
    options += `<option value="${escapeHTML(tag)}"># ${escapeHTML(tag)}</option>`;
  });
  select.innerHTML = options;
}

// FORM MODAL HANDLERS
function openVocabModal(editId = null) {
  const modal = document.getElementById('vocabModal');
  const form = document.getElementById('vocabForm');
  const modalTitle = document.getElementById('modalTitle');

  form.reset();

  if (editId) {
    const item = vocabState.items.find(i => i.id === editId);
    if (item) {
      modalTitle.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Chỉnh Sửa Từ Vựng';
      document.getElementById('vocabIdInput').value = item.id;
      document.getElementById('vocabDateInput').value = item.date;
      document.getElementById('vocabTypeInput').value = item.type || 'noun';
      document.getElementById('vocabWordInput').value = item.word;
      document.getElementById('vocabPhoneticInput').value = item.phonetic || '';
      document.getElementById('vocabMeaningInput').value = item.meaning;
      document.getElementById('vocabExampleInput').value = item.example || '';
      document.getElementById('vocabTagInput').value = item.tags.join(', ');
      document.getElementById('vocabStatusInput').value = item.status || 'new';
    }
  } else {
    modalTitle.innerHTML = '<i class="fa-solid fa-square-plus"></i> Thêm Từ Vựng Theo Ngày';
    document.getElementById('vocabIdInput').value = '';
    document.getElementById('vocabDateInput').value = getTodayString();
  }

  modal.classList.remove('hidden');
}

function closeVocabModal() {
  document.getElementById('vocabModal').classList.add('hidden');
}

async function handleVocabFormSubmit(e) {
  e.preventDefault();

  const id = document.getElementById('vocabIdInput').value;
  const date = document.getElementById('vocabDateInput').value;
  const word = document.getElementById('vocabWordInput').value.trim();
  const phonetic = document.getElementById('vocabPhoneticInput').value.trim();
  const type = document.getElementById('vocabTypeInput').value;
  const meaning = document.getElementById('vocabMeaningInput').value.trim();
  const example = document.getElementById('vocabExampleInput').value.trim();
  const status = document.getElementById('vocabStatusInput').value;

  const rawTags = document.getElementById('vocabTagInput').value;
  const tags = rawTags.split(',').map(t => t.trim()).filter(t => t.length > 0);

  if (!word || !meaning || !date) {
    showToast('Vui lòng điền đầy đủ Ngày, Từ vựng và Nghĩa!', 'warning');
    return;
  }

  try {
    if (id) {
      // Edit existing item
      const response = await apiRequest(`/api/vocab/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ date, word, phonetic, type, meaning, example, tags, status })
      });

      if (response && response.ok) {
        await loadVocabData();
        showToast(`Đã cập nhật từ "${word}"`, 'success');
      } else {
        const errData = response ? await response.json().catch(() => ({})) : {};
        showToast(errData.error || 'Lỗi khi cập nhật từ vựng!', 'warning');
        return;
      }
    } else {
      // Add new item
      const response = await apiRequest('/api/vocab', {
        method: 'POST',
        body: JSON.stringify({ word, meaning, phonetic, type, example, tags, status, date })
      });

      if (response && response.ok) {
        await loadVocabData();
        showToast(`Đã thêm từ mới "${word}"`, 'success');
      } else {
        const errData = response ? await response.json().catch(() => ({})) : {};
        showToast(errData.error || 'Lỗi khi thêm từ vựng!', 'warning');
        return;
      }
    }

    saveVocabData();
    populateTagFilterSelect();
    closeVocabModal();
  } catch (error) {
    console.error('Vocab submit error:', error);
    showToast('Đã xảy ra lỗi: ' + error.message, 'warning');
  }
}

async function changeVocabStatus(id, newStatus) {
  const item = vocabState.items.find(i => i.id === id);
  if (item) {
    item.status = newStatus;
    
    await apiRequest(`/api/vocab/${item.id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: item.status, review_count: item.review_count, last_reviewed: item.last_reviewed })
    });
    
    saveVocabData();
    showToast(`Đã đổi trạng thái từ "${item.word}"`, 'info');
  }
}

async function deleteVocab(id) {
  const item = vocabState.items.find(i => i.id === id);
  if (!item) return;

  if (confirm(`Bạn có chắc muốn xóa từ "${item.word}"?`)) {
    await apiRequest(`/api/vocab/${item.id}`, { method: 'DELETE' });
    vocabState.items = vocabState.items.filter(i => i.id !== id);
    saveVocabData();
    populateTagFilterSelect();
    showToast(`Đã xóa từ "${item.word}"`, 'warning');
  }
}

// FLASHCARD DECK SYSTEM
function initFlashcardDeck() {
  const filter = document.getElementById('fcFilterSelect').value;
  let items = [...vocabState.items];

  if (filter === 'due') {
    items = items.filter(i => i.status === 'new' || i.status === 'reviewing');
  } else if (filter === 'today') {
    const today = getTodayString();
    items = items.filter(i => i.date === today);
  } else if (filter === 'new') {
    items = items.filter(i => i.status === 'new');
  }

  // Shuffle deck
  vocabState.fcDeck = items.sort(() => Math.random() - 0.5);
  vocabState.fcIndex = 0;
  vocabState.fcIsFlipped = false;

  document.getElementById('fcCompleteScreen').classList.add('hidden');
  document.getElementById('flashcardDeck').classList.remove('hidden');

  if (vocabState.fcDeck.length === 0) {
    document.getElementById('flashcardDeck').innerHTML = `
      <div class="empty-feed glass-panel" style="width: 100%;">
        <i class="fa-solid fa-clone empty-icon"></i>
        <h3>Bộ ôn tập trống</h3>
        <p>Không tìm thấy từ vựng phù hợp với bộ lọc hiện tại.</p>
      </div>
    `;
    return;
  }

  renderFlashcardCard();
}

function renderFlashcardCard() {
  const deck = vocabState.fcDeck;
  const index = vocabState.fcIndex;
  const total = deck.length;

  if (index >= total) {
    // Complete Deck
    document.getElementById('flashcardDeck').classList.add('hidden');
    document.getElementById('fcCompleteScreen').classList.remove('hidden');
    return;
  }

  const item = deck[index];

  // Reset 3D Flip state
  const card3d = document.getElementById('card3d');
  card3d.classList.remove('flipped');
  vocabState.fcIsFlipped = false;

  // Update Progress
  const percent = Math.round(((index + 1) / total) * 100);
  document.getElementById('fcProgressFill').style.width = `${percent}%`;
  document.getElementById('fcCounter').textContent = `Thẻ ${index + 1} / ${total}`;

  // Front Content
  document.getElementById('fcType').textContent = item.type || 'word';
  document.getElementById('fcWord').textContent = item.word;
  document.getElementById('fcPhonetics').textContent = item.phonetic || '';

  // Back Content
  document.getElementById('fcMeaning').textContent = item.meaning;
  document.getElementById('fcExample').textContent = item.example || 'Chưa có câu ví dụ.';
  document.getElementById('fcDate').textContent = `Đã học ngày: ${formatDateDisplay(item.date)}`;

  const tagsContainer = document.getElementById('fcTags');
  tagsContainer.innerHTML = item.tags.map(t => `<span class="tag-badge">#${t}</span>`).join('');
}

async function rateFlashcard(newStatus) {
  const item = vocabState.fcDeck[vocabState.fcIndex];
  if (!item) return;

  // Update item status in global list
  await changeVocabStatus(item.id, newStatus);

  // Advance to next card
  vocabState.fcIndex++;
  renderFlashcardCard();
}

// STATS PAGE RENDERER
function renderStatsPage() {
  const total = vocabState.items.length;
  const streak = calculateStreak();
  const mastered = vocabState.items.filter(i => i.status === 'mastered').length;
  const reviewing = vocabState.items.filter(i => i.status === 'reviewing').length;
  const newCount = vocabState.items.filter(i => i.status === 'new').length;

  const activeDates = new Set(vocabState.items.map(i => i.date)).size;

  document.getElementById('statsTotalWords').textContent = total;
  document.getElementById('statsStreak').textContent = streak;
  document.getElementById('statsMastered').textContent = mastered;
  document.getElementById('statsActiveDays').textContent = activeDates;

  // Progress Bar Percentages
  const getPct = (val) => total > 0 ? Math.round((val / total) * 100) : 0;

  document.getElementById('pbarNewCount').textContent = `${newCount} từ (${getPct(newCount)}%)`;
  document.getElementById('pbarNewFill').style.width = `${getPct(newCount)}%`;

  document.getElementById('pbarReviewCount').textContent = `${reviewing} từ (${getPct(reviewing)}%)`;
  document.getElementById('pbarReviewFill').style.width = `${getPct(reviewing)}%`;

  document.getElementById('pbarMasteredCount').textContent = `${mastered} từ (${getPct(mastered)}%)`;
  document.getElementById('pbarMasteredFill').style.width = `${getPct(mastered)}%`;

  // Tag Cloud Breakdown
  const tagCounts = {};
  vocabState.items.forEach(i => {
    i.tags.forEach(t => {
      tagCounts[t] = (tagCounts[t] || 0) + 1;
    });
  });

  const tagsContainer = document.getElementById('statsTagsContainer');
  if (Object.keys(tagCounts).length === 0) {
    tagsContainer.innerHTML = '<span style="color: var(--text-muted); font-size: 0.9rem;">Chưa có chủ đề nào.</span>';
    return;
  }

  let html = '';
  Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([tag, count]) => {
      html += `
        <div class="tag-cloud-chip">
          <i class="fa-solid fa-hashtag"></i> ${escapeHTML(tag)} <span>${count}</span>
        </div>
      `;
    });
  tagsContainer.innerHTML = html;
}

// EXPORT / IMPORT DATA
function exportJSONData() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(vocabState.items, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `vocab_daily_backup_${getTodayString()}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast('Đã xuất tập tin sao lưu JSON!', 'success');
}

async function importJSONData(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function(evt) {
    try {
      const data = JSON.parse(evt.target.result);
      if (Array.isArray(data)) {
        const response = await apiRequest('/api/vocab/import', {
          method: 'POST',
          body: JSON.stringify(data)
        });
        if (response && response.ok) {
          await loadVocabData();
          populateTagFilterSelect();
          showToast(`Đã khôi phục thành công ${data.length} từ vựng!`, 'success');
          document.getElementById('dataModal').classList.add('hidden');
        } else {
          showToast('Lỗi khi khôi phục từ vựng từ máy chủ!', 'error');
        }
      } else {
        showToast('Định dạng tệp JSON không hợp lệ!', 'warning');
      }
    } catch (err) {
      showToast('Lỗi khi đọc tệp JSON!', 'warning');
    }
  };
  reader.readAsText(file);
}

// UTILS
function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

function escapeJS(str) {
  if (!str) return '';
  return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
}

// =============================================
// AI TUTOR - INTERACTIVE LANGUAGE LEARNING
// =============================================

function initAITutorListeners() {
  // API Key Modal
  const apiKeyModal = document.getElementById('apiKeyModal');
  document.getElementById('openApiKeyModalBtn').addEventListener('click', async () => {
    apiKeyModal.classList.remove('hidden');
    let existingKey = geminiService.getApiKey();
    if (!existingKey) {
      const res = await apiRequest('/api/settings/apikey');
      if (res && res.ok) {
        const data = await res.json();
        if (data.apiKey) {
          existingKey = data.apiKey;
          geminiService.setApiKey(existingKey);
        }
      }
    }
    if (existingKey) document.getElementById('apiKeyInput').value = existingKey;
  });
  document.getElementById('closeApiKeyModalBtn').addEventListener('click', () => apiKeyModal.classList.add('hidden'));
  document.getElementById('bannerSetupApiBtn').addEventListener('click', async () => {
    apiKeyModal.classList.remove('hidden');
    let existingKey = geminiService.getApiKey();
    if (!existingKey) {
      const res = await apiRequest('/api/settings/apikey');
      if (res && res.ok) {
        const data = await res.json();
        if (data.apiKey) {
          existingKey = data.apiKey;
          geminiService.setApiKey(existingKey);
        }
      }
    }
    if (existingKey) document.getElementById('apiKeyInput').value = existingKey;
  });

  // Toggle API key visibility
  document.getElementById('toggleApiKeyVisibility').addEventListener('click', () => {
    const input = document.getElementById('apiKeyInput');
    const icon = document.querySelector('#toggleApiKeyVisibility i');
    if (input.type === 'password') {
      input.type = 'text';
      icon.className = 'fa-solid fa-eye-slash';
    } else {
      input.type = 'password';
      icon.className = 'fa-solid fa-eye';
    }
  });

  // Test API Key
  document.getElementById('testApiKeyBtn').addEventListener('click', async () => {
    const keyInput = document.getElementById('apiKeyInput').value.trim();
    const statusEl = document.getElementById('apiKeyStatus');
    if (!keyInput) {
      statusEl.innerHTML = '<span class="status-error"><i class="fa-solid fa-xmark"></i> Vui lòng nhập API Key</span>';
      return;
    }
    geminiService.setApiKey(keyInput);
    statusEl.innerHTML = '<span class="status-loading"><i class="fa-solid fa-spinner fa-spin"></i> Đang kiểm tra kết nối...</span>';
    const result = await geminiService.testConnection();
    if (result.success) {
      statusEl.innerHTML = `<span class="status-success"><i class="fa-solid fa-circle-check"></i> ${result.message}</span>`;
    } else {
      statusEl.innerHTML = `<span class="status-error"><i class="fa-solid fa-circle-xmark"></i> ${result.message}</span>`;
    }
  });

  // Save API Key
  document.getElementById('saveApiKeyBtn').addEventListener('click', async () => {
    const keyInput = document.getElementById('apiKeyInput').value.trim();
    if (!keyInput) {
      showToast('Vui lòng nhập API Key trước khi lưu!', 'warning');
      return;
    }
    geminiService.setApiKey(keyInput);
    
    await apiRequest('/api/settings/apikey', {
      method: 'PUT',
      body: JSON.stringify({ apiKey: keyInput })
    });
    
    showToast('Đã lưu Gemini API Key thành công!', 'success');
    apiKeyModal.classList.add('hidden');
    updateApiKeyBanner();
  });

  // Sub Navigation
  document.querySelectorAll('.ai-sub-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ai-sub-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.ai-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const panelId = btn.getAttribute('data-panel');
      document.getElementById(panelId).classList.add('active');
      vocabState.aiActivePanel = panelId;
    });
  });

  // Character counters
  document.getElementById('writingInput').addEventListener('input', (e) => {
    document.getElementById('writingCharCount').textContent = `${e.target.value.length} ký tự`;
  });
  document.getElementById('vocabContextInput').addEventListener('input', (e) => {
    document.getElementById('vocabContextCharCount').textContent = `${e.target.value.length} ký tự`;
  });

  // Writing Grader
  document.getElementById('gradeWritingBtn').addEventListener('click', handleGradeWriting);

  // Conversation Chat
  document.getElementById('sendChatBtn').addEventListener('click', handleSendChat);
  document.getElementById('chatInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendChat();
    }
  });
  
  // Voice & Speech features
  document.getElementById('voiceMicBtn').addEventListener('click', toggleSpeechRecognition);
  document.getElementById('autoReadBtn').addEventListener('click', (e) => {
    const btn = e.currentTarget;
    const isActive = btn.getAttribute('data-active') === 'true';
    btn.setAttribute('data-active', (!isActive).toString());
    
    if (isActive) {
      btn.querySelector('i').className = 'fa-solid fa-volume-xmark';
      window.speechSynthesis.cancel(); // Stop speaking if turned off
    } else {
      btn.querySelector('i').className = 'fa-solid fa-volume-high';
    }
  });
  document.getElementById('clearChatBtn').addEventListener('click', () => {
    if (vocabState.chatHistory.length === 0) return;
    if (confirm('Bạn có chắc muốn xóa toàn bộ lịch sử chat?')) {
      vocabState.chatHistory = [];
      document.getElementById('chatMessages').innerHTML = '';
      document.getElementById('chatMessages').classList.add('hidden');
      document.getElementById('chatScenarioCards').classList.remove('hidden');
      showToast('Đã xóa lịch sử chat!', 'info');
    }
  });
  document.getElementById('analyzeErrorsBtn').addEventListener('click', handleAnalyzeErrors);

  // Scenario Cards Click
  document.querySelectorAll('.scenario-card').forEach(card => {
    card.addEventListener('click', () => {
      const scenario = card.getAttribute('data-scenario');
      document.getElementById('scenarioSelect').value = scenario;
      vocabState.currentScenario = scenario;
      // Start conversation with greeting
      startConversationWithGreeting(scenario);
    });
  });

  // Scenario & Level Change
  document.getElementById('scenarioSelect').addEventListener('change', (e) => {
    vocabState.currentScenario = e.target.value;
  });
  document.getElementById('levelSelect').addEventListener('change', (e) => {
    vocabState.currentLevel = e.target.value;
  });

  // Vocabulary Suggestions
  document.getElementById('suggestVocabBtn').addEventListener('click', handleSuggestVocab);

  // Initial banner update
  updateApiKeyBanner();
}

// API KEY BANNER
function updateApiKeyBanner() {
  const banner = document.getElementById('apiKeyBanner');
  const bannerText = document.getElementById('apiKeyBannerText');
  const apiKey = geminiService.getApiKey();

  if (apiKey) {
    banner.classList.remove('disconnected');
    banner.classList.add('connected');
    bannerText.innerHTML = '<i class="fa-solid fa-circle-check"></i> Gemini API đã kết nối. Sẵn sàng sử dụng AI Tutor!';
  } else {
    banner.classList.remove('connected');
    banner.classList.add('disconnected');
    bannerText.innerHTML = 'Chưa cấu hình Gemini API Key. Nhấn nút <strong>🔑 Cài đặt API Key</strong> ở header để bắt đầu.';
  }
}

function checkApiKey() {
  if (!geminiService.getApiKey()) {
    showToast('Vui lòng cài đặt Gemini API Key trước!', 'warning');
    document.getElementById('apiKeyModal').classList.remove('hidden');
    return false;
  }
  return true;
}

// =============================================
// WRITING GRADER
// =============================================

async function handleGradeWriting() {
  if (!checkApiKey()) return;

  const essay = document.getElementById('writingInput').value.trim();
  if (!essay || essay.length < 20) {
    showToast('Bài viết quá ngắn! Hãy nhập ít nhất 20 ký tự.', 'warning');
    return;
  }

  const taskType = document.getElementById('writingTaskType').value;
  const btn = document.getElementById('gradeWritingBtn');
  const resultArea = document.getElementById('writingResultArea');

  // Show loading
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang chấm bài...';
  vocabState.isAIProcessing = true;

  try {
    const result = await geminiService.gradeWriting(essay, taskType);

    if (result.error) {
      showToast(result.error, 'warning');
      return;
    }

    // Render results
    renderWritingResult(result);
    resultArea.classList.remove('hidden');
    resultArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
    showToast('Chấm bài hoàn tất! Cuộn xuống để xem kết quả.', 'success');

  } catch (err) {
    showToast('Đã xảy ra lỗi khi chấm bài. Vui lòng thử lại.', 'warning');
    console.error('Grade writing error:', err);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Chấm Bài';
    vocabState.isAIProcessing = false;
  }
}

function renderWritingResult(data) {
  // Overall score ring animation
  const score = data.overallScore || 0;
  const circumference = 326.73;
  const offset = circumference - (score / 100) * circumference;

  const ringFill = document.getElementById('scoreRingFill');
  ringFill.style.transition = 'stroke-dashoffset 1.5s ease-out';
  setTimeout(() => { ringFill.style.strokeDashoffset = offset; }, 100);

  // Animate score count
  animateCountUp('overallScoreValue', score);

  // Overall feedback
  document.getElementById('overallFeedback').textContent = data.overallFeedback || data.overallFeedbackEn || '';

  // Sub scores
  const scores = data.scores || {};
  animateCountUp('scoreGrammar', scores.grammar || 0);
  animateCountUp('scoreVocabulary', scores.vocabulary || 0);
  animateCountUp('scoreCoherence', scores.coherence || 0);
  animateCountUp('scoreTask', scores.taskAchievement || 0);

  document.getElementById('scoreGrammarBar').style.width = (scores.grammar || 0) + '%';
  document.getElementById('scoreVocabularyBar').style.width = (scores.vocabulary || 0) + '%';
  document.getElementById('scoreCoherenceBar').style.width = (scores.coherence || 0) + '%';
  document.getElementById('scoreTaskBar').style.width = (scores.taskAchievement || 0) + '%';

  // Errors
  const errorList = document.getElementById('errorList');
  const errors = data.errors || [];
  if (errors.length === 0) {
    errorList.innerHTML = '<p class="no-errors"><i class="fa-solid fa-circle-check"></i> Không phát hiện lỗi ngữ pháp nghiêm trọng. Tuyệt vời!</p>';
  } else {
    errorList.innerHTML = errors.map(err => `
      <div class="error-item ${err.severity || 'minor'}">
        <div class="error-header">
          <span class="error-severity-badge ${err.severity || 'minor'}">${getSeverityLabel(err.severity)}</span>
        </div>
        <div class="error-body">
          <div class="error-original"><del>${escapeHTML(err.original)}</del></div>
          <div class="error-arrow"><i class="fa-solid fa-arrow-right"></i></div>
          <div class="error-correction">${escapeHTML(err.correction)}</div>
        </div>
        <div class="error-explanation">
          <i class="fa-solid fa-circle-info"></i> ${escapeHTML(err.explanationVi || err.explanation)}
        </div>
      </div>
    `).join('');
  }

  // Vocabulary suggestions from grading
  const vocabUpgradeList = document.getElementById('vocabUpgradeList');
  const vocabSuggestions = data.vocabularySuggestions || [];
  if (vocabSuggestions.length === 0) {
    vocabUpgradeList.innerHTML = '<p class="no-suggestions">Không có gợi ý nâng cấp từ vựng.</p>';
  } else {
    vocabUpgradeList.innerHTML = vocabSuggestions.map((vs, i) => `
      <div class="vocab-upgrade-item">
        <span class="vu-original">${escapeHTML(vs.original)}</span>
        <i class="fa-solid fa-arrow-right vu-arrow"></i>
        <span class="vu-suggested">${escapeHTML(vs.suggested)}</span>
        <span class="vu-context">${escapeHTML(vs.explanationVi || vs.context)}</span>
        <button class="btn btn-xs btn-save-vocab" onclick="saveAIVocab('${escapeJS(vs.suggested)}', '${escapeJS(vs.explanationVi || vs.context)}')" title="Thêm vào bộ từ">
          <i class="fa-solid fa-plus"></i>
        </button>
      </div>
    `).join('');
  }

  // Corrected essay
  document.getElementById('correctedEssayBox').innerHTML = `<p>${escapeHTML(data.correctedEssay || '').replace(/\n/g, '<br>')}</p>`;
}

function getSeverityLabel(severity) {
  const labels = {
    'critical': '🔴 Nghiêm trọng',
    'minor': '🟡 Nhẹ',
    'suggestion': '🔵 Gợi ý'
  };
  return labels[severity] || '🟡 Nhẹ';
}

function animateCountUp(elementId, target) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const duration = 1200;
  const start = 0;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(start + (target - start) * eased);
    el.textContent = current;
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

// =============================================
// CONVERSATION CHAT
// =============================================

async function startConversationWithGreeting(scenario) {
  document.getElementById('chatScenarioCards').classList.add('hidden');
  document.getElementById('chatMessages').classList.remove('hidden');

  // Send a system-style first message to get AI greeting
  const greetingPrompts = {
    'daily': 'Start the conversation by asking me about my day or daily routine.',
    'interview': 'Start a mock job interview. You are the interviewer. Greet me and ask the first question.',
    'travel': 'Start a conversation as if I\'m a tourist asking you for travel advice or directions.',
    'academic': 'Start an academic discussion. Ask me about my field of study or a research topic.',
    'custom': 'Start a free-form conversation by asking me what I\'d like to talk about today.'
  };

  const prompt = greetingPrompts[scenario] || greetingPrompts['custom'];
  vocabState.chatHistory = [{ role: 'user', content: prompt }];

  showTypingIndicator(true);

  try {
    const result = await geminiService.chat(
      vocabState.chatHistory,
      scenario,
      vocabState.currentLevel
    );

    if (result.error) {
      showToast(result.error, 'warning');
      showTypingIndicator(false);
      return;
    }

    // Replace the system prompt with actual model response
    vocabState.chatHistory = [{ role: 'model', content: result.reply }];
    appendChatBubble('ai', result);
    speakText(result.reply); // Read greeting aloud

  } catch (err) {
    showToast('Lỗi khởi tạo chat. Vui lòng thử lại.', 'warning');
    console.error('Chat init error:', err);
  } finally {
    showTypingIndicator(false);
  }
}

async function handleSendChat() {
  if (!checkApiKey()) return;
  if (vocabState.isAIProcessing) return;

  const input = document.getElementById('chatInput');
  const message = input.value.trim();
  if (!message) return;

  // Show chat area if needed
  document.getElementById('chatScenarioCards').classList.add('hidden');
  document.getElementById('chatMessages').classList.remove('hidden');

  // Add user message
  input.value = '';
  vocabState.chatHistory.push({ role: 'user', content: message });
  appendChatBubble('user', { reply: message });

  // Call AI
  vocabState.isAIProcessing = true;
  showTypingIndicator(true);

  try {
    const result = await geminiService.chat(
      vocabState.chatHistory,
      vocabState.currentScenario,
      vocabState.currentLevel
    );

    if (result.error) {
      showToast(result.error, 'warning');
      return;
    }

    vocabState.chatHistory.push({ role: 'model', content: result.reply });
    appendChatBubble('ai', result);
    speakText(result.reply); // Read response aloud

  } catch (err) {
    showToast('Lỗi khi gửi tin nhắn. Vui lòng thử lại.', 'warning');
    console.error('Chat error:', err);
  } finally {
    vocabState.isAIProcessing = false;
    showTypingIndicator(false);
  }
}

function appendChatBubble(type, data) {
  const container = document.getElementById('chatMessages');
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${type} fade-in`;

  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  if (type === 'user') {
    bubble.innerHTML = `
      <div class="bubble-content">${escapeHTML(data.reply)}</div>
      <div class="bubble-time">${timeStr}</div>
    `;
  } else {
    let correctionsHTML = '';
    if (data.corrections && data.corrections.length > 0) {
      correctionsHTML = `
        <div class="bubble-corrections">
          <div class="corrections-title"><i class="fa-solid fa-pen"></i> Sửa lỗi:</div>
          ${data.corrections.map(c => `
            <div class="chat-correction-item">
              <del>${escapeHTML(c.original)}</del> → <strong>${escapeHTML(c.corrected)}</strong>
              <span class="correction-explain">${escapeHTML(c.explanationVi)}</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    let vocabHTML = '';
    if (data.newVocabulary && data.newVocabulary.length > 0) {
      vocabHTML = `
        <div class="chat-new-vocab">
          <div class="vocab-title"><i class="fa-solid fa-lightbulb"></i> Từ vựng mới:</div>
          ${data.newVocabulary.map(v => `
            <div class="chat-vocab-chip" onclick="saveAIVocab('${escapeJS(v.word)}', '${escapeJS(v.meaning)}', '${escapeJS(v.phonetic || '')}', '${escapeJS(v.type || 'other')}')">
              <strong>${escapeHTML(v.word)}</strong> ${v.phonetic ? `<span class="vc-phonetic">${escapeHTML(v.phonetic)}</span>` : ''}
              <span class="vc-meaning">${escapeHTML(v.meaning)}</span>
              <i class="fa-solid fa-plus vc-add-icon"></i>
            </div>
          `).join('')}
        </div>
      `;
    }

    bubble.innerHTML = `
      <div class="bubble-avatar"><i class="fa-solid fa-robot"></i></div>
      <div class="bubble-body">
        <div class="bubble-content">${escapeHTML(data.reply).replace(/\n/g, '<br>')}</div>
        ${correctionsHTML}
        ${vocabHTML}
        <div class="bubble-time">${timeStr}</div>
      </div>
    `;
  }

  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
}

function showTypingIndicator(show) {
  const indicator = document.getElementById('typingIndicator');
  if (show) {
    indicator.classList.remove('hidden');
  } else {
    indicator.classList.add('hidden');
  }
}

async function handleAnalyzeErrors() {
  if (!checkApiKey()) return;

  // Find last user message
  const lastUserMsg = [...vocabState.chatHistory].reverse().find(m => m.role === 'user');
  if (!lastUserMsg) {
    showToast('Không tìm thấy tin nhắn nào để phân tích!', 'warning');
    return;
  }

  const btn = document.getElementById('analyzeErrorsBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang phân tích...';

  try {
    const result = await geminiService.analyzeErrors(lastUserMsg.content);

    if (result.error) {
      showToast(result.error, 'warning');
      return;
    }

    // Display analysis as a system message in chat
    const analysisData = {
      reply: formatErrorAnalysis(result),
      corrections: [],
      newVocabulary: []
    };
    appendChatBubble('ai', analysisData);

  } catch (err) {
    showToast('Lỗi khi phân tích. Vui lòng thử lại.', 'warning');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-microscope"></i> Phân tích lỗi';
  }
}

function formatErrorAnalysis(data) {
  let text = '📋 PHÂN TÍCH LỖI:\n\n';

  if (data.errors && data.errors.length > 0) {
    data.errors.forEach((err, i) => {
      text += `${i + 1}. "${err.original}" → "${err.corrected}"\n   📝 ${err.explanationVi}\n\n`;
    });
  } else {
    text += '✅ Không phát hiện lỗi nào! Câu viết tốt lắm!\n\n';
  }

  if (data.correctedMessage) {
    text += `✏️ Câu đã sửa: "${data.correctedMessage}"\n\n`;
  }

  if (data.tips && data.tips.length > 0) {
    text += '💡 Mẹo:\n';
    data.tips.forEach(tip => {
      text += `  • ${tip}\n`;
    });
  }

  return text;
}

// =============================================
// VOICE AI (SPEECH-TO-TEXT & TEXT-TO-SPEECH)
// =============================================

let speechRecognition = null;
let isRecording = false;

function toggleSpeechRecognition() {
  const micBtn = document.getElementById('voiceMicBtn');
  const input = document.getElementById('chatInput');

  if (isRecording) {
    if (speechRecognition) speechRecognition.stop();
    return;
  }

  // Initialize SpeechRecognition if not already done
  if (!speechRecognition) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast('Trình duyệt của bạn không hỗ trợ nhận diện giọng nói. Hãy dùng Chrome/Edge.', 'error');
      return;
    }
    
    speechRecognition = new SpeechRecognition();
    speechRecognition.lang = 'en-US'; // Listen for English
    speechRecognition.continuous = false;
    speechRecognition.interimResults = true;

    speechRecognition.onstart = () => {
      isRecording = true;
      micBtn.classList.add('recording');
      input.placeholder = "Đang nghe... (Nói tiếng Anh)";
    };

    speechRecognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      if (finalTranscript) {
        // Append final text
        input.value = (input.value + ' ' + finalTranscript).trim();
      } else if (interimTranscript) {
        // Optional: show interim somewhere, but simple updating value can be jarring
      }
    };

    speechRecognition.onerror = (event) => {
      console.error('Speech recognition error', event.error);
      if (event.error === 'not-allowed') {
        showToast('Vui lòng cấp quyền sử dụng Micro trên trình duyệt.', 'error');
      }
      isRecording = false;
      micBtn.classList.remove('recording');
      input.placeholder = "Nhập tin nhắn tiếng Anh hoặc nhấn micro để nói...";
    };

    speechRecognition.onend = () => {
      isRecording = false;
      micBtn.classList.remove('recording');
      input.placeholder = "Nhập tin nhắn tiếng Anh hoặc nhấn micro để nói...";
      
      // Auto-send if there's text
      if (input.value.trim().length > 0) {
        handleSendChat();
      }
    };
  }

  // Start recording
  try {
    speechRecognition.start();
  } catch (e) {
    console.error(e);
  }
}

function speakText(text) {
  const autoReadBtn = document.getElementById('autoReadBtn');
  if (autoReadBtn.getAttribute('data-active') !== 'true') return;

  if (!window.speechSynthesis) return;

  // Clean up markdown/HTML before speaking
  let cleanText = text.replace(/<[^>]+>/g, '').replace(/[\*\_\`]/g, '');

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = 'en-US';
  utterance.rate = 1.0;
  
  // Try to find a natural English voice
  const voices = window.speechSynthesis.getVoices();
  const enVoice = voices.find(v => v.lang.startsWith('en-') && (v.name.includes('Google') || v.name.includes('Natural')));
  if (enVoice) {
    utterance.voice = enVoice;
  }

  window.speechSynthesis.speak(utterance);
}

// Ensure voices are loaded for Chrome
if (window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {
    // Voices loaded
  };
}

// =============================================
// VOCABULARY SUGGESTIONS
// =============================================

async function handleSuggestVocab() {
  if (!checkApiKey()) return;

  const paragraph = document.getElementById('vocabContextInput').value.trim();
  if (!paragraph || paragraph.length < 15) {
    showToast('Đoạn văn quá ngắn! Hãy nhập ít nhất 15 ký tự.', 'warning');
    return;
  }

  const btn = document.getElementById('suggestVocabBtn');
  const resultArea = document.getElementById('vocabSuggestResults');

  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang phân tích...';

  try {
    const result = await geminiService.suggestVocabulary(paragraph);

    if (result.error) {
      showToast(result.error, 'warning');
      return;
    }

    renderVocabSuggestions(result);
    resultArea.classList.remove('hidden');
    resultArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
    showToast('Phân tích hoàn tất! Cuộn xuống để xem gợi ý.', 'success');

  } catch (err) {
    showToast('Lỗi khi phân tích từ vựng. Vui lòng thử lại.', 'warning');
    console.error('Vocab suggest error:', err);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Gợi Ý Từ Vựng';
  }
}

function renderVocabSuggestions(data) {
  // Analysis text
  document.getElementById('vocabAnalysisText').textContent = data.analysis || '';

  // Suggestion cards
  const cardsContainer = document.getElementById('vocabSuggestCards');
  const suggestions = data.suggestions || [];

  if (suggestions.length === 0) {
    cardsContainer.innerHTML = '<p class="no-suggestions">Đoạn văn đã sử dụng từ vựng tốt! Không có gợi ý thêm.</p>';
  } else {
    cardsContainer.innerHTML = suggestions.map((s, i) => {
      const typeLabel = { 'synonym': 'Đồng nghĩa', 'collocation': 'Collocation', 'advanced': 'Nâng cao', 'natural': 'Tự nhiên hơn' };
      return `
        <div class="vocab-suggest-card glass-panel fade-in" style="animation-delay: ${i * 0.08}s">
          <div class="vs-header">
            <span class="vs-original">${escapeHTML(s.original)}</span>
            <span class="vs-arrow"><i class="fa-solid fa-arrow-right"></i></span>
            <span class="vs-suggested">${escapeHTML(s.suggested)}</span>
            <span class="vs-type-badge ${s.type || 'synonym'}">${typeLabel[s.type] || s.type}</span>
          </div>
          ${s.phonetic ? `<div class="vs-phonetic">${escapeHTML(s.phonetic)}</div>` : ''}
          <div class="vs-meaning">${escapeHTML(s.meaningVi)}</div>
          ${s.exampleSentence ? `<div class="vs-example"><i class="fa-solid fa-quote-left"></i> ${escapeHTML(s.exampleSentence)}</div>` : ''}
          ${s.reason ? `<div class="vs-reason"><i class="fa-solid fa-circle-info"></i> ${escapeHTML(s.reason)}</div>` : ''}
          <button class="btn btn-xs btn-save-vocab vs-save-btn" onclick="saveAIVocab('${escapeJS(s.suggested)}', '${escapeJS(s.meaningVi)}', '${escapeJS(s.phonetic || '')}')" title="Thêm vào bộ từ">
            <i class="fa-solid fa-plus"></i> Thêm vào bộ từ
          </button>
        </div>
      `;
    }).join('');
  }

  // Collocations
  const collocationList = document.getElementById('collocationList');
  const collocations = data.collocations || [];
  const collocationSection = document.getElementById('collocationSection');

  if (collocations.length === 0) {
    collocationSection.classList.add('hidden');
  } else {
    collocationSection.classList.remove('hidden');
    collocationList.innerHTML = collocations.map(c => `
      <div class="collocation-chip" title="${escapeHTML(c.meaningVi)}">
        <strong>${escapeHTML(c.phrase)}</strong>
        <span>${escapeHTML(c.meaningVi)}</span>
        ${c.exampleSentence ? `<span class="coll-example">${escapeHTML(c.exampleSentence)}</span>` : ''}
      </div>
    `).join('');
  }

  // Improved paragraph
  document.getElementById('improvedText').innerHTML = `<p>${escapeHTML(data.improvedParagraph || '').replace(/\n/g, '<br>')}</p>`;
}

// =============================================
// SAVE AI-SUGGESTED VOCABULARY TO VOCABDAILY
// =============================================

async function saveAIVocab(word, meaning, phonetic = '', type = 'other') {
  // Check if word already exists
  const exists = vocabState.items.some(item => item.word.toLowerCase() === word.toLowerCase());
  if (exists) {
    showToast(`Từ "${word}" đã có trong bộ từ vựng!`, 'info');
    return;
  }

  const newVocab = {
    id: 'ai-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
    word: word,
    phonetic: phonetic,
    type: type,
    meaning: meaning,
    example: '',
    tags: ['AI Tutor'],
    status: 'new',
    date: getTodayString()
  };

  vocabState.items.unshift(newVocab);
  
  await apiRequest('/api/vocab', {
    method: 'POST',
    body: JSON.stringify(newVocab)
  });
  await loadVocabData();

  showToast(`Đã thêm "${word}" vào bộ từ vựng! 🎉`, 'success');
}
