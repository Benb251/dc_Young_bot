const { getAIChatResponse } = require('./ai_helper.js');
const { appendConversationTurn, getConversationContext, recallFacts } = require('./assistant_memory.js');
const {
  executeAssistantActions,
  isAdminMessage,
  isDangerousAction,
} = require('./assistant_tools.js');
const { autoRememberFromTurn } = require('./assistant_auto_memory.js');
const {
  buildConfirmationComponents,
  clearPendingConfirmation,
  clearPendingConfirmationByToken,
  consumePendingConfirmation,
  consumePendingConfirmationByToken,
  createPendingConfirmation,
  disabledConfirmationComponents,
  getPendingConfirmation,
  getPendingConfirmationByToken,
  isCancelMessage,
  isConfirmationMessage,
  parseConfirmButtonId,
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
- { "type": "analyze_server", "question": "mục tiêu hoặc câu hỏi của admin", "limit": 50, "roleLimit": 35 }
- { "type": "learn_server", "notes": "ghi chú thêm của admin nếu có", "limit": 50, "roleLimit": 35 }
- { "type": "inspect_member", "member": "id/mention/tên member", "warningLimit": 5 }
- { "type": "fetch_url", "url": "https://...", "question": "tóm tắt/draft lại/resource hub/điểm chính" }
- { "type": "search_messages", "query": "từ khóa", "channel": "tên hoặc id kênh tùy chọn", "count": 50, "limit": 8, "all": false }
- { "type": "schedule_reminder", "content": "nội dung cần nhắc", "when": "20 phút|2h|2026-07-09T10:00:00+07:00" }
- { "type": "list_reminders", "limit": 10 }
- { "type": "cancel_reminder", "id": "mã reminder" }
- { "type": "create_task", "title": "việc cần làm", "details": "mô tả tùy chọn", "priority": "low|normal|high|urgent", "scope": "guild|channel|user|global", "tags": ["tag"] }
- { "type": "list_tasks", "status": "open|done|cancelled|all", "query": "từ khóa tùy chọn", "limit": 12 }
- { "type": "complete_task", "id": "mã task" }
- { "type": "cancel_task", "id": "mã task" }
- { "type": "create_text_channel", "name": "ten-kenh", "category": "tên hoặc id category", "topic": "topic tùy chọn" }
- { "type": "create_category", "name": "Tên category" }
- { "type": "create_forum_channel", "name": "ten-forum", "category": "category tùy chọn", "topic": "mô tả", "tags": ["tag1"] }
- { "type": "move_channel", "channel": "kênh", "category": "category đích hoặc none" }
- { "type": "delete_channel", "channel": "kênh hoặc category" }
- { "type": "set_channel_permissions", "channel": "kênh", "target": "@everyone|role|member", "allow": ["ViewChannel"], "deny": ["SendMessages"], "clear": false }
- { "type": "create_thread", "channel": "kênh text/forum", "name": "tên thread/post", "content": "nội dung mở đầu", "tags": ["tag forum tùy chọn"], "autoArchiveDuration": 1440 }
- { "type": "publish_url_to_forum", "url": "https://...", "channel": "kênh forum/text hoặc id kênh", "question": "dịch/tái biên tập thành bài resource tiếng Việt", "exact": true, "tags": ["tag forum tùy chọn"], "imageLimit": 6 }
- { "type": "rename_channel", "channel": "kênh", "name": "tên mới" }
- { "type": "set_channel_topic", "channel": "kênh", "topic": "topic mới" }
- { "type": "set_slowmode", "channel": "kênh tùy chọn", "seconds": 10 }
- { "type": "lock_channel", "channel": "kênh tùy chọn" }
- { "type": "unlock_channel", "channel": "kênh tùy chọn" }
- { "type": "bulk_lock_channels", "channels": ["kênh1", "kênh2"] }
- { "type": "pin_message", "messageId": "id/url tùy chọn", "channel": "kênh tùy chọn" }
- { "type": "unpin_message", "messageId": "id/url tùy chọn", "channel": "kênh tùy chọn" }
- { "type": "edit_message", "messageId": "id/url hoặc reply", "content": "nội dung mới", "title": "nếu embed", "description": "nếu embed" }
- { "type": "delete_message", "messageId": "id/url hoặc reply" }
- { "type": "delete_thread", "thread": "id/tên/link bài forum hoặc thread" }
- { "type": "rename_thread", "thread": "id/tên tùy chọn", "name": "tên mới" }
- { "type": "archive_thread", "thread": "id/tên tùy chọn" }
- { "type": "unarchive_thread", "thread": "id/tên tùy chọn" }
- { "type": "lock_thread", "thread": "id/tên tùy chọn" }
- { "type": "unlock_thread", "thread": "id/tên tùy chọn" }
- { "type": "set_thread_tags", "thread": "id tùy chọn", "tags": ["tên tag forum"] }
- { "type": "list_threads", "channel": "kênh forum/text", "limit": 15 }
- { "type": "mark_thread_solved", "thread": "id tùy chọn nếu không đứng trong thread" }
- { "type": "assign_role", "member": "id/mention/tên", "role": "id/mention/tên role" }
- { "type": "remove_role", "member": "id/mention/tên", "role": "id/mention/tên role" }
- { "type": "create_role", "name": "tên role", "color": "#5865F2", "mentionable": false }
- { "type": "edit_role", "role": "id/tên", "newName": "tên mới", "color": "#5865F2", "hoist": false, "mentionable": false, "permissions": ["ViewChannel", "SendMessages"] }
- { "type": "kick_member", "member": "id/mention/tên", "reason": "lý do" }
- { "type": "ban_member", "member": "id/mention/tên", "reason": "lý do", "deleteMessageSeconds": 0 }
- { "type": "unban_member", "member": "user id", "reason": "lý do" }
- { "type": "timeout_member", "member": "id/mention/tên", "minutes": 10, "reason": "lý do" }
- { "type": "remove_timeout", "member": "id/mention/tên", "reason": "lý do" }
- { "type": "set_nickname", "member": "id/mention/tên", "nickname": "nick mới hoặc rỗng để xóa" }
- { "type": "dm_member", "member": "id/mention/tên", "content": "nội dung DM" }
- { "type": "list_bans", "limit": 15 }
- { "type": "warn_member", "member": "id/mention/tên", "reason": "lý do", "notify": true }
- { "type": "list_warnings", "member": "id/mention/tên tùy chọn", "limit": 10 }
- { "type": "clear_warning", "id": "mã warning" }
- { "type": "send_roles_panel", "channel": "kênh tùy chọn" }
- { "type": "send_visa_panel", "channel": "kênh tùy chọn" }
- { "type": "send_rules_panel", "channel": "kênh tùy chọn", "title": "tiêu đề", "description": "nội dung rules" }
- { "type": "remember", "scope": "global|guild|channel|user", "title": "ngắn", "content": "điều cần nhớ", "tags": ["tag"] }
- { "type": "recall_memory", "query": "từ khóa", "limit": 5 }
- { "type": "list_memory", "query": "từ khóa tùy chọn", "limit": 12 }
- { "type": "forget_memory", "id": "mã memory", "query": "từ khóa thay thế khi không có id" }

Quy tắc hành động:
- Chỉ tạo action quản trị khi người dùng yêu cầu rõ ràng. Nếu thiếu kênh/member/role/nội dung, hỏi lại trong reply và để actions rỗng.
- Hệ thống có 3 tầng risk: safe (chạy ngay), write (chạy ngay trừ khi admin tắt auto-write), critical (luôn cần admin gõ "xác nhận"). Critical gồm: xóa kênh, xóa bài forum/thread (delete_thread), ban/kick/unban, set_channel_permissions, edit_role, bulk_lock, delete_messages bulk, publish_url_to_forum.
- Nếu admin muốn tạo category/forum, di chuyển kênh, gán permission overwrite, sửa role, unban, gỡ timeout, sửa/xóa 1 tin, gán tag thread, list thread, mark solved, gửi panel roles/visa/rules — dùng đúng tool tương ứng ở trên.
- Nếu admin muốn đăng thông báo đẹp, announcement, nội quy, update hoặc tin ghim dạng trình bày gọn, dùng send_embed thay vì send_message.
- Nếu admin muốn mở thread, tạo chủ đề thảo luận, tạo forum post hoặc bài hỏi đáp mới, dùng create_thread.
- Nếu admin muốn lấy một trang web public rồi đăng thành bài forum/thread tiếng Việt, resource hub, tutorial dịch/tái biên tập, hoặc giữ ảnh minh họa từ nguồn, dùng publish_url_to_forum. Nếu họ nói "dịch chính xác", "dịch đầy đủ", "giữ nguyên cấu trúc/nội dung", đặt exact=true và giữ channel/id kênh họ đưa. Đây là hành động đăng bài nên cần admin và hệ thống sẽ yêu cầu xác nhận.
- Nếu admin muốn ghim/gỡ ghim tin nhắn, dùng pin_message/unpin_message. Nếu họ reply vào một tin và nói "ghim tin này", không cần hỏi messageId.
- Nếu admin muốn sửa tin bot đã gửi hoặc xóa đúng một tin (reply/URL), dùng edit_message/delete_message.
- Nếu admin muốn xóa cả bài đăng forum / thread (ví dụ bài AutoRemesher, post tài nguyên), dùng delete_thread — không dùng delete_message. Có thể chỉ định tên bài, link thread, hoặc đứng/reply trong thread đó. Hành động critical cần xác nhận.
- Nếu admin muốn đổi tên hoặc archive/unarchive/lock thread hiện tại, dùng rename_thread/archive_thread/unarchive_thread/lock_thread/unlock_thread.
- Nếu admin muốn gán tag forum cho thread, dùng set_thread_tags. Nếu muốn đánh dấu Q&A đã giải quyết, dùng mark_thread_solved.
- Nếu admin muốn gửi bảng chọn role / visa / nội quy, dùng send_roles_panel / send_visa_panel / send_rules_panel.
- Nếu admin hỏi bot đang chạy ổn không, đang dùng model gì, uptime, store memory/reminder/warning, health check, dùng assistant_status.
- Nếu admin hỏi bot đang thiếu quyền gì, vì sao không quản lý được server/kênh/role, hoặc muốn kiểm tra setup cộng đồng, dùng diagnose_permissions.
- Nếu admin hỏi server đang có cấu trúc gì, có những kênh/role nào, hoặc cần bot tự hiểu cộng đồng trước khi đề xuất, dùng inspect_server.
- Nếu admin hỏi "bây giờ nên làm gì", "giai đoạn tiếp theo", "phân tích server", "lập roadmap", hoặc muốn bot tư vấn vận hành cộng đồng dựa trên server hiện tại, dùng analyze_server.
- Nếu admin bảo "học server này", "ghi nhớ cấu trúc server", "lưu hồ sơ cộng đồng", hoặc muốn bot nhớ bối cảnh server cho lần sau, dùng learn_server.
- Nếu admin hỏi về một member cụ thể, muốn check role/quyền/ngày tham gia/warning, hoặc reply vào tin nhắn và nói "check bạn này", dùng inspect_member.
- Nếu người dùng đưa URL web public và muốn đọc/tóm tắt/draft lại/biến thành resource hub, dùng fetch_url.
- Nếu admin hỏi "ai đã nói gì", "tìm lại", "lục chat", hoặc cần bằng chứng từ tin nhắn gần đây, dùng search_messages.
- Nếu admin muốn nhắc việc/hẹn giờ/follow-up sau, dùng schedule_reminder. Nếu thiếu nội dung hoặc thời gian, hỏi lại.
- Nếu admin muốn xem hoặc hủy nhắc việc, dùng list_reminders hoặc cancel_reminder.
- Nếu admin muốn tạo backlog/todo/kế hoạch vận hành server, dùng create_task. Nếu họ hỏi việc cần làm hoặc đánh dấu xong/hủy việc, dùng list_tasks/complete_task/cancel_task.
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

async function splitAndReply(message, text, options = {}) {
  const chunks = [];
  const normalized = String(text || '').trim() || 'Mình chưa có phản hồi phù hợp.';
  let remaining = normalized;
  while (remaining.length > 1900) {
    const cut = remaining.lastIndexOf('\n', 1900) > 1000 ? remaining.lastIndexOf('\n', 1900) : 1900;
    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut).trim();
  }
  chunks.push(remaining);

  let firstMessage = null;
  for (let i = 0; i < chunks.length; i += 1) {
    const payload = { content: chunks[i] };
    // Attach buttons only on the last chunk so the prompt + buttons stay together.
    if (options.components && i === chunks.length - 1) {
      payload.components = options.components;
    }
    const sent = i === 0
      ? await message.reply(payload)
      : await message.channel.send(payload);
    if (i === 0) firstMessage = sent;
  }
  return firstMessage;
}

function buildInteractionProxyMessage(interaction) {
  return {
    id: interaction.message?.id,
    author: interaction.user,
    member: interaction.member,
    channel: interaction.channel,
    guild: interaction.guild,
    client: interaction.client,
    content: '',
    url: interaction.message?.url,
    mentions: { users: { first: () => null } },
    reference: null,
  };
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
      triggerMessageId: message.id,
    });
    await auditAssistantEvent({
      message,
      actions,
      status: 'pending_confirmation',
      note: `Expires in ${Math.round(pending.ttlMs / 1000)} seconds. token=${pending.token}`,
    });

    const responseParts = [];
    if (decision.reply) responseParts.push(String(decision.reply));
    responseParts.push([
      'Mình đã chuẩn bị các hành động sau nhưng chưa chạy:',
      formatActionPreview(actions),
      `Bấm **Xác nhận** hoặc **Hủy** bên dưới (trong ${Math.round(pending.ttlMs / 1000)} giây).`,
      'Hoặc gõ `xác nhận` / `hủy` nếu không bấm được nút.',
    ].join('\n'));

    const finalResponse = responseParts.join('\n\n').trim();
    await appendConversationTurn(context, {
      role: 'assistant',
      content: finalResponse,
    });
    await splitAndReply(message, finalResponse, {
      components: buildConfirmationComponents(pending.token),
    });
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

/**
 * Handle confirmation / cancel buttons under pending assistant actions.
 * @returns {Promise<boolean>} true if this interaction was for assistant confirm
 */
async function handleAssistantConfirmationButton(interaction) {
  if (!interaction.isButton?.()) return false;
  const parsed = parseConfirmButtonId(interaction.customId);
  if (!parsed) return false;

  const { decision, token } = parsed;
  const livePending = getPendingConfirmationByToken(token);

  if (!livePending) {
    await interaction.update({
      content: `${interaction.message?.content || ''}\n\n⏱️ Yêu cầu xác nhận đã hết hạn hoặc đã xử lý.`,
      components: disabledConfirmationComponents(token),
    }).catch(async () => {
      await interaction.reply({
        content: '⏱️ Yêu cầu xác nhận đã hết hạn hoặc đã xử lý.',
        ephemeral: true,
      }).catch(() => null);
    });
    return true;
  }

  if (interaction.user.id !== livePending.userId) {
    await interaction.reply({
      content: 'Chỉ người yêu cầu hành động mới được bấm xác nhận/hủy.',
      ephemeral: true,
    }).catch(() => null);
    return true;
  }

  const proxyMessage = buildInteractionProxyMessage(interaction);
  const context = {
    guildId: livePending.guildId || interaction.guildId || null,
    channelId: livePending.channelId || interaction.channelId || null,
    userId: livePending.userId,
  };

  if (decision === 'cancel') {
    clearPendingConfirmationByToken(token);
    await auditAssistantEvent({
      message: proxyMessage,
      actions: livePending.actions,
      status: 'cancelled',
      note: 'User cancelled via button.',
    });
    const cancelText = 'Đã hủy yêu cầu đang chờ xác nhận.';
    await appendConversationTurn(context, { role: 'assistant', content: cancelText });
    await interaction.update({
      content: `${interaction.message?.content || ''}\n\n❌ ${cancelText}`,
      components: disabledConfirmationComponents(token, 'cancel'),
    }).catch(() => null);
    return true;
  }

  const consumed = consumePendingConfirmationByToken(token);
  if (!consumed) {
    await interaction.reply({ content: 'Yêu cầu đã được xử lý hoặc hết hạn.', ephemeral: true }).catch(() => null);
    return true;
  }

  await interaction.update({
    content: `${interaction.message?.content || ''}\n\n⏳ Đang thực hiện sau khi xác nhận...`,
    components: disabledConfirmationComponents(token, 'accept'),
  }).catch(() => null);

  const actionResults = await executeAssistantActions({
    message: proxyMessage,
    actions: consumed.actions,
    context,
  });
  await auditAssistantEvent({
    message: proxyMessage,
    actions: consumed.actions,
    actionResults,
    status: 'executed_after_confirmation',
    note: 'Confirmed via button.',
  });

  const finalResponse = actionResults.length
    ? `Đã xác nhận và thực hiện.\n\nKết quả hành động:\n${actionResults.join('\n')}`
    : 'Đã xác nhận, nhưng không có hành động nào để thực hiện.';
  await appendConversationTurn(context, { role: 'assistant', content: finalResponse });

  // Follow-up may exceed one message; send in chunks.
  let remaining = finalResponse;
  let first = true;
  while (remaining.length > 0) {
    const chunk = remaining.slice(0, 1900);
    remaining = remaining.slice(1900);
    if (first) {
      await interaction.followUp({ content: chunk }).catch(async () => {
        await interaction.channel?.send?.(chunk).catch(() => null);
      });
      first = false;
    } else {
      await interaction.channel?.send?.(chunk).catch(() => null);
    }
  }
  return true;
}

module.exports = {
  extractJson,
  handleAssistantConfirmationButton,
  handleAssistantMessage,
};
