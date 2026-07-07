const fetch = require('node-fetch');

// Helper chuyển ảnh từ Discord URL sang Base64 cho Grok đọc
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

async function getAIChatResponse(messages, imageUrls = []) {
  const endpoint = process.env.AI_ENDPOINT || 'http://localhost:20128/v1';
  const model = process.env.AI_MODEL || 'xai/grok-4';
  const systemPrompt = process.env.AI_SYSTEM_PROMPT || 'Bạn là trợ lý AI.';

  const contentArray = [];
  
  // Lấy tin nhắn cuối cùng từ phía user để đính kèm hình ảnh
  const userMessage = messages[messages.length - 1];
  
  if (imageUrls.length > 0) {
    contentArray.push({ type: 'text', text: userMessage.content });
    for (const url of imageUrls) {
      const base64Image = await imageUrlToBase64(url);
      if (base64Image) {
        contentArray.push({
          type: 'image_url',
          image_url: {
            url: base64Image
          }
        });
      }
    }
    // Ghi đè cấu trúc user content thành mảng Multimodal
    userMessage.content = contentArray;
  }

  const apiMessages = [
    { role: 'system', content: systemPrompt },
    ...messages
  ];

  try {
    const response = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: apiMessages,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI API error (${response.status}): ${errorText}`);
    }

    const responseText = await response.text();
    
    // API 9router có thể đính kèm "data: [DONE]" ở cuối text, cần lọc sạch trước khi parse JSON
    let cleanJsonText = responseText.trim();
    if (cleanJsonText.endsWith('data: [DONE]')) {
      cleanJsonText = cleanJsonText.substring(0, cleanJsonText.lastIndexOf('data: [DONE]')).trim();
    }

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
    throw new Error('Invalid response structure from AI API');
  } catch (error) {
    console.error('[AI ERROR]', error);
    return 'Hic, có lỗi xảy ra khi kết nối tới bộ não AI rồi bác ơi. Chờ em kiểm tra lại nhé! 🧠💦';
  }
}

async function classifyCrosspostTopic(title, content, imageUrls = []) {
  const systemPrompt = `Bạn là một mô hình phân loại chủ đề bài viết chuyên nghiệp. Hãy đọc tiêu đề, nội dung và xem hình ảnh (nếu có) để phân loại xem bài viết này đang thảo luận hoặc sử dụng phần mềm nào trong danh sách dưới đây.
Danh sách phần mềm hợp lệ:
- Blender
- Maya
- ZBrush
- Substance
- 2D Design

Yêu cầu bắt buộc:
1. Bạn CHỈ ĐƯỢC trả về chính xác tên một trong các phần mềm trên (ví dụ: "Blender" hoặc "Maya").
2. Nếu không liên quan hoặc không thể xác định được phần mềm nào, hãy trả về chính xác từ: "Unknown".
3. Tuyệt đối không viết thêm bất kỳ từ ngữ, giải thích hay định dạng nào khác. Chỉ trả về 1 từ duy nhất.`;

  const prompt = `Tiêu đề: "${title}"\nNội dung: "${content}"`;

  try {
    const responseText = await getAIChatResponse(
      [{ role: 'user', content: prompt }],
      imageUrls
    );

    const result = responseText.trim();
    
    // Lọc bỏ ký tự đặc biệt hoặc dấu ngoặc nếu AI tự chèn
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

module.exports = { getAIChatResponse, classifyCrosspostTopic };
