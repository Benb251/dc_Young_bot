const { ChannelType, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { getAIChatResponse } = require('./ai_helper.js');
const {
  forgetFact,
  listFacts,
  recallFacts,
  rememberFact,
} = require('./assistant_memory.js');
const { cancelReminder, createReminder, listReminders } = require('./assistant_reminders.js');
const { collectAssistantStatus, formatAssistantStatus } = require('./assistant_status.js');
const { createTask, listTasks, updateTaskStatus } = require('./assistant_tasks.js');
const { clearWarning, createWarning, listWarnings } = require('./assistant_warnings.js');

const ADMIN_ACTIONS = new Set([
  'assign_role',
  'assistant_status',
  'ban_member',
  'create_role',
  'create_task',
  'create_text_channel',
  'create_thread',
  'delete_messages',
  'diagnose_permissions',
  'clear_warning',
  'inspect_server',
  'kick_member',
  'list_channels',
  'list_tasks',
  'list_warnings',
  'lock_channel',
  'archive_thread',
  'pin_message',
  'remove_role',
  'rename_channel',
  'rename_thread',
  'cancel_reminder',
  'search_messages',
  'send_embed',
  'send_message',
  'set_channel_topic',
  'set_slowmode',
  'schedule_reminder',
  'summarize_channel',
  'timeout_member',
  'unlock_channel',
  'unpin_message',
  'warn_member',
  'complete_task',
  'cancel_task',
  'list_reminders',
]);

const DANGEROUS_ACTIONS = new Set([
  'assign_role',
  'ban_member',
  'create_role',
  'create_text_channel',
  'create_thread',
  'delete_messages',
  'clear_warning',
  'kick_member',
  'lock_channel',
  'archive_thread',
  'pin_message',
  'remove_role',
  'rename_channel',
  'rename_thread',
  'send_embed',
  'send_message',
  'set_channel_topic',
  'set_slowmode',
  'timeout_member',
  'unlock_channel',
  'unpin_message',
  'warn_member',
]);

function getActionType(action) {
  return action?.type || action?.action || '';
}

function isDangerousAction(action) {
  return DANGEROUS_ACTIONS.has(getActionType(action));
}

const PERMISSION_CHECKS = [
  ['ViewChannel', PermissionsBitField.Flags.ViewChannel],
  ['SendMessages', PermissionsBitField.Flags.SendMessages],
  ['ReadMessageHistory', PermissionsBitField.Flags.ReadMessageHistory],
  ['UseExternalEmojis', PermissionsBitField.Flags.UseExternalEmojis],
  ['EmbedLinks', PermissionsBitField.Flags.EmbedLinks],
  ['AttachFiles', PermissionsBitField.Flags.AttachFiles],
  ['ManageMessages', PermissionsBitField.Flags.ManageMessages],
  ['ManageChannels', PermissionsBitField.Flags.ManageChannels],
  ['ManageRoles', PermissionsBitField.Flags.ManageRoles],
  ['KickMembers', PermissionsBitField.Flags.KickMembers],
  ['BanMembers', PermissionsBitField.Flags.BanMembers],
  ['ModerateMembers', PermissionsBitField.Flags.ModerateMembers],
];

function getMissingPermissions(permissions, checks = PERMISSION_CHECKS) {
  if (!permissions) return checks.map(([name]) => name);
  return checks
    .filter(([, flag]) => !permissions.has(flag))
    .map(([name]) => name);
}

function formatPermissionLine(label, missing) {
  return missing.length
    ? `- ${label}: thiếu ${missing.join(', ')}`
    : `- ${label}: đủ quyền cần thiết`;
}

function isAdminMessage(message) {
  if (message.author.id === process.env.ADMIN_DISCORD_ID) return true;
  return Boolean(message.member?.permissions?.has(PermissionsBitField.Flags.Administrator));
}

function normalizeName(value) {
  return String(value || '')
    .replace(/[<@#&!>]/g, '')
    .trim()
    .toLowerCase();
}

function normalizeChannelName(name) {
  return String(name || '')
    .replace(/[<#>]/g, '')
    .replace(/^#/, '')
    .trim()
    .toLowerCase();
}

function normalizeChannelSlug(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}_-]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 90);
}

async function findChannel(guild, channelNameOrId) {
  if (!guild || !channelNameOrId) return null;
  const raw = String(channelNameOrId).replace(/[<#>]/g, '').trim();
  const byId = await guild.channels.fetch(raw).catch(() => null);
  if (byId) return byId;

  const wanted = normalizeChannelName(raw);
  return guild.channels.cache.find(channel => {
    const normalized = normalizeChannelName(channel.name);
    return normalized === wanted || normalized.includes(wanted);
  }) || null;
}

function extractMessageId(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const urlMatch = raw.match(/\/channels\/\d+\/\d+\/(\d+)/);
  if (urlMatch) return urlMatch[1];
  const idMatch = raw.match(/\d{15,25}/);
  return idMatch ? idMatch[0] : null;
}

function extractChannelIdFromMessageUrl(value) {
  const raw = String(value || '').trim();
  const urlMatch = raw.match(/\/channels\/\d+\/(\d+)\/\d+/);
  return urlMatch ? urlMatch[1] : null;
}

async function findMessageForAction(message, guild, args) {
  const messageRef = args.messageUrl || args.url || args.messageId || args.message_id;
  const channelIdFromUrl = extractChannelIdFromMessageUrl(messageRef);
  const channel = channelIdFromUrl
    ? await findChannel(guild, channelIdFromUrl)
    : args.channel || args.channel_name || args.channelId
      ? await findChannel(guild, args.channel || args.channel_name || args.channelId)
      : message.channel;
  const messageId = extractMessageId(messageRef)
    || args.id
    || message.reference?.messageId;
  if (!channel?.messages || !messageId) return null;
  return channel.messages.fetch(messageId).catch(() => null);
}

async function findRole(guild, roleNameOrId) {
  if (!guild || !roleNameOrId) return null;
  const raw = String(roleNameOrId).replace(/[<@&>]/g, '').trim();
  const roles = await guild.roles.fetch().catch(() => null);
  if (!roles) return null;
  const wanted = normalizeName(raw);
  return roles.get(raw)
    || roles.find(role => normalizeName(role.name) === wanted)
    || roles.find(role => normalizeName(role.name).includes(wanted))
    || null;
}

async function findMember(guild, memberNameOrId) {
  if (!guild || !memberNameOrId) return null;
  const raw = String(memberNameOrId).replace(/[<@!>]/g, '').trim();
  const byId = await guild.members.fetch(raw).catch(() => null);
  if (byId) return byId;

  const wanted = normalizeName(raw);
  const members = await guild.members.fetch({ query: raw, limit: 10 }).catch(() => null);
  return members?.find(member => {
    const username = normalizeName(member.user.username);
    const displayName = normalizeName(member.displayName);
    return username === wanted || displayName === wanted || displayName.includes(wanted);
  }) || null;
}

async function fetchChannelTranscript(channel, count = 50) {
  const limit = Math.min(Math.max(Number(count) || 50, 1), 100);
  const messages = await channel.messages.fetch({ limit });
  return messages
    .filter(message => !message.author.bot && message.content)
    .reverse()
    .map(message => `[${message.author.username}]: ${message.content}`)
    .join('\n');
}

function formatChannelType(type) {
  const labels = {
    [ChannelType.GuildText]: 'text',
    [ChannelType.GuildAnnouncement]: 'announcement',
    [ChannelType.GuildForum]: 'forum',
    [ChannelType.GuildCategory]: 'category',
    [ChannelType.GuildVoice]: 'voice',
    [ChannelType.GuildStageVoice]: 'stage',
  };
  return labels[type] || String(type);
}

function truncateLine(value, max = 220) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3)}...`;
}

function buildAssistantEmbed(args) {
  const embed = new EmbedBuilder();
  const title = String(args.title || '').trim();
  const description = String(args.description || args.content || '').trim();
  const color = String(args.color || '#5865F2').trim();

  if (title) embed.setTitle(title.slice(0, 256));
  if (description) embed.setDescription(description.slice(0, 4096));
  if (/^#[0-9a-f]{6}$/i.test(color)) embed.setColor(color);
  if (args.url) embed.setURL(String(args.url).slice(0, 2048));
  if (args.image) embed.setImage(String(args.image).slice(0, 2048));
  if (args.thumbnail) embed.setThumbnail(String(args.thumbnail).slice(0, 2048));
  if (args.footer) embed.setFooter({ text: String(args.footer).slice(0, 2048) });
  if (args.timestamp !== false) embed.setTimestamp();

  const fields = Array.isArray(args.fields) ? args.fields.slice(0, 10) : [];
  for (const field of fields) {
    const name = String(field.name || '').trim().slice(0, 256);
    const value = String(field.value || '').trim().slice(0, 1024);
    if (name && value) {
      embed.addFields({ name, value, inline: Boolean(field.inline) });
    }
  }

  return embed;
}

function normalizeAutoArchiveDuration(value) {
  const minutes = Number(value) || 1440;
  const allowed = [60, 1440, 4320, 10080];
  return allowed.includes(minutes) ? minutes : 1440;
}

function resolveForumTagIds(channel, tags) {
  if (!Array.isArray(tags) || !channel?.availableTags) return [];
  return tags
    .map(tag => String(tag).trim().toLowerCase())
    .filter(Boolean)
    .map(wanted => {
      const byId = channel.availableTags.find(item => item.id === wanted);
      if (byId) return byId.id;
      const byName = channel.availableTags.find(item => item.name.toLowerCase().includes(wanted));
      return byName?.id || null;
    })
    .filter(Boolean)
    .slice(0, 5);
}

async function summarizeChannel(channel, count) {
  const transcript = await fetchChannelTranscript(channel, count);
  if (!transcript) return 'Không tìm thấy tin nhắn chữ nào để tóm tắt.';

  return getAIChatResponse([
    {
      role: 'user',
      content: `Tóm tắt đoạn chat Discord sau bằng tiếng Việt. Nêu ý chính, quyết định, câu hỏi còn mở, và việc nên làm tiếp theo nếu có.\n\n${transcript}`,
    },
  ]);
}

async function resolveGuild(message) {
  const guild = message.guild
    || await message.client.guilds.fetch(process.env.GUILD_ID).catch(() => null);
  if (guild) {
    await guild.channels.fetch().catch(error => {
      console.error('[ASSISTANT TOOL] Failed to refresh guild channels:', error);
    });
  }
  return guild;
}

async function diagnoseBotPermissions(message, args) {
  const guild = await resolveGuild(message);
  if (!guild) return 'Không thể kết nối tới server để kiểm tra quyền.';

  const botMember = guild.members.me
    || await guild.members.fetchMe().catch(() => null)
    || await guild.members.fetch(message.client.user.id).catch(() => null);
  if (!botMember) return 'Không tìm thấy bot member trong server này.';

  const requestedChannel = args.channel || args.channel_name || args.channelId;
  const targetChannel = requestedChannel
    ? await findChannel(guild, requestedChannel)
    : message.guild
      ? message.channel
      : guild.systemChannel || guild.channels.cache.find(channel => channel.isTextBased?.());

  const guildMissing = getMissingPermissions(botMember.permissions);
  const channelMissing = targetChannel?.permissionsFor
    ? getMissingPermissions(targetChannel.permissionsFor(botMember), [
      ['ViewChannel', PermissionsBitField.Flags.ViewChannel],
      ['SendMessages', PermissionsBitField.Flags.SendMessages],
      ['ReadMessageHistory', PermissionsBitField.Flags.ReadMessageHistory],
      ['EmbedLinks', PermissionsBitField.Flags.EmbedLinks],
      ['AttachFiles', PermissionsBitField.Flags.AttachFiles],
      ['ManageMessages', PermissionsBitField.Flags.ManageMessages],
    ])
    : ['Không đọc được permission của kênh'];

  const textChannels = guild.channels.cache
    .filter(channel => channel.isTextBased?.())
    .map(channel => {
      const permissions = channel.permissionsFor?.(botMember);
      return {
        channel,
        canView: Boolean(permissions?.has(PermissionsBitField.Flags.ViewChannel)),
        canSend: Boolean(permissions?.has(PermissionsBitField.Flags.SendMessages)),
        canReadHistory: Boolean(permissions?.has(PermissionsBitField.Flags.ReadMessageHistory)),
      };
    });
  const visibleTextChannels = textChannels.filter(item => item.canView).length;
  const blockedChannels = textChannels
    .filter(item => !item.canView || !item.canSend || !item.canReadHistory)
    .slice(0, 12)
    .map(item => {
      const missing = [];
      if (!item.canView) missing.push('ViewChannel');
      if (!item.canSend) missing.push('SendMessages');
      if (!item.canReadHistory) missing.push('ReadMessageHistory');
      return `  - #${item.channel.name}: thiếu ${missing.join(', ')}`;
    });

  const botHighest = botMember.roles.highest;
  const manageableRoles = guild.roles.cache
    .filter(role => role.id !== guild.id && role.position < botHighest.position)
    .size;
  const unmanageableRoles = guild.roles.cache
    .filter(role => role.id !== guild.id && role.position >= botHighest.position)
    .size;
  const recommendedPermissions = new PermissionsBitField([
    PermissionsBitField.Flags.ViewChannel,
    PermissionsBitField.Flags.SendMessages,
    PermissionsBitField.Flags.ReadMessageHistory,
    PermissionsBitField.Flags.EmbedLinks,
    PermissionsBitField.Flags.AttachFiles,
    PermissionsBitField.Flags.ManageMessages,
    PermissionsBitField.Flags.ManageChannels,
    PermissionsBitField.Flags.ManageRoles,
    PermissionsBitField.Flags.KickMembers,
    PermissionsBitField.Flags.BanMembers,
    PermissionsBitField.Flags.ModerateMembers,
  ]);
  const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${message.client.user.id}&scope=bot%20applications.commands&permissions=${recommendedPermissions.bitfield.toString()}`;

  return [
    `Chẩn đoán quyền cho ${message.client.user.tag} trong server "${guild.name}":`,
    formatPermissionLine('Quyền cấp server', guildMissing),
    targetChannel
      ? formatPermissionLine(`Quyền trong #${targetChannel.name}`, channelMissing)
      : '- Quyền kênh: không tìm thấy kênh cần kiểm tra',
    `- Kênh text bot thấy được: ${visibleTextChannels}/${textChannels.length}`,
    `- Role cao nhất của bot: ${botHighest.name} (quản lý được ${manageableRoles} role, chưa quản lý được ${unmanageableRoles} role ngang/cao hơn)`,
    blockedChannels.length ? `- Một số kênh còn thiếu quyền:\n${blockedChannels.join('\n')}` : '- Các kênh text đã kiểm tra không thấy thiếu quyền đọc/gửi cơ bản.',
    `- Link mời lại với bộ quyền khuyến nghị: ${inviteUrl}`,
    'Lưu ý: để gán/gỡ role, role của bot phải nằm cao hơn role mục tiêu trong Server Settings > Roles.',
  ].join('\n');
}

async function inspectServer(message, args) {
  const guild = await resolveGuild(message);
  if (!guild) return 'Không thể kết nối tới server để đọc cấu trúc.';

  await guild.roles.fetch().catch(() => null);
  const channels = guild.channels.cache;
  const roles = guild.roles.cache
    .filter(role => role.id !== guild.id)
    .sort((a, b) => b.position - a.position);
  const textChannels = channels.filter(channel => [
    ChannelType.GuildText,
    ChannelType.GuildAnnouncement,
    ChannelType.GuildForum,
  ].includes(channel.type));
  const categories = channels
    .filter(channel => channel.type === ChannelType.GuildCategory)
    .sort((a, b) => a.position - b.position)
    .map(category => category.name)
    .slice(0, 15);
  const listedChannels = channels
    .sort((a, b) => a.position - b.position)
    .filter(channel => [
      ChannelType.GuildText,
      ChannelType.GuildAnnouncement,
      ChannelType.GuildForum,
      ChannelType.GuildVoice,
      ChannelType.GuildStageVoice,
    ].includes(channel.type))
    .map(channel => `- #${channel.name} (${formatChannelType(channel.type)}, ${channel.id})`)
    .slice(0, Number(args.limit || 30));
  const listedRoles = roles
    .map(role => `- ${role.name} (${role.id}, members=${role.members?.size ?? 0})`)
    .slice(0, Number(args.roleLimit || 20));

  return [
    `Tổng quan server "${guild.name}":`,
    `- ID: ${guild.id}`,
    `- Thành viên: ${guild.memberCount ?? 'unknown'}`,
    `- Kênh: ${channels.size} tổng, ${textChannels.size} text/forum/announcement`,
    `- Role: ${roles.size}`,
    `- Owner ID: ${guild.ownerId || 'unknown'}`,
    categories.length ? `- Category chính: ${categories.join(', ')}` : '- Category chính: chưa có hoặc bot chưa thấy',
    listedChannels.length ? `\nKênh tiêu biểu:\n${listedChannels.join('\n')}` : '\nKênh tiêu biểu: bot chưa thấy kênh nào',
    listedRoles.length ? `\nRole cao nhất/thường dùng:\n${listedRoles.join('\n')}` : '\nRole: bot chưa thấy role nào',
  ].join('\n');
}

async function searchMessages(message, args) {
  const guild = await resolveGuild(message);
  const query = String(args.query || args.keyword || '').trim();
  if (!query) return 'Thiếu từ khóa cần tìm trong chat.';

  const terms = query.toLowerCase().split(/\s+/).filter(term => term.length >= 2);
  const maxResults = Math.min(Math.max(Number(args.limit) || 8, 1), 20);
  const scanLimit = Math.min(Math.max(Number(args.count) || 50, 10), 100);
  const searchAll = Boolean(args.all || args.scope === 'guild');
  const requestedChannel = args.channel || args.channel_name || args.channelId;
  const baseChannels = [];

  if (requestedChannel) {
    const channel = await findChannel(guild, requestedChannel);
    if (channel) baseChannels.push(channel);
  } else if (searchAll && guild) {
    baseChannels.push(...guild.channels.cache
      .filter(channel => channel.isTextBased?.() && channel.messages)
      .sort((a, b) => a.position - b.position)
      .first(12));
  } else {
    baseChannels.push(message.channel);
  }

  const results = [];
  for (const channel of baseChannels) {
    if (!channel?.messages || !channel.isTextBased?.()) continue;
    const messages = await channel.messages.fetch({ limit: scanLimit }).catch(() => null);
    if (!messages) continue;

    for (const item of messages.values()) {
      if (!item.content || item.author?.bot) continue;
      const haystack = item.content.toLowerCase();
      const matches = terms.length
        ? terms.every(term => haystack.includes(term))
        : haystack.includes(query.toLowerCase());
      if (!matches) continue;
      results.push({
        channel,
        message: item,
      });
      if (results.length >= maxResults) break;
    }
    if (results.length >= maxResults) break;
  }

  if (!results.length) {
    return `Không tìm thấy tin nhắn gần đây khớp "${query}".`;
  }

  return [
    `Tìm thấy ${results.length} tin gần đây khớp "${query}":`,
    ...results.map(({ channel, message: found }) => {
      const timestamp = found.createdAt ? found.createdAt.toISOString() : 'unknown-time';
      return `- #${channel.name} ${timestamp} ${found.author.username}: ${truncateLine(found.content)} (${found.url})`;
    }),
  ].join('\n');
}

async function executeAssistantActions({ message, actions = [], context }) {
  const results = [];
  const canAdmin = isAdminMessage(message);
  const guild = await resolveGuild(message);

  for (const action of actions.slice(0, 6)) {
    const type = action.type || action.action;
    const args = action.args || action;

    if (!type) continue;
    if (ADMIN_ACTIONS.has(type) && !canAdmin) {
      results.push(`Từ chối ${type}: bạn chưa có quyền quản trị.`);
      continue;
    }

    try {
      if (type === 'diagnose_permissions') {
        results.push(await diagnoseBotPermissions(message, args));
      } else if (type === 'assistant_status') {
        const status = await collectAssistantStatus(message.client);
        results.push(formatAssistantStatus(status));
      } else if (type === 'inspect_server') {
        results.push(await inspectServer(message, args));
      } else if (type === 'search_messages') {
        results.push(await searchMessages(message, args));
      } else if (type === 'schedule_reminder') {
        const reminder = await createReminder({ args, context, message });
        results.push(reminder
          ? `Đã đặt reminder ${reminder.id.slice(0, 8)} lúc ${reminder.dueAt}: ${reminder.content}`
          : 'Không đặt được reminder: thiếu nội dung hoặc thời gian hợp lệ.');
      } else if (type === 'list_reminders') {
        const reminders = await listReminders(context, args.limit || 10);
        results.push(reminders.length
          ? reminders.map(reminder => `- ${reminder.id.slice(0, 8)} | ${reminder.dueAt} | ${reminder.content}`).join('\n')
          : 'Chưa có reminder nào đang chờ.');
      } else if (type === 'cancel_reminder') {
        const reminder = await cancelReminder(context, args.id || args.reminderId || args.reminder_id);
        results.push(reminder
          ? `Đã hủy reminder ${reminder.id.slice(0, 8)}.`
          : 'Không tìm thấy reminder đang chờ để hủy.');
      } else if (type === 'create_task') {
        const task = await createTask({ args, context });
        results.push(task
          ? `Đã tạo task ${task.id.slice(0, 8)} [${task.priority}]: ${task.title}`
          : 'Không tạo được task: thiếu tiêu đề.');
      } else if (type === 'list_tasks') {
        const tasks = await listTasks({
          context,
          status: args.status || 'open',
          query: args.query || '',
          limit: args.limit || 12,
        });
        results.push(tasks.length
          ? tasks.map(task => `- ${task.id.slice(0, 8)} | ${task.status} | ${task.priority} | ${task.title}`).join('\n')
          : 'Không có task phù hợp.');
      } else if (type === 'complete_task' || type === 'cancel_task') {
        const task = await updateTaskStatus({
          context,
          id: args.id || args.taskId || args.task_id,
          status: type === 'complete_task' ? 'done' : 'cancelled',
        });
        results.push(task
          ? `Đã cập nhật task ${task.id.slice(0, 8)} thành ${task.status}: ${task.title}`
          : 'Không tìm thấy task phù hợp để cập nhật.');
      } else if (type === 'send_message') {
        const channel = await findChannel(guild, args.channel || args.channel_name || args.channelId);
        if (!channel || !channel.isTextBased()) {
          results.push('Không tìm thấy kênh để gửi tin nhắn.');
          continue;
        }
        await channel.send(String(args.content || '').slice(0, 1900));
        results.push(`Đã gửi tin nhắn vào <#${channel.id}>.`);
      } else if (type === 'send_embed') {
        const channel = await findChannel(guild, args.channel || args.channel_name || args.channelId);
        if (!channel || !channel.isTextBased()) {
          results.push('Không tìm thấy kênh để gửi embed.');
          continue;
        }
        const embed = buildAssistantEmbed(args);
        const content = args.message ? String(args.message).slice(0, 1900) : undefined;
        await channel.send({ content, embeds: [embed] });
        results.push(`Đã gửi embed vào <#${channel.id}>.`);
      } else if (type === 'create_text_channel') {
        if (!guild) {
          results.push('Không thể kết nối tới server để tạo kênh.');
          continue;
        }
        const name = normalizeChannelSlug(args.name || args.channel || args.channel_name);
        if (!name) {
          results.push('Thiếu tên kênh cần tạo.');
          continue;
        }
        const parent = args.category ? await findChannel(guild, args.category) : null;
        const channel = await guild.channels.create({
          name,
          type: ChannelType.GuildText,
          parent: parent?.type === ChannelType.GuildCategory ? parent.id : undefined,
          topic: args.topic ? String(args.topic).slice(0, 1024) : undefined,
          reason: `Assistant command by ${message.author.tag}`,
        });
        results.push(`Đã tạo kênh <#${channel.id}>.`);
      } else if (type === 'create_thread') {
        const channel = await findChannel(guild, args.channel || args.channel_name || args.channelId) || message.channel;
        const name = String(args.name || args.title || '').trim().slice(0, 100);
        const content = String(args.content || args.message || args.description || '').trim().slice(0, 1900);
        if (!channel || !name) {
          results.push('Thiếu kênh hoặc tên thread cần tạo.');
          continue;
        }
        if (channel.type === ChannelType.GuildForum) {
          if (!content) {
            results.push('Forum post cần nội dung mở đầu.');
            continue;
          }
          const thread = await channel.threads.create({
            name,
            autoArchiveDuration: normalizeAutoArchiveDuration(args.autoArchiveDuration),
            appliedTags: resolveForumTagIds(channel, args.tags),
            message: { content },
            reason: `Assistant command by ${message.author.tag}`,
          });
          results.push(`Đã tạo forum post <#${thread.id}> trong #${channel.name}.`);
        } else if (channel.threads?.create) {
          const thread = await channel.threads.create({
            name,
            autoArchiveDuration: normalizeAutoArchiveDuration(args.autoArchiveDuration),
            reason: `Assistant command by ${message.author.tag}`,
          });
          if (content) await thread.send(content);
          results.push(`Đã tạo thread <#${thread.id}> trong <#${channel.id}>.`);
        } else {
          results.push('Kênh này không hỗ trợ tạo thread.');
        }
      } else if (type === 'rename_channel') {
        const channel = await findChannel(guild, args.channel || args.channel_name || args.channelId) || message.channel;
        const name = normalizeChannelSlug(args.name || args.new_name);
        if (!channel || !name || !channel.setName) {
          results.push('Không thể đổi tên kênh: thiếu kênh hoặc tên mới.');
          continue;
        }
        await channel.setName(name, `Assistant command by ${message.author.tag}`);
        results.push(`Đã đổi tên kênh thành #${name}.`);
      } else if (type === 'set_channel_topic') {
        const channel = await findChannel(guild, args.channel || args.channel_name || args.channelId) || message.channel;
        if (!channel || !channel.setTopic) {
          results.push('Kênh này không hỗ trợ đặt topic.');
          continue;
        }
        await channel.setTopic(String(args.topic || '').slice(0, 1024), `Assistant command by ${message.author.tag}`);
        results.push(`Đã cập nhật topic cho <#${channel.id}>.`);
      } else if (type === 'set_slowmode') {
        const channel = await findChannel(guild, args.channel || args.channel_name || args.channelId) || message.channel;
        const seconds = Math.min(Math.max(Number(args.seconds ?? args.rateLimitPerUser ?? args.slowmode) || 0, 0), 21600);
        if (!channel || !channel.setRateLimitPerUser) {
          results.push('Kênh này không hỗ trợ slowmode.');
          continue;
        }
        await channel.setRateLimitPerUser(seconds, `Assistant command by ${message.author.tag}`);
        results.push(seconds > 0
          ? `Đã đặt slowmode ${seconds} giây cho <#${channel.id}>.`
          : `Đã tắt slowmode cho <#${channel.id}>.`);
      } else if (type === 'lock_channel' || type === 'unlock_channel') {
        const channel = await findChannel(guild, args.channel || args.channel_name || args.channelId) || message.channel;
        if (!guild || !channel?.permissionOverwrites?.edit) {
          results.push('Không thể cập nhật quyền gửi tin của kênh này.');
          continue;
        }
        const everyoneRole = guild.roles.everyone;
        if (type === 'lock_channel') {
          await channel.permissionOverwrites.edit(everyoneRole, {
            SendMessages: false,
          }, { reason: `Assistant command by ${message.author.tag}` });
          results.push(`Đã khóa gửi tin cho @everyone trong <#${channel.id}>.`);
        } else {
          await channel.permissionOverwrites.edit(everyoneRole, {
            SendMessages: null,
          }, { reason: `Assistant command by ${message.author.tag}` });
          results.push(`Đã gỡ khóa gửi tin cho @everyone trong <#${channel.id}>.`);
        }
      } else if (type === 'pin_message' || type === 'unpin_message') {
        const targetMessage = await findMessageForAction(message, guild, args);
        if (!targetMessage) {
          results.push('Không tìm thấy tin nhắn cần ghim/gỡ ghim. Hãy reply vào tin đó hoặc đưa message URL/ID.');
          continue;
        }
        if (type === 'pin_message') {
          await targetMessage.pin(`Assistant command by ${message.author.tag}`);
          results.push(`Đã ghim tin nhắn: ${targetMessage.url}`);
        } else {
          await targetMessage.unpin(`Assistant command by ${message.author.tag}`);
          results.push(`Đã gỡ ghim tin nhắn: ${targetMessage.url}`);
        }
      } else if (type === 'rename_thread' || type === 'archive_thread') {
        const target = args.thread || args.threadId || args.channel || args.channelId
          ? await findChannel(guild, args.thread || args.threadId || args.channel || args.channelId)
          : message.channel;
        if (!target?.isThread?.()) {
          results.push('Không tìm thấy thread cần xử lý.');
          continue;
        }
        if (type === 'rename_thread') {
          const name = String(args.name || args.title || '').trim().slice(0, 100);
          if (!name) {
            results.push('Thiếu tên thread mới.');
            continue;
          }
          await target.setName(name, `Assistant command by ${message.author.tag}`);
          results.push(`Đã đổi tên thread thành "${name}".`);
        } else {
          await target.setArchived(true, `Assistant command by ${message.author.tag}`);
          results.push(`Đã archive thread "${target.name}".`);
        }
      } else if (type === 'delete_messages') {
        const count = Math.min(Math.max(Number(args.count) || 0, 1), 100);
        if (!message.channel || !message.channel.bulkDelete) {
          results.push('Kênh hiện tại không hỗ trợ xóa hàng loạt.');
          continue;
        }
        await message.channel.bulkDelete(count, true);
        results.push(`Đã xóa tối đa ${count} tin nhắn gần nhất trong kênh hiện tại.`);
      } else if (type === 'assign_role' || type === 'remove_role') {
        const member = await findMember(guild, args.member || args.user || args.userId);
        const role = await findRole(guild, args.role || args.role_name || args.roleId);
        if (!member || !role) {
          results.push(`Không tìm thấy member hoặc role để ${type === 'assign_role' ? 'gán' : 'gỡ'}.`);
          continue;
        }
        if (type === 'assign_role') {
          await member.roles.add(role, `Assistant command by ${message.author.tag}`);
          results.push(`Đã gán role ${role.name} cho ${member.displayName}.`);
        } else {
          await member.roles.remove(role, `Assistant command by ${message.author.tag}`);
          results.push(`Đã gỡ role ${role.name} khỏi ${member.displayName}.`);
        }
      } else if (type === 'create_role') {
        if (!guild) {
          results.push('Không thể kết nối tới server để tạo role.');
          continue;
        }
        const name = String(args.name || args.role || '').trim().slice(0, 100);
        if (!name) {
          results.push('Thiếu tên role cần tạo.');
          continue;
        }
        const role = await guild.roles.create({
          name,
          color: args.color || undefined,
          mentionable: Boolean(args.mentionable),
          reason: `Assistant command by ${message.author.tag}`,
        });
        results.push(`Đã tạo role ${role.name}.`);
      } else if (type === 'kick_member' || type === 'ban_member') {
        const member = await findMember(guild, args.member || args.user || args.userId);
        if (!member) {
          results.push(`Không tìm thấy member để ${type === 'kick_member' ? 'kick' : 'ban'}.`);
          continue;
        }
        const reason = String(args.reason || `Assistant command by ${message.author.tag}`).slice(0, 512);
        if (type === 'kick_member') {
          await member.kick(reason);
          results.push(`Đã kick ${member.displayName}.`);
        } else {
          await member.ban({
            deleteMessageSeconds: Math.min(Math.max(Number(args.deleteMessageSeconds) || 0, 0), 604800),
            reason,
          });
          results.push(`Đã ban ${member.displayName}.`);
        }
      } else if (type === 'timeout_member') {
        const member = await findMember(guild, args.member || args.user || args.userId);
        const minutes = Math.min(Math.max(Number(args.minutes) || 5, 1), 10080);
        if (!member?.timeout) {
          results.push('Không tìm thấy member hoặc bot không thể timeout member này.');
          continue;
        }
        await member.timeout(minutes * 60 * 1000, String(args.reason || `Assistant command by ${message.author.tag}`).slice(0, 512));
        results.push(`Đã timeout ${member.displayName} trong ${minutes} phút.`);
      } else if (type === 'warn_member') {
        const member = await findMember(guild, args.member || args.user || args.userId);
        if (!guild || !member) {
          results.push('Không tìm thấy member để cảnh cáo.');
          continue;
        }
        const warning = await createWarning({
          guildId: guild.id,
          memberId: member.id,
          moderatorId: message.author.id,
          reason: args.reason || args.content || args.message,
          contextMessageId: message.id,
        });
        if (!warning) {
          results.push('Không tạo được warning hợp lệ.');
          continue;
        }
        if (args.notify !== false) {
          await member.send(`Bạn đã nhận cảnh cáo trong server ${guild.name}: ${warning.reason}`).catch(() => null);
        }
        results.push(`Đã cảnh cáo ${member.displayName}. Warning ID: ${warning.id.slice(0, 8)}.`);
      } else if (type === 'list_warnings') {
        const member = args.member || args.user || args.userId
          ? await findMember(guild, args.member || args.user || args.userId)
          : null;
        const warnings = await listWarnings({
          guildId: guild?.id,
          memberId: member?.id || args.memberId || null,
          limit: args.limit || 10,
        });
        results.push(warnings.length
          ? warnings.map(warning => `- ${warning.id.slice(0, 8)} | <@${warning.memberId}> | ${warning.createdAt} | ${warning.reason}`).join('\n')
          : 'Chưa có warning đang active phù hợp.');
      } else if (type === 'clear_warning') {
        const warning = await clearWarning({
          guildId: guild?.id,
          id: args.id || args.warningId || args.warning_id,
          moderatorId: message.author.id,
        });
        results.push(warning
          ? `Đã xoá warning ${warning.id.slice(0, 8)} của <@${warning.memberId}>.`
          : 'Không tìm thấy warning active để xoá.');
      } else if (type === 'summarize_channel') {
        const channel = await findChannel(guild, args.channel || args.channel_name || args.channelId) || message.channel;
        if (!channel?.messages) {
          results.push('Không thể đọc tin nhắn từ kênh cần tóm tắt.');
          continue;
        }
        const summary = await summarizeChannel(channel, args.count);
        results.push(`Tóm tắt <#${channel.id}>:\n${summary}`);
      } else if (type === 'list_channels') {
        if (!guild) {
          results.push('Không thể kết nối tới server để liệt kê kênh.');
          continue;
        }
        const channels = guild.channels.cache
          .filter(channel => [ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum].includes(channel.type))
          .map(channel => `#${channel.name} (${channel.id})`)
          .slice(0, 60)
          .join('\n');
        results.push(`Các kênh bot thấy được:\n${channels}`);
      } else if (type === 'remember') {
        const fact = await rememberFact({
          scope: args.scope,
          title: args.title,
          content: args.content,
          tags: args.tags,
          context,
        });
        results.push(fact ? `Đã ghi nhớ: ${fact.title}.` : 'Không có nội dung hợp lệ để ghi nhớ.');
      } else if (type === 'recall_memory') {
        const facts = await recallFacts(args.query || '', context, args.limit || 6);
        results.push(facts.length
          ? facts.map(fact => `- ${fact.title}: ${fact.content}`).join('\n')
          : 'Chưa tìm thấy trí nhớ liên quan.');
      } else if (type === 'list_memory') {
        const facts = await listFacts({ query: args.query || '', context, limit: args.limit || 12 });
        results.push(facts.length
          ? facts.map(fact => `- ${fact.id.slice(0, 8)} | [${fact.scope}] ${fact.title}: ${fact.content}`).join('\n')
          : 'Chưa có trí nhớ nào phù hợp trong phạm vi hiện tại.');
      } else if (type === 'forget_memory') {
        const fact = await forgetFact({
          id: args.id || args.memoryId || args.memory_id,
          query: args.query || '',
          context,
        });
        results.push(fact
          ? `Đã quên memory ${fact.id.slice(0, 8)}: ${fact.title}.`
          : 'Không tìm thấy đúng một memory phù hợp để quên.');
      } else {
        results.push(`Chưa hỗ trợ hành động: ${type}.`);
      }
    } catch (error) {
      console.error(`[ASSISTANT TOOL] ${type} failed:`, error);
      results.push(`Lỗi khi chạy ${type}: ${error.message}`);
    }
  }

  return results;
}

module.exports = {
  executeAssistantActions,
  getActionType,
  isDangerousAction,
  isAdminMessage,
};
