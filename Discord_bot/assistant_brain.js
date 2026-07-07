const { getAIChatResponse } = require('./ai_helper.js');
const { appendConversationTurn, getConversationContext, recallFacts } = require('./assistant_memory.js');
const {
  executeAssistantActions,
  isAdminMessage,
  isDangerousAction,
} = require('./assistant_tools.js');
const { autoRememberFromTurn } = require('./assistant_auto_memory.js');
const {
  clearPendingConfirmation,
  consumePendingConfirmation,
  createPendingConfirmation,
  getPendingConfirmation,
  isCancelMessage,
  isConfirmationMessage,
} = require('./assistant_confirmations.js');
const { auditAssistantEvent, describeAction } = require('./assistant_audit.js');

const ASSISTANT_SYSTEM_PROMPT = `
Bạn là "Đầu Não Tổ Young Phố", trợ lý AI thân thiện, chủ động và giỏi vận hành server Discord về 3D/Game Art/Design.

Tính cách:
- Nói tiếng Việt tự nhiên, ấm, gọn, rõ việc.
- Hữu ích như một mod/producer Discord: biết hỏi lại khi thiếu thông tin, biết hành động khi yêu cầu đủ rõ.
- Khi trả lời kiến thức 3D/design/workflow, ưu tiên lời khuyên thực dụng, từng bước, không lan man.

Bạn PHẢI trả về JSON hợp lệ, không markdown, không code block:
{
  "reply": "câu trả lời gửi lại Discord",
  "actions": []
}

Tool actions có thể dùng:
- { "type": "send_message", "channel": "tên hoặc id kênh", "content": "nội dung" }
- { "type": "send_embed", "channel": "tên hoặc id kênh", "title": "tiêu đề", "description": "nội dung", "color": "#5865F2", "fields": [{"name":"mục","value":"nội dung","inline":false}], "footer": "tùy chọn" }
- { "type": "summarize_channel", "channel": "tên hoặc id kênh", "count": 50 }
- { "type": "delete_messages", "count": 5 }
- { "type": "list_channels" }
- { "type": "assistant_status" }
- { "type": "diagnose_permissions", "channel": "tên hoặc id kênh tùy chọn" }
- { "type": "inspect_server", "limit": 30, "roleLimit": 20 }
- { "type": "search_messages", "query": "từ khóa", "channel": "tên hoặc id kênh tùy chọn", "count": 50, "limit": 8, "all": false }
- { "type": "schedule_reminder", "content": "nội dung cần nhắc", "when": "20 phút|2h|2026-07-09T10:00:00+07:00" }
- { "type": "list_reminders", "limit": 10 }
- { "type": "cancel_reminder", "id": "mã reminder" }
- { "type": "create_text_channel", "name": "ten-kenh", "category": "tên hoặc id category", "topic": "topic tùy chọn" }
- { "type": "rename_channel", "channel": "kênh", "name": "tên mới" }
- { "type": "set_channel_topic", "channel": "kênh", "topic": "topic mới" }
- { "type": "set_slowmode", "channel": "kênh tùy chọn", "seconds": 10 }
- { "type": "lock_channel", "channel": "kênh tùy chọn" }
- { "type": "unlock_channel", "channel": "kênh tùy chọn" }
- { "type": "pin_message", "messageId": "id/url tùy chọn", "channel": "kênh tùy chọn" }
- { "type": "unpin_message", "messageId": "id/url tùy chọn", "channel": "kênh tùy chọn" }
- { "type": "rename_thread", "thread": "id/tên tùy chọn", "name": "tên mới" }
- { "type": "archive_thread", "thread": "id/tên tùy chọn" }
- { "type": "assign_role", "member": "id/mention/tên", "role": "id/mention/tên role" }
- { "type": "remove_role", "member": "id/mention/tên", "role": "id/mention/tên role" }
- { "type": "create_role", "name": "tên role", "color": "#5865F2", "mentionable": false }
- { "type": "kick_member", "member": "id/mention/tên", "reason": "lý do" }
- { "type": "ban_member", "member": "id/mention/tên", "reason": "lý do", "deleteMessageSeconds": 0 }
- { "type": "timeout_member", "member": "id/mention/tên", "minutes": 10, "reason": "lý do" }
- { "type": "warn_member", "member": "id/mention/tên", "reason": "lý do", "notify": true }
- { "type": "list_warnings", "member": "id/mention/tên tùy chọn", "limit": 10 }
- { "type": "clear_warning", "id": "mã warning" }
- { "type": "remember", "scope": "global|guild|channel|user", "title": "ngắn", "content": "điều cần nhớ", "tags": ["tag"] }
- { "type": "recall_memory", "query": "từ khóa", "limit": 5 }
- { "type": "list_memory", "query": "từ khóa tùy chọn", "limit": 12 }
- { "type": "forget_memory", "id": "mã memory", "query": "từ khóa thay thế khi không có id" }

Quy tắc hành động:
- Chỉ tạo action quản trị khi người dùng yêu cầu rõ ràng. Nếu thiếu kênh/member/role/nội dung, hỏi lại trong reply và để actions rỗng.
- Nếu admin muốn đăng thông báo đẹp, announcement, nội quy, update hoặc tin ghim dạng trình bày gọn, dùng send_embed thay vì send_message.
- Nếu admin muốn ghim/gỡ ghim tin nhắn, dùng pin_message/unpin_message. Nếu họ reply vào một tin và nói "ghim tin này", không cần hỏi messageId.
- Nếu admin muốn đổi tên hoặc archive thread hiện tại, dùng rename_thread/archive_thread.
- Nếu admin hỏi bot đang chạy ổn không, đang dùng model gì, uptime, store memory/reminder/warning, health check, dùng assistant_status.
- Nếu admin hỏi bot đang thiếu quyền gì, vì sao không quản lý được server/kênh/role, hoặc muốn kiểm tra setup cộng đồng, dùng diagnose_permissions.
- Nếu admin hỏi server đang có cấu trúc gì, có những kênh/role nào, hoặc cần bot tự hiểu cộng đồng trước khi đề xuất, dùng inspect_server.
- Nếu admin hỏi "ai đã nói gì", "tìm lại", "lục chat", hoặc cần bằng chứng từ tin nhắn gần đây, dùng search_messages.
- Nếu admin muốn nhắc việc/hẹn giờ/follow-up sau, dùng schedule_reminder. Nếu thiếu nội dung hoặc thời gian, hỏi lại.
- Nếu admin muốn xem hoặc hủy nhắc việc, dùng list_reminders hoặc cancel_reminder.
- Nếu admin muốn xử lý vi phạm nhẹ trước khi timeout/kick/ban, dùng warn_member. Dùng list_warnings để xem lịch sử cảnh cáo, clear_warning để xoá cảnh cáo sai.
- Nếu người dùng nói "nhớ", "ghi nhớ", "lưu lại", hãy dùng remember.
- Nếu người dùng hỏi thông tin đã từng nói, dùng recall_memory hoặc dựa vào phần trí nhớ liên quan trong ngữ cảnh.
- Nếu admin muốn xem/quản lý trí nhớ của bot, dùng list_memory. Nếu admin bảo bot quên/xóa memory, dùng forget_memory.
- Không nói đã thực hiện hành động trước khi tool chạy. Hệ thống sẽ thêm kết quả hành động sau.
- Nếu chỉ trò chuyện/hỏi đáp, actions là [].
- Nếu yêu cầu nguy hiểm hoặc vượt quyền, từ chối ngắn gọn và không tạo action.
`.trim();

function extractJson(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const withoutFence = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  try {
    return JSON.parse(withoutFence);
  } catch {
    const first = withoutFence.indexOf('{');
    const last = withoutFence.lastIndexOf('}');
    if (first >= 0 && last > first) {
      return JSON.parse(withoutFence.slice(first, last + 1));
    }
    return null;
  }
}

function getImageUrls(message) {
  return message.attachments
    .filter(att => att.contentType && att.contentType.startsWith('image/'))
    .map(att => att.url);
}

function buildRuntimeContext(message, cleanContent, facts, conversation, admin) {
  const channelName = message.channel?.name ? `#${message.channel.name}` : 'DM';
  const guildName = message.guild?.name || 'DM';
  const memoryText = facts.length
    ? facts.map(fact => `- [${fact.scope}] ${fact.title}: ${fact.content}`).join('\n')
    : 'Chưa có trí nhớ liên quan.';
  const historyText = conversation.length
    ? conversation.map(turn => `${turn.role}: ${turn.content}`).join('\n')
    : 'Chưa có hội thoại gần đây.';

  return `
Ngữ cảnh Discord:
- Server: ${guildName}
- Kênh: ${channelName}
- Người dùng: ${message.author.username} (${message.author.id})
- Quyền admin: ${admin ? 'có' : 'không'}

Trí nhớ liên quan:
${memoryText}

Hội thoại gần đây:
${historyText}

Tin nhắn mới:
${cleanContent}
`.trim();
}

async function splitAndReply(message, text) {
  const chunks = [];
  const normalized = String(text || '').trim() || 'Mình chưa có phản hồi phù hợp.';
  let remaining = normalized;
  while (remaining.length > 1900) {
    const cut = remaining.lastIndexOf('\n', 1900) > 1000 ? remaining.lastIndexOf('\n', 1900) : 1900;
    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut).trim();
  }
  chunks.push(remaining);

  for (let i = 0; i < chunks.length; i += 1) {
    if (i === 0) {
      await message.reply(chunks[i]);
    } else {
      await message.channel.send(chunks[i]);
    }
  }
}

function formatActionPreview(actions) {
  return actions
    .map((action, index) => `${index + 1}. ${describeAction(action)}`)
    .join('\n');
}

function scheduleAutoMemory({ context, userText, assistantText, existingFacts }) {
  autoRememberFromTurn({ context, userText, assistantText, existingFacts })
    .then(savedFacts => {
      if (savedFacts.length) {
        console.log(`[ASSISTANT MEMORY] Auto-saved ${savedFacts.length} fact(s).`);
      }
    })
    .catch(error => {
      console.error('[ASSISTANT MEMORY] Auto-memory failed:', error);
    });
}

async function handleAssistantMessage(message, cleanContent) {
  const context = {
    guildId: message.guild?.id || null,
    channelId: message.channel?.id || null,
    userId: message.author.id,
  };
  const admin = isAdminMessage(message);

  if (isCancelMessage(cleanContent) && getPendingConfirmation(context)) {
    const pending = getPendingConfirmation(context);
    clearPendingConfirmation(context);
    await auditAssistantEvent({
      message,
      actions: pending.actions,
      status: 'cancelled',
      note: 'User cancelled pending assistant actions.',
    });
    await appendConversationTurn(context, {
      role: 'assistant',
      content: 'Đã hủy yêu cầu đang chờ xác nhận.',
    });
    await splitAndReply(message, 'Đã hủy yêu cầu đang chờ xác nhận.');
    return;
  }

  if (isConfirmationMessage(cleanContent) && getPendingConfirmation(context)) {
    const pending = consumePendingConfirmation(context);
    const actionResults = await executeAssistantActions({
      message,
      actions: pending.actions,
      context,
    });
    await auditAssistantEvent({
      message,
      actions: pending.actions,
      actionResults,
      status: 'executed_after_confirmation',
    });

    const finalResponse = actionResults.length
      ? `Đã xác nhận và thực hiện.\n\nKết quả hành động:\n${actionResults.join('\n')}`
      : 'Đã xác nhận, nhưng không có hành động nào để thực hiện.';
    await appendConversationTurn(context, { role: 'assistant', content: finalResponse });
    await splitAndReply(message, finalResponse);
    return;
  }

  const facts = await recallFacts(cleanContent, context, 8);
  const conversation = await getConversationContext(context);
  const imageUrls = getImageUrls(message);

  await appendConversationTurn(context, {
    role: 'user',
    content: cleanContent,
  });

  const runtimeContext = buildRuntimeContext(message, cleanContent, facts, conversation, admin);
  const raw = await getAIChatResponse([
    { role: 'system', content: ASSISTANT_SYSTEM_PROMPT },
    { role: 'user', content: runtimeContext },
  ], imageUrls, { includeDefaultSystem: false, temperature: 0.25 });

  let decision;
  try {
    decision = extractJson(raw);
  } catch (error) {
    console.error('[ASSISTANT] Failed to parse JSON decision:', error, raw);
  }

  if (!decision || typeof decision !== 'object') {
    await appendConversationTurn(context, { role: 'assistant', content: raw });
    await splitAndReply(message, raw);
    return;
  }

  const actions = Array.isArray(decision.actions) ? decision.actions : [];
  const hasDangerousAction = actions.some(isDangerousAction);

  if (hasDangerousAction) {
    const pending = createPendingConfirmation(context, {
      actions,
      reply: decision.reply,
    });
    await auditAssistantEvent({
      message,
      actions,
      status: 'pending_confirmation',
      note: `Expires in ${Math.round(pending.ttlMs / 1000)} seconds.`,
    });

    const responseParts = [];
    if (decision.reply) responseParts.push(String(decision.reply));
    responseParts.push([
      'Mình đã chuẩn bị các hành động sau nhưng chưa chạy:',
      formatActionPreview(actions),
      `Gõ "xác nhận" trong ${Math.round(pending.ttlMs / 1000)} giây để thực hiện, hoặc "hủy" để bỏ qua.`,
    ].join('\n'));

    const finalResponse = responseParts.join('\n\n').trim();
    await appendConversationTurn(context, {
      role: 'assistant',
      content: finalResponse,
    });
    await splitAndReply(message, finalResponse);
    scheduleAutoMemory({
      context,
      userText: cleanContent,
      assistantText: finalResponse,
      existingFacts: facts,
    });
    return;
  }

  const actionResults = await executeAssistantActions({
    message,
    actions,
    context,
  });
  await auditAssistantEvent({
    message,
    actions,
    actionResults,
    status: 'executed',
  });

  const responseParts = [];
  if (decision.reply) responseParts.push(String(decision.reply));
  if (actionResults.length) responseParts.push(`\nKết quả hành động:\n${actionResults.join('\n')}`);
  const finalResponse = responseParts.join('\n').trim() || 'Mình đã xử lý xong.';

  await appendConversationTurn(context, {
    role: 'assistant',
    content: finalResponse,
  });
  await splitAndReply(message, finalResponse);
  scheduleAutoMemory({
    context,
    userText: cleanContent,
    assistantText: finalResponse,
    existingFacts: facts,
  });
}

module.exports = {
  extractJson,
  handleAssistantMessage,
};
