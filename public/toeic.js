// toeic.js - Logic for TOEIC Practice Tab

document.addEventListener('DOMContentLoaded', () => {
  // TOEIC Sub-navigation
  const toeicSubBtns = document.querySelectorAll('#toeicTab .ai-sub-btn');
  toeicSubBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      toeicSubBtns.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('#toeicTab .ai-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const panelId = btn.getAttribute('data-toeicpanel');
      document.getElementById(panelId).classList.add('active');
    });
  });

  // Prompt Data based on TOEIC Format
  const toeicPrompts = {
    speaking: {
      'q1-2': [
        "Read aloud: The city's annual summer festival will take place next Saturday and Sunday. There will be activities that are fun for the whole family. You can try a variety of food, hear different kinds of music, and enjoy games for all ages. Tickets cost fifteen dollars at the gate. However, if you buy your ticket in advance, you will get a ten percent discount. Tickets are available at many local stores, as well as at City Hall. Don't miss this fun event!",
        "Read aloud: Could I have everyone's attention, please? Due to mechanical problems, this bus will now be taken out of service. We apologize for any inconvenience this might cause you. Please exit the bus safely by using the front or back doors and stepping away from the side of the road. We have contacted the main bus depot, and a shuttle bus is presently en route to our location. The shuttle's approximate arrival time is fifteen minutes. Again, we apologize for the delay and appreciate your patience. All connecting buses will be held at the station until our bus arrives. Are there any questions?"
      ],
      'q3': [
        "Describe a picture: Describe a scene in a bakery where a female baker in a white uniform is carrying a tray of hot bread out of an oven to a counter. A customer in a blue shirt is waiting in front of the counter.",
        "Describe a picture: Describe a busy office room where two businesspeople (a man and a woman) are looking at a document while standing next to a copy machine. There are boxes with slots filled with paper in the background."
      ],
      'q4-6': [
        "Respond to Questions:\nImagine that an American marketing firm is doing research in your country. You have agreed to participate in a telephone survey about food shopping.\nQuestion 4: What types of food stores are there in your neighborhood?\nQuestion 5: How often do you go food shopping and when do you usually go?\nQuestion 6: Describe what you buy and why you make those purchases.",
        "Respond to Questions:\nImagine that a research firm is doing a telephone survey of people in your city. You have agreed to answer some questions about sports.\nQuestion 4: What sports do you enjoy playing?\nQuestion 5: How often do you usually play sports?\nQuestion 6: Do you think it is important for children to play sports? Why or why not?"
      ],
      'q7-9': [
        "Respond using Information Provided:\nInformation: 'Botanical Gardens Tour. June 5. Tickets $25. 9:00am: Meet at front entrance. 9:15-10:00: Walking tour of outdoor gardens. 12:00-1:00pm: Lunch in Garden Cafe. 3:00-4:00: Tea and pastries in the outdoor garden.'\nQuestion 7: Can you tell me where the tour begins?\nQuestion 8: How much are tickets?\nQuestion 9: Will any meals be served during the tour?"
      ],
      'q10': [
        "Propose a Solution:\nRole: Customer Service Representative. Message: 'Hi, this is Sarah Brown. I’d like to make a complaint about a problem I’ve been having with my new stove. We just bought it two weeks ago, but the last few times I’ve turned it on, nothing has happened. Then, when I try again, it works. I don’t know what the issue is, but I need to get it fixed right away. I have people coming over for dinner on Friday night, and it’s already Tuesday. I really need someone to come out and have a look at it. I’d prefer it if someone could come today or, at the latest, tomorrow. Please call me back as soon as possible. Sarah Brown at 906-555-7272. Thank you.'"
      ],
      'q11': [
        "Express an Opinion: Do you agree or disagree with the following statement? 'Young people should not be allowed to drive cars until they are twenty-one years old.' Use specific reasons and examples to support your answer.",
        "Express an Opinion: Imagine that there is a plan to build a large shopping mall in your neighborhood. Do you support or oppose this plan? Why? Use specific reasons and examples to support your opinion."
      ]
    },
    writing: {
      'q1-5': [
        "Write a sentence based on a picture.\nWord Pair: woman / pay.\nDescribe a woman paying for groceries at a checkout counter.",
        "Write a sentence based on a picture.\nWord Pair: passenger / board.\nDescribe a passenger boarding a public bus."
      ],
      'q6-7': [
        "Respond to a written request.\nFrom: Samuel George (Bank Customer Service)\nTo: Janet Jones\nSubject: Changing banks\n'We understand that you have moved your accounts to another bank. We are very sorry to lose your business. To help us provide better service in the future, would you mind telling us why you made the decision to change banks?'\nDirections: Respond to the e-mail as if you are Janet Jones. Explain ONE problem and make TWO suggestions."
      ],
      'q8': [
        "Write an opinion essay.\nSome people use public transportation (buses and subways) to get around a city. Others use private cars. Which do you prefer? Support your answer with specific reasons and examples. (Minimum 300 words)",
        "Write an opinion essay.\nModern technology has made it possible for many people to work at home most of the time rather than going to an office every day. What are the advantages and disadvantages of working at home? Support your answer with specific reasons and examples. (Minimum 300 words)"
      ]
    }
  };

  // Generate Prompts
  document.getElementById('generateSpeakingPromptBtn').addEventListener('click', () => {
    const type = document.getElementById('toeicSpeakingTypeSelect').value;
    const prompts = toeicPrompts.speaking[type];
    const prompt = prompts[Math.floor(Math.random() * prompts.length)];
    const area = document.getElementById('toeicSpeakingPromptArea');
    area.innerHTML = \<p style="white-space: pre-wrap; font-size: 1.1rem; line-height: 1.5;">\</p>\;
    document.getElementById('toeicSpeakingResultArea').classList.add('hidden');
    document.getElementById('toeicSpeakingResponse').value = '';
  });

  document.getElementById('generateWritingPromptBtn').addEventListener('click', () => {
    const type = document.getElementById('toeicWritingTypeSelect').value;
    const prompts = toeicPrompts.writing[type];
    const prompt = prompts[Math.floor(Math.random() * prompts.length)];
    const area = document.getElementById('toeicWritingPromptArea');
    area.innerHTML = \<p style="white-space: pre-wrap; font-size: 1.1rem; line-height: 1.5;">\</p>\;
    document.getElementById('toeicWritingResultArea').classList.add('hidden');
    document.getElementById('toeicWritingResponse').value = '';
  });

  // Grade Speaking
  document.getElementById('gradeSpeakingBtn').addEventListener('click', async () => {
    const responseText = document.getElementById('toeicSpeakingResponse').value.trim();
    if (!responseText) {
      if(window.showToast) window.showToast('Vui lòng nh?p câu tr? l?i c?a b?n.', 'warning');
      return;
    }
    
    const promptArea = document.getElementById('toeicSpeakingPromptArea').innerText;
    if (promptArea.includes('Nh?n "T?o Ð? M?i"')) {
      if(window.showToast) window.showToast('Vui lòng t?o d? tru?c khi ch?m.', 'warning');
      return;
    }

    const btn = document.getElementById('gradeSpeakingBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Ðang ch?m di?m...';
    btn.disabled = true;

    try {
      const type = document.getElementById('toeicSpeakingTypeSelect').value;
      const result = await aiService.gradeTOEICSpeaking(responseText, type, promptArea);
      renderSpeakingResult(result);
    } catch (e) {
      if(window.showToast) window.showToast(e.message, 'warning');
    } finally {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  });

  // Grade Writing
  document.getElementById('gradeWritingBtn').addEventListener('click', async () => {
    const responseText = document.getElementById('toeicWritingResponse').value.trim();
    if (!responseText) {
      if(window.showToast) window.showToast('Vui lòng nh?p bài vi?t c?a b?n.', 'warning');
      return;
    }
    
    const promptArea = document.getElementById('toeicWritingPromptArea').innerText;
    if (promptArea.includes('Nh?n "T?o Ð? M?i"')) {
      if(window.showToast) window.showToast('Vui lòng t?o d? tru?c khi ch?m.', 'warning');
      return;
    }

    const btn = document.getElementById('gradeWritingBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Ðang ch?m di?m...';
    btn.disabled = true;

    try {
      const type = document.getElementById('toeicWritingTypeSelect').value;
      const result = await aiService.gradeTOEICWriting(responseText, type, promptArea);
      renderWritingResult(result);
    } catch (e) {
      if(window.showToast) window.showToast(e.message, 'warning');
    } finally {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  });

  function renderSpeakingResult(result) {
    document.getElementById('toeicSpeakingResultArea').classList.remove('hidden');
    document.getElementById('toeicSpeakingScoreValue').textContent = result.score || '0';
    document.getElementById('toeicSpeakingFeedback').textContent = result.overallFeedbackVi || '';
    
    document.getElementById('toeicSpeakingStrengths').innerHTML = (result.strengths || []).map(s => \<li>\</li>\).join('');
    document.getElementById('toeicSpeakingWeaknesses').innerHTML = (result.weaknesses || []).map(w => \<li>\</li>\).join('');
    
    document.getElementById('toeicSpeakingErrorList').innerHTML = (result.errors || []).map(e => \
      <div class="error-item">
        <div class="error-original"><i class="fa-solid fa-xmark"></i> \</div>
        <div class="error-correction"><i class="fa-solid fa-check"></i> \</div>
        <div class="error-explanation"><i class="fa-solid fa-circle-info"></i> \</div>
      </div>
    \).join('');

    document.getElementById('toeicSpeakingImproved').innerHTML = \<p>\</p>\;
  }

  function renderWritingResult(result) {
    document.getElementById('toeicWritingResultArea').classList.remove('hidden');
    document.getElementById('toeicWritingScoreValue').textContent = result.score || '0';
    document.getElementById('toeicWritingFeedback').textContent = result.overallFeedbackVi || '';
    
    document.getElementById('toeicWritingStrengths').innerHTML = (result.strengths || []).map(s => \<li>\</li>\).join('');
    document.getElementById('toeicWritingWeaknesses').innerHTML = (result.weaknesses || []).map(w => \<li>\</li>\).join('');
    
    document.getElementById('toeicWritingErrorList').innerHTML = (result.errors || []).map(e => \
      <div class="error-item">
        <div class="error-original"><i class="fa-solid fa-xmark"></i> \</div>
        <div class="error-correction"><i class="fa-solid fa-check"></i> \</div>
        <div class="error-explanation"><i class="fa-solid fa-circle-info"></i> \</div>
      </div>
    \).join('');

    document.getElementById('toeicWritingImproved').innerHTML = \<p>\</p>\;
  }
});
