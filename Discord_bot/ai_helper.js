const fetch = require('node-fetch');

const DEFAULT_AI_ERROR_MESSAGE = 'Hic, có lỗi xảy ra khi kết nối tới bộ não AI rồi bác ơi. Chờ em kiểm tra lại nhé! 🧠💦';

function getModelChain(options = {}) {
  const primary = options.model || process.env.AI_MODEL || 'xai/grok-4';
  const fallbacks = String(options.fallbackModels || process.env.AI_MODEL_FALLBACKS || '')
    .split(',')
    .map(model => model.trim())
    .filter(Boolean);
  return [...new Set([primary, ...fallbacks])];
}

function getRetryCount(options = {}) {
  const configured = Number(options.retries ?? process.env.AI_MAX_RETRIES ?? 1);
  if (!Number.isFinite(configured) || configured < 0) return 1;
  return Math.min(configured, 3);
}

function getTimeoutMs(options = {}) {
  const configured = Number(options.timeoutMs ?? process.env.AI_TIMEOUT_MS ?? 60_000);
  if (!Number.isFinite(configured) || configured <= 0) return 60_000;
  return Math.min(configured, 180_000);
}

function cleanRouterResponseText(responseText) {
  let cleanJsonText = String(responseText || '').trim();
  if (cleanJsonText.endsWith('data: [DONE]')) {
    cleanJsonText = cleanJsonText.substring(0, cleanJsonText.lastIndexOf('data: [DONE]')).trim();
  }

  if (cleanJsonText.startsWith('data:')) {
    cleanJsonText = cleanJsonText
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.startsWith('data:') && line !== 'data: [DONE]')
      .map(line => line.slice(5).trim())
      .join('');
  }

  return cleanJsonText;
}

async function imageUrlToBase64(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Fetch image status ${res.status}`);
    const buffer = await res.buffer();
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  } catch (error) {
    console.error('Failed to convert image to base64:', error);
    return null;
  }
}

async function buildApiMessages(messages, imageUrls = [], options = {}) {
  const systemPrompt = process.env.AI_SYSTEM_PROMPT || 'Bạn là trợ lý AI.';
  const includeDefaultSystem = options.includeDefaultSystem !== false;
  const clonedMessages = messages.map(message => ({ ...message }));
  const userMessage = clonedMessages[clonedMessages.length - 1];

  if (imageUrls.length > 0 && userMessage) {
    const contentArray = [{ type: 'text', text: userMessage.content }];
    for (const url of imageUrls) {
      const base64Image = await imageUrlToBase64(url);
      if (base64Image) {
        contentArray.push({
          type: 'image_url',
          image_url: { url: base64Image },
        });
      }
    }
    userMessage.content = contentArray;
  }

  return includeDefaultSystem
    ? [{ role: 'system', content: systemPrompt }, ...clonedMessages]
    : clonedMessages;
}

async function fetchChatCompletion({ endpoint, headers, model, apiMessages, options }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getTimeoutMs(options));

  try {
    const response = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: apiMessages,
        temperature: options.temperature ?? 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI API error (${response.status}) on ${model}: ${errorText}`);
    }

    const responseText = await response.text();
    const cleanJsonText = cleanRouterResponseText(responseText);

    let data;
    try {
      data = JSON.parse(cleanJsonText);
    } catch (parseError) {
      console.error('Failed to parse 9router response JSON:', cleanJsonText);
      throw parseError;
    }

    if (data.choices && data.choices[0] && data.choices[0].message) {
      return data.choices[0].message.content;
    }
    throw new Error(`Invalid response structure from AI API on ${model}`);
  } finally {
    clearTimeout(timeout);
  }
}

async function getAIChatResponse(messages, imageUrls = [], options = {}) {
  const endpoint = process.env.AI_ENDPOINT || 'http://localhost:20128/v1';
  const modelChain = getModelChain(options);
  const apiMessages = await buildApiMessages(messages, imageUrls, options);
  const headers = { 'Content-Type': 'application/json' };

  if (process.env.AI_API_KEY) {
    headers.Authorization = `Bearer ${process.env.AI_API_KEY}`;
  }

  const attemptsPerModel = getRetryCount(options) + 1;
  let lastError = null;
  for (const model of modelChain) {
    for (let attempt = 1; attempt <= attemptsPerModel; attempt += 1) {
      if (modelChain.length > 1 || attemptsPerModel > 1) {
        console.log(`[AI] Requesting model=${model} attempt=${attempt}/${attemptsPerModel}`);
      }
      try {
        return await fetchChatCompletion({ endpoint, headers, model, apiMessages, options });
      } catch (error) {
        lastError = error;
        console.error(`[AI ERROR] model=${model} attempt=${attempt}:`, error);
      }
    }
  }

  console.error('[AI ERROR] All models failed:', lastError);
  return options.errorMessage || DEFAULT_AI_ERROR_MESSAGE;
}

async function classifyCrosspostTopic(title, content, imageUrls = []) {
  const systemPrompt = `Bạn là mô hình phân loại chủ đề bài viết Discord về 3D/Game Art.
Chỉ trả về đúng một mục trong danh sách: Blender, Maya, ZBrush, Substance, 2D Design, Unknown.`;
  const prompt = `Tiêu đề: "${title}"\nNội dung: "${content}"`;

  try {
    const responseText = await getAIChatResponse(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      imageUrls,
      { includeDefaultSystem: false, temperature: 0.1 }
    );

    const result = responseText.trim();
    const validTopics = ['Blender', 'Maya', 'ZBrush', 'Substance', '2D Design'];
    for (const topic of validTopics) {
      if (result.toLowerCase().includes(topic.toLowerCase())) {
        return topic;
      }
    }
    return 'Unknown';
  } catch (error) {
    console.error('Error classifying topic:', error);
    return 'Unknown';
  }
}

async function parseAdminCommand(instruction) {
  const systemPrompt = `Bạn phân tích lệnh admin Discord thành JSON.
Trả về một object có action là send_message, summarize_channel, hoặc normal_chat.
Không markdown, không giải thích.`;

  try {
    const responseText = await getAIChatResponse(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: instruction },
      ],
      [],
      { includeDefaultSystem: false, temperature: 0.1 }
    );

    let cleanJson = responseText.trim();
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    }

    return JSON.parse(cleanJson);
  } catch (error) {
    console.error('Failed to parse admin command:', error);
    return { action: 'normal_chat' };
  }
}

module.exports = {
  cleanRouterResponseText,
  classifyCrosspostTopic,
  getAIChatResponse,
  getModelChain,
  parseAdminCommand,
};
