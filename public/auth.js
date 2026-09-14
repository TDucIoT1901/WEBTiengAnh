// Auth State Management
const AUTH_TOKEN_KEY = 'vocabdaily_token';
const AUTH_USER_KEY = 'vocabdaily_user';

// Check if already logged in
document.addEventListener('DOMContentLoaded', () => {
    if (getAuthToken()) {
        window.location.href = '/';
    }
});

// Helper Functions
function getAuthToken() {
    return localStorage.getItem(AUTH_TOKEN_KEY);
}

function getAuthHeaders() {
    const token = getAuthToken();
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
}

// DOM Elements
const authForm = document.getElementById('auth-form');
const toggleModeLink = document.getElementById('toggle-mode-link');
const authTitle = document.getElementById('auth-title');
const authSubtitle = document.getElementById('auth-subtitle');
const toggleText = document.getElementById('toggle-text');
const submitBtn = document.getElementById('submit-btn');
const btnText = document.querySelector('.btn-text');
const btnSpinner = document.querySelector('.btn-spinner');
const messageArea = document.getElementById('message-area');

// Form Groups
const usernameGroup = document.getElementById('username-group');
const confirmPasswordGroup = document.getElementById('confirm-password-group');

// Inputs
const usernameInput = document.getElementById('username');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const confirmPasswordInput = document.getElementById('confirm-password');

// Toggle Elements
const togglePassword = document.getElementById('toggle-password');
const toggleConfirmPassword = document.getElementById('toggle-confirm-password');

// State
let isLoginMode = true;

// Password Visibility Toggle
function setupPasswordToggle(toggleIcon, inputElement) {
    toggleIcon.addEventListener('click', () => {
        const type = inputElement.getAttribute('type') === 'password' ? 'text' : 'password';
        inputElement.setAttribute('type', type);
        toggleIcon.classList.toggle('fa-eye');
        toggleIcon.classList.toggle('fa-eye-slash');
    });
}

setupPasswordToggle(togglePassword, passwordInput);
setupPasswordToggle(toggleConfirmPassword, confirmPasswordInput);

// Mode Toggle (Login / Register)
toggleModeLink.addEventListener('click', (e) => {
    e.preventDefault();
    isLoginMode = !isLoginMode;
    
    // Clear form and messages
    authForm.reset();
    hideMessage();
    clearValidationErrors();

    if (isLoginMode) {
        // Switch to Login
        authTitle.textContent = 'Chào mừng trở lại';
        authSubtitle.textContent = 'Đăng nhập để tiếp tục học từ vựng';
        usernameGroup.classList.add('hidden');
        confirmPasswordGroup.classList.add('hidden');
        btnText.textContent = 'Đăng nhập';
        toggleText.textContent = 'Chưa có tài khoản?';
        toggleModeLink.textContent = 'Đăng ký';
        
        // Remove required from register fields
        usernameInput.removeAttribute('required');
        confirmPasswordInput.removeAttribute('required');
    } else {
        // Switch to Register
        authTitle.textContent = 'Tạo tài khoản mới';
        authSubtitle.textContent = 'Bắt đầu hành trình học từ vựng của bạn';
        usernameGroup.classList.remove('hidden');
        confirmPasswordGroup.classList.remove('hidden');
        btnText.textContent = 'Đăng ký';
        toggleText.textContent = 'Đã có tài khoản?';
        toggleModeLink.textContent = 'Đăng nhập';
        
        // Add required to register fields
        usernameInput.setAttribute('required', 'true');
        confirmPasswordInput.setAttribute('required', 'true');
    }
});

// Validation Helpers
function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function clearValidationErrors() {
    document.querySelectorAll('.input-group').forEach(group => {
        group.classList.remove('invalid');
    });
}

function setInvalid(inputElement, message) {
    const group = inputElement.closest('.input-group');
    group.classList.add('invalid');
    if (message) {
        group.querySelector('.error-text').textContent = message;
    }
}

// Message Helpers
function showMessage(message, type = 'error') {
    messageArea.textContent = message;
    messageArea.className = `message-area ${type}`;
    
    const icon = document.createElement('i');
    icon.className = type === 'error' ? 'fa-solid fa-circle-exclamation' : 'fa-solid fa-circle-check';
    messageArea.prepend(icon);
}

function hideMessage() {
    messageArea.className = 'message-area hidden';
    messageArea.innerHTML = '';
}

// Form Submission
authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearValidationErrors();
    hideMessage();
    
    let isValid = true;
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    
    // Validate Email
    if (!email || !isValidEmail(email)) {
        setInvalid(emailInput, 'Email không hợp lệ');
        isValid = false;
    }
    
    // Validate Password
    if (!password || password.length < 6) {
        setInvalid(passwordInput, 'Mật khẩu phải có ít nhất 6 ký tự');
        isValid = false;
    }
    
    // Validate Register specific fields
    let username = '';
    if (!isLoginMode) {
        username = usernameInput.value.trim();
        const confirmPassword = confirmPasswordInput.value;
        
        if (!username || username.length < 3) {
            setInvalid(usernameInput, 'Tên phải có ít nhất 3 ký tự');
            isValid = false;
        }
        
        if (password !== confirmPassword) {
            setInvalid(confirmPasswordInput, 'Mật khẩu không khớp');
            isValid = false;
        }
    }
    
    if (!isValid) return;
    
    // Process Submit
    setLoading(true);
    
    try {
        const endpoint = isLoginMode ? '/api/auth/login' : '/api/auth/register';
        const payload = isLoginMode 
            ? { email, password }
            : { username, email, password };
            
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        
        if (!response.ok) throw new Error(data.error || data.message || 'Có lỗi xảy ra');
        
        // Save auth state
        localStorage.setItem(AUTH_TOKEN_KEY, data.token);
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
        
        showMessage(isLoginMode ? 'Đăng nhập thành công!' : 'Đăng ký thành công!', 'success');
        
        // Redirect immediately
        window.location.href = '/';
        
    } catch (error) {
        showMessage(error.message || 'Đã có lỗi xảy ra. Vui lòng thử lại.');
        setLoading(false);
    }
});

// UI State Management
function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    if (isLoading) {
        btnText.classList.add('hidden');
        btnSpinner.classList.remove('hidden');
    } else {
        btnText.classList.remove('hidden');
        btnSpinner.classList.add('hidden');
    }
}
