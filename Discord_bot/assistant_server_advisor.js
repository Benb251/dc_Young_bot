const { ChannelType } = require('discord.js');
const { getAIChatResponse } = require('./ai_helper.js');

const CHANNEL_TYPE_LABELS = {
  [ChannelType.GuildText]: 'text',
  [ChannelType.GuildAnnouncement]: 'announcement',
  [ChannelType.GuildForum]: 'forum',
  [ChannelType.GuildCategory]: 'category',
  [ChannelType.GuildVoice]: 'voice',
  [ChannelType.GuildStageVoice]: 'stage',
};

function collectionValues(collection) {
  if (!collection) return [];
  if (typeof collection.values === 'function') return Array.from(collection.values());
  if (Array.isArray(collection)) return collection;
  return Object.values(collection);
}

function channelTypeLabel(type) {
  return CHANNEL_TYPE_LABELS[type] || String(type);
}

function cleanLine(value, max = 140) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3)}...`;
}

function buildServerSnapshot(guild, options = {}) {
  const channelLimit = Math.min(Math.max(Number(options.limit) || 50, 5), 100);
  const roleLimit = Math.min(Math.max(Number(options.roleLimit) || 35, 5), 80);
  const channels = collectionValues(guild?.channels?.cache)
    .filter(channel => channel && channel.id)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const roles = collectionValues(guild?.roles?.cache)
    .filter(role => role && role.id && role.id !== guild?.id)
    .sort((a, b) => (b.position ?? 0) - (a.position ?? 0));

  const categories = channels.filter(channel => channel.type === ChannelType.GuildCategory);
  const publicText = channels.filter(channel => [
    ChannelType.GuildText,
    ChannelType.GuildAnnouncement,
    ChannelType.GuildForum,
  ].includes(channel.type));
  const voice = channels.filter(channel => [
    ChannelType.GuildVoice,
    ChannelType.GuildStageVoice,
  ].includes(channel.type));

  return {
    guild: {
      id: guild?.id || null,
      name: guild?.name || 'Unknown server',
      memberCount: guild?.memberCount ?? null,
      ownerId: guild?.ownerId || null,
    },
    counts: {
      channels: channels.length,
      categories: categories.length,
      textLike: publicText.length,
      voice: voice.length,
      roles: roles.length,
    },
    categories: categories.slice(0, channelLimit).map(channel => ({
      id: channel.id,
      name: channel.name,
      children: channels.filter(item => item.parentId === channel.id).length,
    })),
    channels: publicText.slice(0, channelLimit).map(channel => ({
      id: channel.id,
      name: channel.name,
      type: channelTypeLabel(channel.type),
      parent: channel.parent?.name || null,
      topic: cleanLine(channel.topic || ''),
      threads: channel.threads?.cache?.size ?? undefined,
    })),
    voiceChannels: voice.slice(0, Math.min(channelLimit, 25)).map(channel => ({
      id: channel.id,
      name: channel.name,
      type: channelTypeLabel(channel.type),
      parent: channel.parent?.name || null,
    })),
    roles: roles.slice(0, roleLimit).map(role => ({
      id: role.id,
      name: role.name,
      position: role.position ?? 0,
      members: role.members?.size ?? 0,
      mentionable: Boolean(role.mentionable),
    })),
  };
}

function formatSnapshotBrief(snapshot) {
  return [
    `Server: ${snapshot.guild.name} (${snapshot.guild.memberCount ?? 'unknown'} members)`,
    `Counts: ${snapshot.counts.channels} channels, ${snapshot.counts.categories} categories, ${snapshot.counts.textLike} text/forum/announcement, ${snapshot.counts.voice} voice/stage, ${snapshot.counts.roles} roles`,
    snapshot.categories.length
      ? `Categories:\n${snapshot.categories.map(item => `- ${item.name} (${item.children} channels)`).join('\n')}`
      : 'Categories: none visible',
    snapshot.channels.length
      ? `Text/forum channels:\n${snapshot.channels.map(item => `- #${item.name} [${item.type}]${item.parent ? ` in ${item.parent}` : ''}${item.topic ? ` | ${item.topic}` : ''}`).join('\n')}`
      : 'Text/forum channels: none visible',
    snapshot.roles.length
      ? `Roles:\n${snapshot.roles.map(item => `- ${item.name} (${item.members} members)`).join('\n')}`
      : 'Roles: none visible',
  ].join('\n\n');
}

function buildAdvisorPrompt({ snapshot, question, tasks = [] }) {
  const taskText = tasks.length
    ? tasks.map(task => `- [${task.priority}] ${task.title}${task.details ? `: ${task.details}` : ''}`).join('\n')
    : 'No open tasks yet.';

  return `
Bạn là cố vấn vận hành Discord cho một cộng đồng 3D/Game Art/Design tiếng Việt.
Hãy phân tích snapshot server bên dưới và trả lời bằng tiếng Việt tự nhiên, thực dụng.

Yêu cầu của admin:
${question || 'Phân tích server và đề xuất giai đoạn tiếp theo.'}

Open tasks hiện có:
${taskText}

Snapshot server:
${formatSnapshotBrief(snapshot)}

Hãy trả về:
1. Nhận định nhanh về tình trạng cộng đồng.
2. 5-8 việc ưu tiên tiếp theo, theo thứ tự nên làm.
3. Cảnh báo quyền/cấu trúc nếu thấy rủi ro.
4. Một câu lệnh mẫu admin có thể nhắn bot để triển khai việc đầu tiên.
`.trim();
}

function buildServerProfilePrompt({ snapshot, notes }) {
  return `
Bạn đang tạo hồ sơ trí nhớ bền vững cho bot quản trị Discord.
Hồ sơ này sẽ được lưu vào memory và dùng lại trong các lần trò chuyện sau.

Ghi chú của admin:
${notes || 'Không có ghi chú thêm.'}

Snapshot server:
${formatSnapshotBrief(snapshot)}

Hãy viết bằng tiếng Việt, tối đa 900 ký tự, gồm:
- Server này là cộng đồng gì.
- Cấu trúc/kênh/role nổi bật.
- Quy ước hoặc điểm cần nhớ cho trợ lý.
- 2-4 ưu tiên vận hành gần nhất.
Không bịa thông tin không có trong snapshot.
`.trim();
}

function buildFallbackServerProfile(snapshot, notes) {
  const categories = snapshot.categories.map(item => item.name).slice(0, 8).join(', ') || 'chưa thấy category';
  const channels = snapshot.channels.map(item => `#${item.name}`).slice(0, 12).join(', ') || 'chưa thấy kênh text/forum';
  const roles = snapshot.roles.map(item => item.name).slice(0, 10).join(', ') || 'chưa thấy role riêng';
  const priorities = [];
  if (!snapshot.channels.some(channel => /rule|nội|noi|luat|luật/i.test(channel.name))) priorities.push('hoàn thiện kênh nội quy/onboarding');
  if (!snapshot.channels.some(channel => /qa|hỏi|hoi|dap|đáp|help/i.test(channel.name))) priorities.push('xây khu hỏi đáp rõ ràng');
  if (snapshot.counts.roles < 4) priorities.push('thiết kế role nền cho member và phần mềm');
  priorities.push('kiểm tra quyền bot trong các kênh chính');

  return [
    `Server "${snapshot.guild.name}" có ${snapshot.guild.memberCount ?? 'unknown'} members, ${snapshot.counts.channels} kênh và ${snapshot.counts.roles} role.`,
    `Category nổi bật: ${categories}.`,
    `Kênh bot thấy: ${channels}.`,
    `Role nổi bật: ${roles}.`,
    notes ? `Ghi chú admin: ${cleanLine(notes, 220)}.` : '',
    `Ưu tiên gần nhất: ${priorities.slice(0, 4).join('; ')}.`,
  ].filter(Boolean).join(' ');
}

function buildFallbackAdvice(snapshot, tasks = []) {
  const recommendations = [];
  if (!snapshot.counts.categories) recommendations.push('Tạo category rõ ràng cho thông báo, hỏi đáp, khoe work, tài nguyên và voice.');
  if (snapshot.counts.textLike < 5) recommendations.push('Bổ sung các kênh lõi: nội quy, thông báo, hỏi đáp, khoe work, tài nguyên, workflow.');
  if (snapshot.counts.roles < 4) recommendations.push('Thiết kế role nền: admin/mod, artist, newbie, software tags và notification roles.');
  if (!snapshot.channels.some(channel => /rule|nội|noi|luat|luật/i.test(channel.name))) recommendations.push('Tạo hoặc hoàn thiện kênh nội quy để bot có điểm neo onboarding.');
  if (!snapshot.channels.some(channel => /qa|hỏi|hoi|dap|đáp|help/i.test(channel.name))) recommendations.push('Có ít nhất một khu hỏi đáp/forum để gom câu hỏi và đánh dấu đã giải quyết.');
  if (!tasks.length) recommendations.push('Tạo backlog vận hành bằng lệnh task để bot theo dõi việc cần làm lâu dài.');

  const finalRecommendations = recommendations.length
    ? recommendations
    : [
      'Rà lại quyền bot trong các kênh chính bằng diagnose_permissions.',
      'Viết lại thông điệp onboarding ngắn gọn cho member mới.',
      'Tạo lịch hoạt động tuần: feedback, challenge nhỏ, chia sẻ tài nguyên.',
      'Dùng memory để lưu tone, luật và quy ước riêng của server.',
    ];

  return [
    `Mình đã đọc nhanh server "${snapshot.guild.name}".`,
    `Hiện thấy ${snapshot.counts.channels} kênh, ${snapshot.counts.categories} category, ${snapshot.counts.roles} role.`,
    '',
    'Ưu tiên tiếp theo:',
    ...finalRecommendations.slice(0, 8).map((item, index) => `${index + 1}. ${item}`),
    '',
    'Lệnh mẫu để bắt đầu:',
    'hãy tạo task ưu tiên cao: kiểm tra quyền bot và hoàn thiện onboarding cho member mới',
  ].join('\n');
}

async function analyzeServer({ guild, args = {}, tasks = [] }) {
  if (!guild) return 'Không thể kết nối tới server để phân tích.';
  const snapshot = buildServerSnapshot(guild, args);
  const prompt = buildAdvisorPrompt({
    snapshot,
    question: args.question || args.goal || args.prompt || args.query,
    tasks,
  });

  try {
    return await getAIChatResponse([
      { role: 'user', content: prompt },
    ], [], { temperature: 0.25 });
  } catch (error) {
    console.error('[ASSISTANT ADVISOR] AI analysis failed:', error);
    return buildFallbackAdvice(snapshot, tasks);
  }
}

async function generateServerProfile({ guild, args = {} }) {
  if (!guild) return null;
  const snapshot = buildServerSnapshot(guild, args);
  const notes = args.notes || args.note || args.context || args.question || args.goal || '';
  const prompt = buildServerProfilePrompt({ snapshot, notes });

  try {
    return await getAIChatResponse([
      { role: 'user', content: prompt },
    ], [], { temperature: 0.2 });
  } catch (error) {
    console.error('[ASSISTANT ADVISOR] Server profile generation failed:', error);
    return buildFallbackServerProfile(snapshot, notes);
  }
}

module.exports = {
  analyzeServer,
  buildAdvisorPrompt,
  buildFallbackServerProfile,
  buildServerProfilePrompt,
  buildFallbackAdvice,
  buildServerSnapshot,
  formatSnapshotBrief,
  generateServerProfile,
};
