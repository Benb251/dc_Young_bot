const { ChannelType, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { getAIChatResponse } = require('./ai_helper.js');
const {
  forgetFact,
  listFacts,
  recallFacts,
  rememberFact,
  upsertFact,
} = require('./assistant_memory.js');
const { cancelReminder, createReminder, listReminders } = require('./assistant_reminders.js');
const { collectAssistantStatus, formatAssistantStatus } = require('./assistant_status.js');
const { createTask, listTasks, updateTaskStatus } = require('./assistant_tasks.js');
const { clearWarning, createWarning, listWarnings } = require('./assistant_warnings.js');
const { analyzeServer, generateServerProfile } = require('./assistant_server_advisor.js');
const { buildForumResourcePost, buildResourceMessageParts, summarizeUrl } = require('./assistant_web.js');
const { buildRolesPanelPayload, buildVisaPanelPayload, buildRulesPanelPayload } = require('./assistant_panels.js');
const { markThreadSolved, getStatusTagIds } = require('./assistant_qa_tags.js');

const ADMIN_ACTIONS = new Set([
  'analyze_server',
  'assign_role',
  'assistant_status',
  'ban_member',
  'bulk_lock_channels',
  'create_category',
  'create_forum_channel',
  'create_role',
  'create_task',
  'create_text_channel',
  'create_thread',
  'delete_channel',
  'delete_message',
  'delete_messages',
  'delete_thread',
  'diagnose_permissions',
  'clear_warning',
  'dm_member',
  'edit_message',
  'edit_role',
  'inspect_server',
  'inspect_member',
  'kick_member',
  'learn_server',
  'list_bans',
  'list_channels',
  'list_tasks',
  'list_threads',
  'list_warnings',
  'lock_channel',
  'lock_thread',
  'archive_thread',
  'mark_thread_solved',
  'move_channel',
  'pin_message',
  'publish_url_to_forum',
  'remove_role',
  'remove_timeout',
  'rename_channel',
  'rename_thread',
  'cancel_reminder',
  'search_messages',
  'send_embed',
  'send_message',
  'send_roles_panel',
  'send_rules_panel',
  'send_visa_panel',
  'set_channel_permissions',
  'set_channel_topic',
  'set_nickname',
  'set_slowmode',
  'set_thread_tags',
  'schedule_reminder',
  'summarize_channel',
  'timeout_member',
  'unarchive_thread',
  'unban_member',
  'unlock_channel',
  'unlock_thread',
  'unpin_message',
  'warn_member',
  'complete_task',
  'cancel_task',
  'list_reminders',
]);

/** Risk tiers: safe | write | critical. Unknown types default to critical. */
const ACTION_RISK = {
  analyze_server: 'safe',
  assistant_status: 'safe',
  diagnose_permissions: 'safe',
  fetch_url: 'safe',
  forget_memory: 'write',
  inspect_member: 'safe',
  inspect_server: 'safe',
  learn_server: 'write',
  list_bans: 'safe',
  list_channels: 'safe',
  list_memory: 'safe',
  list_reminders: 'safe',
  list_tasks: 'safe',
  list_threads: 'safe',
  list_warnings: 'safe',
  recall_memory: 'safe',
  remember: 'write',
  search_messages: 'safe',
  summarize_channel: 'safe',
  summarize_url: 'safe',

  assign_role: 'write',
  archive_thread: 'write',
  cancel_reminder: 'write',
  cancel_task: 'write',
  clear_warning: 'write',
  complete_task: 'write',
  create_category: 'write',
  create_forum_channel: 'write',
  create_role: 'write',
  create_task: 'write',
  create_text_channel: 'write',
  create_thread: 'write',
  delete_message: 'write',
  delete_thread: 'critical',
  dm_member: 'write',
  edit_message: 'write',
  lock_channel: 'write',
  lock_thread: 'write',
  mark_thread_solved: 'write',
  move_channel: 'write',
  pin_message: 'write',
  remove_role: 'write',
  remove_timeout: 'write',
  rename_channel: 'write',
  rename_thread: 'write',
  schedule_reminder: 'write',
  send_embed: 'write',
  send_message: 'write',
  send_roles_panel: 'write',
  send_rules_panel: 'write',
  send_visa_panel: 'write',
  set_channel_topic: 'write',
  set_nickname: 'write',
  set_slowmode: 'write',
  set_thread_tags: 'write',
  timeout_member: 'write',
  unarchive_thread: 'write',
  unlock_channel: 'write',
  unlock_thread: 'write',
  unpin_message: 'write',
  warn_member: 'write',

  ban_member: 'critical',
  bulk_lock_channels: 'critical',
  delete_channel: 'critical',
  delete_messages: 'critical',
  delete_thread: 'critical',
  edit_role: 'critical',
  kick_member: 'critical',
  publish_url_to_forum: 'critical',
  set_channel_permissions: 'critical',
  unban_member: 'critical',
};

async function resolveThreadForAction(message, guild, args = {}) {
  const ref = args.thread || args.threadId || args.thread_id || args.name || args.post || args.channel;
  if (ref) {
    const found = await findChannel(guild, ref);
    if (found?.isThread?.()) return found;
    // Message/thread URL: /channels/guild/threadId or /channels/guild/threadId/messageId
    const urlMatch = String(ref).match(/\/channels\/\d+\/(\d+)(?:\/\d+)?/);
    if (urlMatch) {
      const byId = await guild.channels.fetch(urlMatch[1]).catch(() => null);
      if (byId?.isThread?.()) return byId;
    }
    // Search active (+ recent archived) threads by title across guild
    const wanted = normalizeChannelName(ref);
    if (wanted && guild?.channels?.cache) {
      const threadParents = guild.channels.cache.filter(channel => (
        channel.type === ChannelType.GuildForum
        || channel.type === ChannelType.GuildText
        || channel.type === ChannelType.GuildAnnouncement
      ));
      for (const parent of threadParents.values()) {
        const active = await parent.threads?.fetchActive?.().catch(() => null);
        const matchActive = active?.threads?.find(thread => {
          const n = normalizeChannelName(thread.name);
          return n === wanted || n.includes(wanted) || wanted.includes(n);
        });
        if (matchActive) return matchActive;
      }
    }
  }
  if (message.channel?.isThread?.()) return message.channel;
  return null;
}

function getActionType(action) {
  return action?.type || action?.action || '';
}

function getActionRisk(action) {
  const type = getActionType(action);
  if (!type) return 'critical';
  return ACTION_RISK[type] || 'critical';
}

function isAutoWriteEnabled() {
  const raw = process.env.ASSISTANT_AUTO_WRITE;
  if (raw === undefined || raw === null || String(raw).trim() === '') return true;
  return !['0', 'false', 'no', 'off'].includes(String(raw).trim().toLowerCase());
}

function getMaxActions() {
  return Math.min(Math.max(Number(process.env.ASSISTANT_MAX_ACTIONS) || 10, 1), 20);
}

/** True when action must be staged for confirmation before execute. */
function isDangerousAction(action) {
  const risk = getActionRisk(action);
  if (risk === 'critical') return true;
  if (risk === 'write' && !isAutoWriteEnabled()) return true;
  return false;
}

const PERMISSION_CHECKS = [
  ['ViewChannel', PermissionsBitField.Flags.ViewChannel],
  ['SendMessages', PermissionsBitField.Flags.SendMessages],
  ['ReadMessageHistory', PermissionsBitField.Flags.ReadMessageHistory],
  ['UseExternalEmojis', PermissionsBitField.Flags.UseExternalEmojis],
  ['AddReactions', PermissionsBitField.Flags.AddReactions],
  ['EmbedLinks', PermissionsBitField.Flags.EmbedLinks],
  ['AttachFiles', PermissionsBitField.Flags.AttachFiles],
  ['ManageMessages', PermissionsBitField.Flags.ManageMessages],
  ['ManageChannels', PermissionsBitField.Flags.ManageChannels],
  ['ManageRoles', PermissionsBitField.Flags.ManageRoles],
  ['ManageThreads', PermissionsBitField.Flags.ManageThreads],
  ['CreatePublicThreads', PermissionsBitField.Flags.CreatePublicThreads],
  ['CreatePrivateThreads', PermissionsBitField.Flags.CreatePrivateThreads],
  ['ManageNicknames', PermissionsBitField.Flags.ManageNicknames],
  ['KickMembers', PermissionsBitField.Flags.KickMembers],
  ['BanMembers', PermissionsBitField.Flags.BanMembers],
  ['ModerateMembers', PermissionsBitField.Flags.ModerateMembers],
];

const RECOMMENDED_PERMISSION_FLAGS = [
  PermissionsBitField.Flags.ViewChannel,
  PermissionsBitField.Flags.SendMessages,
  PermissionsBitField.Flags.ReadMessageHistory,
  PermissionsBitField.Flags.EmbedLinks,
  PermissionsBitField.Flags.AttachFiles,
  PermissionsBitField.Flags.AddReactions,
  PermissionsBitField.Flags.UseExternalEmojis,
  PermissionsBitField.Flags.ManageMessages,
  PermissionsBitField.Flags.ManageChannels,
  PermissionsBitField.Flags.ManageRoles,
  PermissionsBitField.Flags.ManageThreads,
  PermissionsBitField.Flags.CreatePublicThreads,
  PermissionsBitField.Flags.CreatePrivateThreads,
  PermissionsBitField.Flags.ManageNicknames,
  PermissionsBitField.Flags.KickMembers,
  PermissionsBitField.Flags.BanMembers,
  PermissionsBitField.Flags.ModerateMembers,
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
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}_-]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
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
  const idMatch = raw.match(/\d{15,25}/);
  const byId = await guild.channels.fetch(idMatch ? idMatch[0] : raw).catch(() => null);
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

function formatDateTime(value) {
  if (!value) return 'unknown';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'unknown';
  return date.toISOString();
}

function getNotableMemberPermissions(member) {
  const checks = [
    ['Administrator', PermissionsBitField.Flags.Administrator],
    ['ManageGuild', PermissionsBitField.Flags.ManageGuild],
    ['ManageChannels', PermissionsBitField.Flags.ManageChannels],
    ['ManageRoles', PermissionsBitField.Flags.ManageRoles],
    ['ManageMessages', PermissionsBitField.Flags.ManageMessages],
    ['ManageThreads', PermissionsBitField.Flags.ManageThreads],
    ['ModerateMembers', PermissionsBitField.Flags.ModerateMembers],
    ['KickMembers', PermissionsBitField.Flags.KickMembers],
    ['BanMembers', PermissionsBitField.Flags.BanMembers],
  ];
  return checks
    .filter(([, flag]) => member.permissions?.has(flag))
    .map(([name]) => name);
}

async function inspectMember(message, args) {
  const guild = await resolveGuild(message);
  if (!guild) return 'Không thể kết nối tới server để đọc hồ sơ member.';

  const target = args.member || args.user || args.userId || args.memberId
    || message.mentions?.users?.first?.()?.id
    || message.reference?.messageId;
  let member = await findMember(guild, target);

  if (!member && message.reference?.messageId && message.channel?.messages) {
    const referenced = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
    if (referenced?.author?.id) {
      member = await findMember(guild, referenced.author.id);
    }
  }

  if (!member) {
    return 'Không tìm thấy member cần kiểm tra. Hãy mention, đưa ID, hoặc reply vào tin nhắn của member đó.';
  }

  const roles = member.roles.cache
    .filter(role => role.id !== guild.id)
    .sort((a, b) => b.position - a.position)
    .map(role => role.name);
  const warnings = await listWarnings({
    guildId: guild.id,
    memberId: member.id,
    limit: Math.min(Math.max(Number(args.warningLimit) || 5, 1), 10),
  });
  const notablePermissions = getNotableMemberPermissions(member);
  const joinedDays = member.joinedAt
    ? Math.max(0, Math.floor((Date.now() - member.joinedAt.getTime()) / 86_400_000))
    : null;
  const accountDays = member.user?.createdAt
    ? Math.max(0, Math.floor((Date.now() - member.user.createdAt.getTime()) / 86_400_000))
    : null;

  return [
    `Hồ sơ member: ${member.displayName} (${member.user?.tag || member.id})`,
    `- ID: ${member.id}`,
    `- Bot: ${member.user?.bot ? 'có' : 'không'}`,
    `- Vào server: ${formatDateTime(member.joinedAt)}${joinedDays === null ? '' : ` (${joinedDays} ngày trước)`}`,
    `- Tạo tài khoản: ${formatDateTime(member.user?.createdAt)}${accountDays === null ? '' : ` (${accountDays} ngày trước)`}`,
    `- Role cao nhất: ${member.roles.highest?.name || 'unknown'}`,
    `- Roles (${roles.length}): ${roles.length ? roles.slice(0, 20).join(', ') : 'không có role riêng'}`,
    `- Quyền quản trị đáng chú ý: ${notablePermissions.length ? notablePermissions.join(', ') : 'không có'}`,
    warnings.length
      ? `- Warning active (${warnings.length}):\n${warnings.map(warning => `  - ${warning.id.slice(0, 8)} | ${warning.createdAt} | ${truncateLine(warning.reason, 160)}`).join('\n')}`
      : '- Warning active: không có',
    member.communicationDisabledUntil
      ? `- Timeout đến: ${formatDateTime(member.communicationDisabledUntil)}`
      : '- Timeout: không',
    'Gợi ý: nếu cần xử lý, admin có thể yêu cầu bot warn/timeout/kick/ban bằng ngôn ngữ tự nhiên.',
  ].join('\n');
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

function buildResourceMessagePayload(part) {
  if (part?.embed?.imageUrl) {
    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setDescription(String(part.embed.description || 'Hình minh họa từ tài liệu nguồn.').slice(0, 4096))
      .setImage(part.embed.imageUrl);
    return { embeds: [embed] };
  }
  return { content: String(part?.content || '').slice(0, 1900) || 'Nguồn tài liệu đã được xử lý.' };
}

function normalizeAutoArchiveDuration(value) {
  const minutes = Number(value) || 1440;
  const allowed = [60, 1440, 4320, 10080];
  return allowed.includes(minutes) ? minutes : 1440;
}

function resolveForumTagIds(channel, tags, options = {}) {
  if (!channel?.availableTags?.length) return [];
  const requestedTags = Array.isArray(tags) ? tags : [];
  const matched = requestedTags
    .map(tag => String(tag).trim().toLowerCase())
    .filter(Boolean)
    .map(wanted => {
      const byId = channel.availableTags.find(item => item.id === wanted);
      if (byId) return byId.id;
      const normalizedWanted = normalizeChannelName(wanted);
      const byName = channel.availableTags.find(item => {
        const normalizedName = normalizeChannelName(item.name);
        return normalizedName === normalizedWanted
          || normalizedName.includes(normalizedWanted)
          || normalizedWanted.includes(normalizedName);
      });
      return byName?.id || null;
    })
    .filter(Boolean)
    .slice(0, 5);
  if (!matched.length && options.fallback) {
    return [channel.availableTags[0].id];
  }
  return matched;
}

function describeForumTags(channel, tagIds) {
  if (!channel?.availableTags?.length || !tagIds?.length) return '';
  return tagIds
    .map(id => channel.availableTags.find(tag => tag.id === id)?.name)
    .filter(Boolean)
    .join(', ');
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
  const recommendedPermissions = new PermissionsBitField(RECOMMENDED_PERMISSION_FLAGS);
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
    `- Link mời lại với bộ quyền khuyến nghị (full assistant stack): ${inviteUrl}`,
    '- Sau khi re-invite: kéo role bot lên cao hơn các role cần gán/sửa trong Server Settings > Roles.',
    `- ASSISTANT_AUTO_WRITE=${isAutoWriteEnabled() ? 'on (write chạy ngay)' : 'off (write cần xác nhận)'} | max actions/lượt=${getMaxActions()}`,
  ].join('\n');
}

async function getBotMember(guild, clientUserId) {
  return guild.members.me
    || await guild.members.fetchMe().catch(() => null)
    || (clientUserId ? await guild.members.fetch(clientUserId).catch(() => null) : null);
}

function assertBotCanManageRole(botMember, role) {
  if (!botMember || !role) return 'Bot hoặc role không hợp lệ.';
  if (role.managed) return `Role ${role.name} do integration quản lý, bot không sửa được.`;
  if (role.id === role.guild?.id) return 'Không thể sửa role @everyone bằng edit_role; dùng set_channel_permissions hoặc set_everyone nếu cần.';
  if (role.position >= botMember.roles.highest.position) {
    return `Bot không quản lý được role ${role.name} (role bot phải cao hơn trong hierarchy).`;
  }
  return null;
}

function parsePermissionFlagList(list) {
  const names = Array.isArray(list)
    ? list
    : String(list || '').split(/[,|\s]+/).map(item => item.trim()).filter(Boolean);
  const flags = [];
  const unknown = [];
  for (const name of names) {
    const key = name.replace(/[^a-zA-Z]/g, '');
    if (PermissionsBitField.Flags[key] !== undefined) flags.push(key);
    else if (name) unknown.push(name);
  }
  return { flags, unknown, bitfield: new PermissionsBitField(flags.map(key => PermissionsBitField.Flags[key])) };
}

async function resolvePermissionTarget(guild, args) {
  const raw = args.target || args.role || args.member || args.user || args.userId || args.roleId || '@everyone';
  const text = String(raw).trim().toLowerCase();
  if (text === '@everyone' || text === 'everyone' || text === guild.id) {
    return guild.roles.everyone;
  }
  const role = await findRole(guild, raw);
  if (role) return role;
  return findMember(guild, raw);
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

  for (const action of actions.slice(0, getMaxActions())) {
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
      } else if (type === 'inspect_member') {
        results.push(await inspectMember(message, args));
      } else if (type === 'analyze_server') {
        const tasks = await listTasks({
          context,
          status: 'open',
          limit: args.taskLimit || 10,
        });
        results.push(await analyzeServer({ guild, args, tasks }));
      } else if (type === 'learn_server') {
        if (!guild) {
          results.push('Không thể kết nối tới server để học hồ sơ.');
          continue;
        }
        const profile = await generateServerProfile({ guild, args });
        const fact = await upsertFact({
          scope: 'guild',
          title: args.title || `Server profile: ${guild.name}`,
          content: profile,
          tags: ['server-profile', 'auto-learn'],
          context,
        });
        results.push(fact
          ? `Đã học và lưu hồ sơ server vào memory guild: ${fact.title}.`
          : 'Không tạo được hồ sơ server hợp lệ để lưu.');
      } else if (type === 'search_messages') {
        results.push(await searchMessages(message, args));
      } else if (type === 'fetch_url' || type === 'summarize_url') {
        results.push(await summarizeUrl(args));
      } else if (type === 'publish_url_to_forum') {
        const requestedChannel = args.channel || args.forum || args.channel_name || args.channelId;
        const channel = requestedChannel
          ? await findChannel(guild, requestedChannel)
          : message.channel;
        if (!channel) {
          results.push('Không tìm thấy đúng kênh forum/thread để đăng resource. Hãy đưa channel mention hoặc ID kênh.');
          continue;
        }
        const post = await buildForumResourcePost(args);
        if (!post?.content) {
          results.push('Không tạo được nội dung bài resource từ URL này.');
          continue;
        }
        const parts = buildResourceMessageParts(post.content, post.imageUrls);
        const firstPart = parts.shift() || { content: post.sourceUrl };
        let thread = null;
        if (channel.type === ChannelType.GuildForum) {
          const appliedTags = resolveForumTagIds(channel, args.tags, { fallback: true });
          thread = await channel.threads.create({
            name: post.title,
            autoArchiveDuration: normalizeAutoArchiveDuration(args.autoArchiveDuration),
            appliedTags,
            message: buildResourceMessagePayload(firstPart),
            reason: `Assistant URL resource post by ${message.author.tag}`,
          });
        } else if (channel.threads?.create) {
          thread = await channel.threads.create({
            name: post.title,
            autoArchiveDuration: normalizeAutoArchiveDuration(args.autoArchiveDuration),
            reason: `Assistant URL resource thread by ${message.author.tag}`,
          });
          await thread.send(buildResourceMessagePayload(firstPart));
        } else {
          results.push('Kênh này không hỗ trợ tạo forum post/thread.');
          continue;
        }

        for (const part of parts) {
          await thread.send(buildResourceMessagePayload(part));
        }
        const tagNote = describeForumTags(channel, thread.appliedTags || [])
          || describeForumTags(channel, resolveForumTagIds(channel, args.tags, { fallback: true }));
        results.push(`Đã đăng resource từ URL thành thread/forum post <#${thread.id}>.${tagNote ? ` Tag: ${tagNote}.` : ''}`);
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
          const appliedTags = resolveForumTagIds(channel, args.tags, { fallback: true });
          const thread = await channel.threads.create({
            name,
            autoArchiveDuration: normalizeAutoArchiveDuration(args.autoArchiveDuration),
            appliedTags,
            message: { content },
            reason: `Assistant command by ${message.author.tag}`,
          });
          const tagNote = describeForumTags(channel, thread.appliedTags || appliedTags);
          results.push(`Đã tạo forum post <#${thread.id}> trong #${channel.name}.${tagNote ? ` Tag: ${tagNote}.` : ''}`);
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
        const target = type === 'rename_thread'
          ? await resolveThreadForAction(message, guild, {
            thread: args.thread || args.threadId || args.channel || args.channelId,
          })
          : await resolveThreadForAction(message, guild, args);
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
      } else if (type === 'create_category') {
        if (!guild) {
          results.push('Không thể kết nối tới server để tạo category.');
          continue;
        }
        const name = String(args.name || args.category || '').trim().slice(0, 100);
        if (!name) {
          results.push('Thiếu tên category.');
          continue;
        }
        const category = await guild.channels.create({
          name,
          type: ChannelType.GuildCategory,
          reason: `Assistant command by ${message.author.tag}`,
        });
        results.push(`Đã tạo category ${category.name} (${category.id}).`);
      } else if (type === 'move_channel') {
        const channel = await findChannel(guild, args.channel || args.channel_name || args.channelId);
        const parentRef = args.category || args.parent || args.parentId || args.parent_name;
        if (!channel) {
          results.push('Không tìm thấy kênh cần di chuyển.');
          continue;
        }
        let parent = null;
        if (parentRef && !['none', 'null', 'root', '0'].includes(String(parentRef).toLowerCase())) {
          parent = await findChannel(guild, parentRef);
          if (!parent || parent.type !== ChannelType.GuildCategory) {
            results.push('Không tìm thấy category đích.');
            continue;
          }
        }
        await channel.setParent(parent?.id || null, {
          lockPermissions: args.lockPermissions !== false,
          reason: `Assistant command by ${message.author.tag}`,
        });
        results.push(parent
          ? `Đã chuyển #${channel.name} vào category ${parent.name}.`
          : `Đã đưa #${channel.name} ra khỏi category (root).`);
      } else if (type === 'delete_channel') {
        const channel = await findChannel(guild, args.channel || args.channel_name || args.channelId || args.name);
        if (!channel) {
          results.push('Không tìm thấy kênh/category cần xóa.');
          continue;
        }
        if (channel.type === ChannelType.GuildCategory) {
          const children = guild.channels.cache.filter(item => item.parentId === channel.id);
          if (children.size > 0 && !args.force) {
            results.push(`Category ${channel.name} còn ${children.size} kênh con. Dọn kênh con trước hoặc đặt force=true (vẫn không xóa hàng loạt con).`);
            continue;
          }
        }
        const label = channel.name;
        const id = channel.id;
        await channel.delete(`Assistant command by ${message.author.tag}`);
        results.push(`Đã xóa kênh/category ${label} (${id}).`);
      } else if (type === 'create_forum_channel') {
        if (!guild) {
          results.push('Không thể kết nối tới server để tạo forum.');
          continue;
        }
        const name = normalizeChannelSlug(args.name || args.channel || '') || String(args.name || '').trim();
        if (!name) {
          results.push('Thiếu tên forum channel.');
          continue;
        }
        let parent;
        if (args.category || args.parent) {
          parent = await findChannel(guild, args.category || args.parent);
          if (parent && parent.type !== ChannelType.GuildCategory) parent = null;
        }
        const availableTags = Array.isArray(args.tags)
          ? args.tags.map(tag => ({ name: String(tag).slice(0, 20) })).filter(tag => tag.name).slice(0, 20)
          : [];
        const forum = await guild.channels.create({
          name,
          type: ChannelType.GuildForum,
          parent: parent?.id,
          topic: args.topic ? String(args.topic).slice(0, 1024) : undefined,
          availableTags: availableTags.length ? availableTags : undefined,
          reason: `Assistant command by ${message.author.tag}`,
        });
        results.push(`Đã tạo forum #${forum.name} (${forum.id})${parent ? ` trong ${parent.name}` : ''}.`);
      } else if (type === 'set_channel_permissions') {
        const channel = await findChannel(guild, args.channel || args.channel_name || args.channelId) || message.channel;
        if (!guild || !channel?.permissionOverwrites?.edit) {
          results.push('Không tìm thấy kênh hỗ trợ permission overwrites.');
          continue;
        }
        const target = await resolvePermissionTarget(guild, args);
        if (!target) {
          results.push('Không tìm thấy role/member target cho overwrite. Dùng @everyone, tên role, hoặc member.');
          continue;
        }
        const allowParsed = parsePermissionFlagList(args.allow || args.allows || []);
        const denyParsed = parsePermissionFlagList(args.deny || args.denies || []);
        if (allowParsed.unknown.length || denyParsed.unknown.length) {
          results.push(`Flag quyền không hợp lệ: ${[...allowParsed.unknown, ...denyParsed.unknown].join(', ')}. Dùng tên Discord.js như ViewChannel, SendMessages.`);
          continue;
        }
        if (!allowParsed.flags.length && !denyParsed.flags.length && args.clear !== true) {
          results.push('Cần allow[], deny[], hoặc clear=true.');
          continue;
        }
        if (args.clear === true) {
          await channel.permissionOverwrites.delete(target, `Assistant clear overwrite by ${message.author.tag}`);
          results.push(`Đã xóa overwrite của ${target.name || target.displayName || target.id} trên #${channel.name}.`);
        } else {
          const overwrite = {};
          for (const flag of allowParsed.flags) overwrite[flag] = true;
          for (const flag of denyParsed.flags) overwrite[flag] = false;
          await channel.permissionOverwrites.edit(target, overwrite, {
            reason: `Assistant command by ${message.author.tag}`,
          });
          results.push(`Đã cập nhật overwrite cho ${target.name || target.displayName || target.id} trên #${channel.name}.`);
        }
      } else if (type === 'assign_role' || type === 'remove_role') {
        const member = await findMember(guild, args.member || args.user || args.userId);
        const role = await findRole(guild, args.role || args.role_name || args.roleId);
        if (!member || !role) {
          results.push(`Không tìm thấy member hoặc role để ${type === 'assign_role' ? 'gán' : 'gỡ'}.`);
          continue;
        }
        const botMember = await getBotMember(guild, message.client.user.id);
        const hierarchyError = assertBotCanManageRole(botMember, role);
        if (hierarchyError) {
          results.push(hierarchyError);
          continue;
        }
        if (type === 'assign_role') {
          await member.roles.add(role, `Assistant command by ${message.author.tag}`);
          results.push(`Đã gán role ${role.name} cho ${member.displayName}.`);
        } else {
          await member.roles.remove(role, `Assistant command by ${message.author.tag}`);
          results.push(`Đã gỡ role ${role.name} khỏi ${member.displayName}.`);
        }
      } else if (type === 'edit_role') {
        const role = await findRole(guild, args.role || args.role_name || args.roleId || args.name);
        if (!guild || !role) {
          results.push('Không tìm thấy role để sửa.');
          continue;
        }
        const botMember = await getBotMember(guild, message.client.user.id);
        const hierarchyError = assertBotCanManageRole(botMember, role);
        if (hierarchyError) {
          results.push(hierarchyError);
          continue;
        }
        const patch = {};
        if (args.newName || args.name) patch.name = String(args.newName || args.name).slice(0, 100);
        if (args.color) patch.color = args.color;
        if (args.hoist !== undefined) patch.hoist = Boolean(args.hoist);
        if (args.mentionable !== undefined) patch.mentionable = Boolean(args.mentionable);
        if (args.permissions || args.permissionFlags) {
          const parsed = parsePermissionFlagList(args.permissions || args.permissionFlags);
          if (parsed.unknown.length) {
            results.push(`Flag quyền role không hợp lệ: ${parsed.unknown.join(', ')}`);
            continue;
          }
          patch.permissions = parsed.bitfield;
        }
        if (!Object.keys(patch).length) {
          results.push('edit_role cần newName/color/hoist/mentionable/permissions.');
          continue;
        }
        const updated = await role.edit({ ...patch, reason: `Assistant command by ${message.author.tag}` });
        results.push(`Đã cập nhật role ${updated.name} (${updated.id}).`);
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
      } else if (type === 'unban_member') {
        if (!guild) {
          results.push('Không thể unban ngoài ngữ cảnh server.');
          continue;
        }
        const raw = String(args.member || args.user || args.userId || args.id || '').replace(/[<@!>]/g, '').trim();
        const idMatch = raw.match(/\d{15,25}/);
        if (!idMatch) {
          results.push('Cần user ID để unban.');
          continue;
        }
        await guild.members.unban(idMatch[0], String(args.reason || `Assistant command by ${message.author.tag}`).slice(0, 512));
        results.push(`Đã unban user ${idMatch[0]}.`);
      } else if (type === 'remove_timeout') {
        const member = await findMember(guild, args.member || args.user || args.userId);
        if (!member?.timeout) {
          results.push('Không tìm thấy member để gỡ timeout.');
          continue;
        }
        await member.timeout(null, String(args.reason || `Assistant command by ${message.author.tag}`).slice(0, 512));
        results.push(`Đã gỡ timeout cho ${member.displayName}.`);
      } else if (type === 'list_bans') {
        if (!guild) {
          results.push('Không thể liệt kê ban ngoài server.');
          continue;
        }
        const bans = await guild.bans.fetch().catch(() => null);
        if (!bans?.size) {
          results.push('Server không có ban hoặc bot thiếu quyền xem ban.');
          continue;
        }
        const lines = [...bans.values()]
          .slice(0, Math.min(Math.max(Number(args.limit) || 15, 1), 30))
          .map(ban => `- ${ban.user.tag} (${ban.user.id})${ban.reason ? `: ${truncateLine(ban.reason, 80)}` : ''}`);
        results.push(`Danh sách ban (${bans.size}):\n${lines.join('\n')}`);
      } else if (type === 'set_nickname') {
        const member = await findMember(guild, args.member || args.user || args.userId);
        if (!member) {
          results.push('Không tìm thấy member để đổi nickname.');
          continue;
        }
        const nick = args.nickname === null || args.nickname === '' || args.clear
          ? null
          : String(args.nickname || args.nick || args.name || '').slice(0, 32);
        await member.setNickname(nick, `Assistant command by ${message.author.tag}`);
        results.push(nick
          ? `Đã đổi nickname của ${member.user.username} thành "${nick}".`
          : `Đã xóa nickname của ${member.user.username}.`);
      } else if (type === 'dm_member') {
        const member = await findMember(guild, args.member || args.user || args.userId);
        const content = String(args.content || args.message || args.text || '').trim();
        if (!member || !content) {
          results.push('dm_member cần member và content.');
          continue;
        }
        const sent = await member.send(content.slice(0, 1900)).catch(() => null);
        results.push(sent
          ? `Đã DM ${member.displayName}.`
          : `Không gửi được DM cho ${member.displayName} (có thể họ tắt DM).`);
      } else if (type === 'edit_message') {
        const targetMessage = await findMessageForAction(message, guild, args);
        if (!targetMessage) {
          results.push('Không tìm thấy tin nhắn để sửa (cần messageId/URL hoặc reply).');
          continue;
        }
        if (targetMessage.author?.id !== message.client.user.id) {
          results.push('Bot chỉ sửa được tin nhắn do chính bot gửi.');
          continue;
        }
        const content = args.content !== undefined ? String(args.content).slice(0, 2000) : undefined;
        const embeds = args.title || args.description
          ? [buildAssistantEmbed(args)]
          : undefined;
        if (content === undefined && !embeds) {
          results.push('edit_message cần content hoặc title/description embed.');
          continue;
        }
        await targetMessage.edit({
          content: content !== undefined ? content : targetMessage.content,
          embeds: embeds || targetMessage.embeds,
        });
        results.push(`Đã sửa tin nhắn ${targetMessage.id}.`);
      } else if (type === 'delete_message') {
        const targetMessage = await findMessageForAction(message, guild, args);
        if (!targetMessage) {
          results.push('Không tìm thấy tin nhắn để xóa. Hãy reply tin đó, hoặc đưa message link/ID. (Xóa cả bài forum thì dùng delete_thread.)');
          continue;
        }
        await targetMessage.delete();
        results.push(`Đã xóa tin nhắn ${targetMessage.id}.`);
      } else if (type === 'delete_thread') {
        const thread = await resolveThreadForAction(message, guild, args);
        if (!thread?.isThread?.()) {
          results.push('Không tìm thấy bài đăng/thread để xóa. Hãy đứng trong thread, reply, đưa link thread, hoặc tên/id thread.');
          continue;
        }
        const label = thread.name;
        const id = thread.id;
        const parentLabel = thread.parent?.name ? `#${thread.parent.name}` : 'forum/channel';
        await thread.delete(`Assistant delete_thread by ${message.author.tag}`);
        results.push(`Đã xóa bài đăng/thread "${label}" (${id}) trong ${parentLabel}.`);
      } else if (type === 'set_thread_tags') {
        let thread = message.channel?.isThread?.() ? message.channel : null;
        if (args.thread || args.threadId || args.channel) {
          const found = await findChannel(guild, args.thread || args.threadId || args.channel);
          if (found?.isThread?.()) thread = found;
        }
        if (!thread?.isThread?.()) {
          results.push('Không tìm thấy thread để gán tag.');
          continue;
        }
        const parent = thread.parent || await guild.channels.fetch(thread.parentId).catch(() => null);
        if (!parent?.availableTags) {
          results.push('Thread không thuộc forum có tag.');
          continue;
        }
        const tagIds = resolveForumTagIds(parent, args.tags || args.tag || [], { fallback: false });
        if (!tagIds.length) {
          results.push('Không khớp tag forum nào. Kiểm tra tên tag.');
          continue;
        }
        await thread.setAppliedTags(tagIds, `Assistant command by ${message.author.tag}`);
        results.push(`Đã gán tag [${describeForumTags(parent, tagIds)}] cho thread ${thread.name}.`);
      } else if (type === 'list_threads') {
        const channel = await findChannel(guild, args.channel || args.channel_name || args.channelId) || message.channel;
        if (!channel?.threads?.fetchActive) {
          results.push('Kênh không hỗ trợ list threads.');
          continue;
        }
        const active = await channel.threads.fetchActive().catch(() => ({ threads: new Map() }));
        const archived = await channel.threads.fetchArchived({ limit: Math.min(Number(args.limit) || 15, 50) }).catch(() => ({ threads: new Map() }));
        const activeLines = [...(active.threads?.values?.() || [])].slice(0, 20).map(t => `- [active] ${t.name} (${t.id})`);
        const archivedLines = [...(archived.threads?.values?.() || [])].slice(0, 15).map(t => `- [archived] ${t.name} (${t.id})`);
        const lines = [...activeLines, ...archivedLines];
        results.push(lines.length
          ? `Threads trong #${channel.name}:\n${lines.join('\n')}`
          : `Không có thread nào trong #${channel.name}.`);
      } else if (type === 'unarchive_thread' || type === 'lock_thread' || type === 'unlock_thread') {
        let target = message.channel?.isThread?.() ? message.channel : null;
        if (args.thread || args.threadId || args.name) {
          const found = await findChannel(guild, args.thread || args.threadId || args.name);
          if (found?.isThread?.()) target = found;
        }
        if (!target?.isThread?.()) {
          results.push('Không tìm thấy thread.');
          continue;
        }
        if (type === 'unarchive_thread') {
          await target.setArchived(false, `Assistant command by ${message.author.tag}`);
          results.push(`Đã unarchive thread "${target.name}".`);
        } else if (type === 'lock_thread') {
          await target.setLocked(true, `Assistant command by ${message.author.tag}`);
          results.push(`Đã khóa thread "${target.name}".`);
        } else {
          await target.setLocked(false, `Assistant command by ${message.author.tag}`);
          results.push(`Đã mở khóa thread "${target.name}".`);
        }
      } else if (type === 'mark_thread_solved') {
        let thread = message.channel?.isThread?.() ? message.channel : null;
        if (args.thread || args.threadId) {
          const found = await findChannel(guild, args.thread || args.threadId);
          if (found?.isThread?.()) thread = found;
        }
        if (!thread?.isThread?.()) {
          results.push('mark_thread_solved cần chạy trong thread Q&A hoặc chỉ định thread.');
          continue;
        }
        const outcome = await markThreadSolved(thread, message.author);
        results.push(outcome || 'Không đánh dấu được (thiếu tag Chưa/Đã giải quyết trên forum).');
      } else if (type === 'bulk_lock_channels') {
        if (!guild) {
          results.push('Không thể bulk lock ngoài server.');
          continue;
        }
        const names = Array.isArray(args.channels) ? args.channels : String(args.channels || '').split(',').map(s => s.trim()).filter(Boolean);
        if (!names.length) {
          results.push('bulk_lock_channels cần channels: ["tên1","tên2"] hoặc danh sách cách nhau bởi dấu phẩy.');
          continue;
        }
        const everyoneRole = guild.roles.everyone;
        const locked = [];
        const failed = [];
        for (const name of names.slice(0, 20)) {
          const channel = await findChannel(guild, name);
          if (!channel?.permissionOverwrites?.edit) {
            failed.push(name);
            continue;
          }
          try {
            await channel.permissionOverwrites.edit(everyoneRole, { SendMessages: false }, {
              reason: `Assistant bulk lock by ${message.author.tag}`,
            });
            locked.push(channel.name);
          } catch {
            failed.push(name);
          }
        }
        results.push(`Bulk lock xong: ${locked.length} kênh [${locked.join(', ')}]${failed.length ? `; lỗi: ${failed.join(', ')}` : ''}.`);
      } else if (type === 'send_roles_panel' || type === 'send_visa_panel' || type === 'send_rules_panel') {
        const channel = await findChannel(guild, args.channel || args.channel_name || args.channelId) || message.channel;
        if (!channel?.send) {
          results.push('Không tìm thấy kênh để gửi panel.');
          continue;
        }
        const payload = type === 'send_roles_panel'
          ? buildRolesPanelPayload()
          : type === 'send_visa_panel'
            ? buildVisaPanelPayload()
            : buildRulesPanelPayload(args);
        await channel.send(payload);
        results.push(`Đã gửi ${type.replace('send_', '').replace('_', ' ')} vào #${channel.name}.`);
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
  ACTION_RISK,
  executeAssistantActions,
  findChannel,
  getActionRisk,
  getActionType,
  getMaxActions,
  isAutoWriteEnabled,
  isDangerousAction,
  isAdminMessage,
  normalizeChannelName,
  parsePermissionFlagList,
  resolveForumTagIds,
};
