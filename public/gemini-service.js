class GeminiService {
  constructor() {
    this.model = 'gemini-3.7-flash';
    this.endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent`;
    this.apiKeyStorageKey = 'vocabdaily_gemini_api_key';
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
      return { success: false, message: 'Vui lòng nhập API Key của Gemini.' };
    }

    // Validate key format
    if (!apiKey.startsWith('AIza') && !apiKey.startsWith('AQ.')) {
      return { success: false, message: 'API Key không đúng định dạng! Key Gemini thường bắt đầu bằng "AIza..." hoặc "AQ.". Hãy kiểm tra lại key từ Google AI Studio.' };
    }

    try {
      const response = await fetch(`${this.endpoint}?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Hello, this is a test connection. Reply with "OK".' }] }],
          generationConfig: {
            maxOutputTokens: 10
          }
        })
      });

      if (response.ok) {
        return { success: true, message: 'Kết nối thành công! ✅' };
      } else {
        // Try to get detailed error from response body
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
      return { success: false, message: 'Lỗi mạng hoặc không thể kết nối tới máy chủ Gemini.' };
    }
  }

  async _callGemini(systemPrompt, userContent, messages = null) {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('Vui lòng nhập API Key của Gemini.');
    }

    let contents = [];
    
    if (messages) {
      // Map existing messages to Gemini format
      contents = messages.map(msg => ({
        role: msg.role === 'model' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));
    } else {
      contents = [{
        role: 'user',
        parts: [{ text: userContent }]
      }];
    }

    const requestBody = {
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: contents,
      generationConfig: {
        responseMimeType: 'application/json',
      }
    };

    try {
      const response = await fetch(`${this.endpoint}?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorResult = this._handleApiError(response.status);
        throw new Error(errorResult.message);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!text) {
        throw new Error('Định dạng phản hồi từ API không hợp lệ.');
      }

      return this._parseJSON(text);
    } catch (error) {
      throw new Error(error.message || 'Lỗi không xác định khi gọi Gemini API.');
    }
  }

  _handleApiError(status) {
    let message = 'Lỗi không xác định từ Gemini API.';
    if (status === 401 || status === 403) {
      message = 'API Key không hợp lệ hoặc không có quyền truy cập.';
    } else if (status === 429) {
      message = 'Vượt quá giới hạn yêu cầu (Rate Limit). Vui lòng thử lại sau.';
    } else if (status >= 500) {
      message = 'Lỗi máy chủ Gemini. Vui lòng thử lại sau.';
    } else {
      message = `Lỗi từ Gemini API: Mã ${status}`;
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

    return await this._callGemini(systemPrompt, essay);
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

    return await this._callGemini(systemPrompt, null, messages);
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

    return await this._callGemini(systemPrompt, paragraph);
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

    return await this._callGemini(systemPrompt, message);
  }
}

const geminiService = new GeminiService();
