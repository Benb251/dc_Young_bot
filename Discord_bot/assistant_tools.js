const { ChannelType, PermissionsBitField } = require('discord.js');
const { getAIChatResponse } = require('./ai_helper.js');
const { recallFacts, rememberFact } = require('./assistant_memory.js');

const ADMIN_ACTIONS = new Set([
  'assign_role',
  'ban_member',
  'create_role',
  'create_text_channel',
  'delete_messages',
  'diagnose_permissions',
  'kick_member',
  'list_channels',
  'remove_role',
  'rename_channel',
  'send_message',
  'set_channel_topic',
  'summarize_channel',
  'timeout_member',
]);

const DANGEROUS_ACTIONS = new Set([
  'assign_role',
  'ban_member',
  'create_role',
  'create_text_channel',
  'delete_messages',
  'kick_member',
  'remove_role',
  'rename_channel',
  'send_message',
  'set_channel_topic',
  'timeout_member',
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
      } else if (type === 'send_message') {
        const channel = await findChannel(guild, args.channel || args.channel_name || args.channelId);
        if (!channel || !channel.isTextBased()) {
          results.push('Không tìm thấy kênh để gửi tin nhắn.');
          continue;
        }
        await channel.send(String(args.content || '').slice(0, 1900));
        results.push(`Đã gửi tin nhắn vào <#${channel.id}>.`);
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
