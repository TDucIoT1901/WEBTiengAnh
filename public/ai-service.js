class AiService {
  constructor() {
    this.model = 'gpt-4o-mini'; // or 'gpt-3.5-turbo'
    this.endpoint = 'https://api.openai.com/v1/chat/completions';
    this.apiKeyStorageKey = 'vocabdaily_openai_api_key';
  }

  setApiKey(key) {
    if (key) {
      localStorage.setItem(this.apiKeyStorageKey, key.trim());
    } else {
      localStorage.removeItem(this.apiKeyStorageKey);
    }
  }

  getApiKey() {
    return localStorage.getItem(this.apiKeyStorageKey) || '';
  }

  async testConnection() {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return { success: false, message: 'Vui lòng nhập API Key của OpenAI (ChatGPT).' };
    }

    if (!apiKey.startsWith('sk-')) {
      return { success: false, message: 'API Key không đúng định dạng! Key OpenAI thường bắt đầu bằng "sk-".' };
    }

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: 'Hello, this is a test connection. Reply with "OK".' }],
          max_tokens: 10
        })
      });

      if (response.ok) {
        return { success: true, message: 'Kết nối ChatGPT thành công! ✅' };
      } else {
        let detail = '';
        try {
          const errBody = await response.json();
          detail = errBody?.error?.message || '';
        } catch(e) {}
        const errorResult = this._handleApiError(response.status);
        if (detail) errorResult.message += ` (${detail})`;
        return errorResult;
      }
    } catch (error) {
      return { success: false, message: 'Lỗi mạng hoặc không thể kết nối tới máy chủ OpenAI.' };
    }
  }

  async _callOpenAI(systemPrompt, userContent, previousMessages = null) {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('Vui lòng nhập API Key của OpenAI.');
    }

    let messages = [
      { role: 'system', content: systemPrompt }
    ];
    
    if (previousMessages) {
      messages = messages.concat(previousMessages.map(msg => ({
        role: msg.role === 'model' ? 'assistant' : 'user',
        content: msg.content
      })));
    } else {
      messages.push({ role: 'user', content: userContent });
    }

    const requestBody = {
      model: this.model,
      messages: messages,
      response_format: { type: "json_object" }
    };

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorResult = this._handleApiError(response.status);
        throw new Error(errorResult.message);
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content;
      
      if (!text) {
        throw new Error('Định dạng phản hồi từ API không hợp lệ.');
      }

      return this._parseJSON(text);
    } catch (error) {
      throw new Error(error.message || 'Lỗi không xác định khi gọi OpenAI API.');
    }
  }

  _handleApiError(status) {
    let message = 'Lỗi không xác định từ OpenAI API.';
    if (status === 401 || status === 403) {
      message = 'API Key không hợp lệ hoặc không có quyền truy cập.';
    } else if (status === 429) {
      message = 'Vượt quá giới hạn yêu cầu (Rate Limit) hoặc hết tiền trong tài khoản OpenAI.';
    } else if (status >= 500) {
      message = 'Lỗi máy chủ OpenAI. Vui lòng thử lại sau.';
    } else {
      message = `Lỗi từ OpenAI API: Mã ${status}`;
    }
    return { success: false, message };
  }

  _parseJSON(text) {
    try {
      let cleanText = text.trim();
      if (cleanText.startsWith('```json')) {
        cleanText = cleanText.substring(7);
      } else if (cleanText.startsWith('```')) {
        cleanText = cleanText.substring(3);
      }
      if (cleanText.endsWith('```')) {
        cleanText = cleanText.substring(0, cleanText.length - 3);
      }
      return JSON.parse(cleanText.trim());
    } catch (e) {
      console.error('Failed to parse JSON:', text);
      throw new Error('Lỗi khi phân tích dữ liệu JSON từ AI.');
    }
  }

  async gradeWriting(essay, taskType = 'general') {
    const systemPrompt = `Act as an expert English writing examiner. Analyze the following essay for a ${taskType} task. 
You must ALWAYS respond ONLY in valid JSON format matching this schema:
{
  "overallScore": <number 0-100>,
  "scores": {
    "grammar": <number 0-100>,
    "vocabulary": <number 0-100>,
    "coherence": <number 0-100>,
    "taskAchievement": <number 0-100>
  },
  "errors": [
    {
      "original": "<original text>",
      "correction": "<corrected text>",
      "explanation": "<English explanation>",
      "explanationVi": "<Vietnamese explanation>",
      "severity": "<critical|minor|suggestion>"
    }
  ],
  "correctedEssay": "<full corrected version of the essay>",
  "vocabularySuggestions": [
    {
      "original": "<original word/phrase>",
      "suggested": "<better vocabulary>",
      "context": "<context of usage>",
      "explanationVi": "<Vietnamese explanation>"
    }
  ],
  "overallFeedback": "<Detailed overall feedback in Vietnamese>",
  "overallFeedbackEn": "<Detailed overall feedback in English>"
}`;

    return await this._callOpenAI(systemPrompt, essay);
  }

  async chat(messages, scenario = 'daily', level = 'intermediate') {
    const systemPrompt = `Act as a friendly native English conversation partner. 
Scenario: ${scenario}. Language complexity level: ${level}.
After responding naturally, if the user made grammar/vocabulary mistakes in their latest message, gently correct them in Vietnamese. 
You must ALWAYS respond ONLY in valid JSON format matching this schema:
{
  "reply": "<your natural English response>",
  "corrections": [
    {
      "original": "<original user text with mistake>",
      "corrected": "<corrected text>",
      "explanationVi": "<Vietnamese explanation of the mistake>"
    }
  ],
  "newVocabulary": [
    {
      "word": "<interesting word you used>",
      "phonetic": "<IPA phonetic>",
      "meaning": "<Vietnamese meaning>",
      "type": "<part of speech: n/v/adj/adv>"
    }
  ]
}`;

    return await this._callOpenAI(systemPrompt, null, messages);
  }

  async suggestVocabulary(paragraph) {
    const systemPrompt = `You are a vocabulary enhancement expert. Analyze the paragraph and suggest better, more advanced, or more natural vocabulary. 
You must ALWAYS respond ONLY in valid JSON format matching this schema:
{
  "analysis": "<brief overall assessment in Vietnamese>",
  "suggestions": [
    {
      "original": "<original word>",
      "suggested": "<better word>",
      "type": "<synonym|collocation|advanced|natural>",
      "phonetic": "<IPA phonetic of suggestion>",
      "meaningVi": "<Vietnamese meaning>",
      "exampleSentence": "<example sentence using the suggestion>",
      "reason": "<Vietnamese explanation of why it is better>"
    }
  ],
  "collocations": [
    {
      "phrase": "<useful phrase/collocation found or suggested>",
      "meaningVi": "<Vietnamese meaning>",
      "exampleSentence": "<example sentence>"
    }
  ],
  "improvedParagraph": "<full paragraph with improvements applied>"
}`;

    return await this._callOpenAI(systemPrompt, paragraph);
  }

  async analyzeErrors(message) {
    const systemPrompt = `Perform a quick error analysis for the following English message. 
You must ALWAYS respond ONLY in valid JSON format matching this schema:
{
  "errors": [
    {
      "original": "<mistake snippet>",
      "corrected": "<correction>",
      "type": "<grammar|spelling|vocabulary|style>",
      "explanationVi": "<Vietnamese explanation>"
    }
  ],
  "correctedMessage": "<full corrected message>",
  "tips": ["<array of brief tips in Vietnamese>"]
}`;

    return await this._callOpenAI(systemPrompt, message);
  }

  async gradeTOEICSpeaking(response, questionType, promptContent) {
    const systemPrompt = `Act as an expert TOEIC Speaking examiner. Evaluate the user's spoken response (provided as transcribed text) to the given question type and prompt.
Question Type: ${questionType}
Prompt: ${promptContent}

Evaluate based on pronunciation indicators (if spelled weirdly or grammar issues), grammar, vocabulary, cohesion, and relevance.
You must ALWAYS respond ONLY in valid JSON format matching this schema:
{
  "score": <number 0-3 for Q1-9, or 0-5 for Q10-11>,
  "strengths": ["<strength 1>", "<strength 2>"],
  "weaknesses": ["<weakness 1>", "<weakness 2>"],
  "errors": [
    {
      "original": "<error text>",
      "correction": "<corrected text>",
      "explanationVi": "<Vietnamese explanation and how to fix>"
    }
  ],
  "improvedResponse": "<a better, native-like response>",
  "overallFeedbackVi": "<Detailed overall feedback in Vietnamese>"
}`;
    return await this._callOpenAI(systemPrompt, response);
  }

  async gradeTOEICWriting(response, questionType, promptContent) {
    const systemPrompt = `Act as an expert TOEIC Writing examiner. Evaluate the user's written response to the given question type and prompt.
Question Type: ${questionType}
Prompt: ${promptContent}

Evaluate based on grammar, vocabulary, relevance, cohesion, and task completion.
You must ALWAYS respond ONLY in valid JSON format matching this schema:
{
  "score": <number 0-3 for Q1-5, 0-4 for Q6-7, or 0-5 for Q8>,
  "strengths": ["<strength 1>", "<strength 2>"],
  "weaknesses": ["<weakness 1>", "<weakness 2>"],
  "errors": [
    {
      "original": "<error text>",
      "correction": "<corrected text>",
      "explanationVi": "<Vietnamese explanation and how to fix>"
    }
  ],
  "improvedResponse": "<a better, native-like response>",
  "overallFeedbackVi": "<Detailed overall feedback in Vietnamese>"
}`;
    return await this._callOpenAI(systemPrompt, response);
  }
}

const aiService = new AiService();
