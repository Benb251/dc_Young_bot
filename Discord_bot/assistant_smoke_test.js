const fs = require('fs/promises');
const os = require('os');
const path = require('path');

const tempMemoryPath = path.join(os.tmpdir(), `assistant-memory-${Date.now()}.json`);
const tempWarningPath = path.join(os.tmpdir(), `assistant-warnings-${Date.now()}.json`);
const tempReminderPath = path.join(os.tmpdir(), `assistant-reminders-${Date.now()}.json`);
const tempTaskPath = path.join(os.tmpdir(), `assistant-tasks-${Date.now()}.json`);
process.env.ASSISTANT_MEMORY_FILE = tempMemoryPath;
process.env.ASSISTANT_WARNING_FILE = tempWarningPath;
process.env.ASSISTANT_REMINDER_FILE = tempReminderPath;
process.env.ASSISTANT_TASK_FILE = tempTaskPath;

const { extractJson } = require('./assistant_brain.js');
const memory = require('./assistant_memory.js');
const confirmations = require('./assistant_confirmations.js');
const tools = require('./assistant_tools.js');
const { isDangerousAction } = tools;
const autoMemory = require('./assistant_auto_memory.js');
const reminders = require('./assistant_reminders.js');
const aiHelper = require('./ai_helper.js');
const status = require('./assistant_status.js');
const tasks = require('./assistant_tasks.js');
const warnings = require('./assistant_warnings.js');
const advisor = require('./assistant_server_advisor.js');
const onboarding = require('./assistant_onboarding.js');
const web = require('./assistant_web.js');

async function main() {
  const parsed = extractJson('```json\n{"reply":"ok","actions":[]}\n```');
  if (!parsed || parsed.reply !== 'ok' || !Array.isArray(parsed.actions)) {
    throw new Error('extractJson failed fenced JSON parsing');
  }

  const context = { guildId: 'guild', channelId: 'channel', userId: 'user' };
  await memory.rememberFact({
    scope: 'user',
    title: 'Preferred tool',
    content: 'User likes Blender topology feedback.',
    tags: ['blender', 'topology'],
    context,
  });

  const facts = await memory.recallFacts('Blender feedback', context, 3);
  if (!facts.length || !facts[0].content.includes('Blender')) {
    throw new Error('memory recall failed');
  }

  const listedFacts = await memory.listFacts({ context, limit: 5 });
  if (!listedFacts.length || !listedFacts[0].title.includes('Preferred')) {
    throw new Error('memory list failed');
  }
  const forgotten = await memory.forgetFact({ id: listedFacts[0].id.slice(0, 8), context });
  if (!forgotten || forgotten.id !== listedFacts[0].id) {
    throw new Error('memory forget failed');
  }
  const afterForget = await memory.recallFacts('Blender feedback', context, 3);
  if (afterForget.length) {
    throw new Error('memory forget did not remove fact');
  }
  await memory.upsertFact({
    scope: 'guild',
    title: 'Server profile: Test Guild',
    content: 'Initial server profile.',
    tags: ['server-profile'],
    context,
  });
  await memory.upsertFact({
    scope: 'guild',
    title: 'Server profile: Test Guild',
    content: 'Updated server profile.',
    tags: ['server-profile'],
    context,
  });
  const serverProfiles = await memory.listFacts({ query: 'server-profile', context, limit: 5 });
  if (serverProfiles.length !== 1 || !serverProfiles[0].content.includes('Updated')) {
    throw new Error('memory upsert failed');
  }

  const { getActionRisk, isAutoWriteEnabled } = tools;

  // Default AUTO_WRITE is on: only critical actions require confirmation.
  delete process.env.ASSISTANT_AUTO_WRITE;
  if (!isAutoWriteEnabled()) {
    throw new Error('AUTO_WRITE should default to enabled');
  }
  if (
    getActionRisk({ type: 'inspect_server' }) !== 'safe'
    || getActionRisk({ type: 'send_message' }) !== 'write'
    || getActionRisk({ type: 'create_thread' }) !== 'write'
    || getActionRisk({ type: 'delete_channel' }) !== 'critical'
    || getActionRisk({ type: 'delete_thread' }) !== 'critical'
    || getActionRisk({ type: 'ban_member' }) !== 'critical'
    || getActionRisk({ type: 'set_channel_permissions' }) !== 'critical'
    || getActionRisk({ type: 'edit_role' }) !== 'critical'
    || getActionRisk({ type: 'unban_member' }) !== 'critical'
    || getActionRisk({ type: 'publish_url_to_forum' }) !== 'critical'
    || getActionRisk({ type: 'bulk_lock_channels' }) !== 'critical'
    || getActionRisk({ type: 'list_threads' }) !== 'safe'
    || getActionRisk({ type: 'mark_thread_solved' }) !== 'write'
    || getActionRisk({ type: 'unknown_future_tool' }) !== 'critical'
  ) {
    throw new Error('action risk classification failed');
  }

  if (
    !isDangerousAction({ type: 'ban_member' })
    || !isDangerousAction({ type: 'delete_channel' })
    || !isDangerousAction({ type: 'delete_thread' })
    || !isDangerousAction({ type: 'publish_url_to_forum' })
    || !isDangerousAction({ type: 'delete_messages' })
    || isDangerousAction({ type: 'create_thread' })
    || isDangerousAction({ type: 'send_embed' })
    || isDangerousAction({ type: 'warn_member' })
    || isDangerousAction({ type: 'pin_message' })
    || isDangerousAction({ type: 'set_slowmode' })
    || isDangerousAction({ type: 'recall_memory' })
    || isDangerousAction({ type: 'diagnose_permissions' })
    || isDangerousAction({ type: 'inspect_server' })
    || isDangerousAction({ type: 'inspect_member' })
    || isDangerousAction({ type: 'search_messages' })
    || isDangerousAction({ type: 'schedule_reminder' })
    || isDangerousAction({ type: 'fetch_url' })
    || isDangerousAction({ type: 'list_threads' })
  ) {
    throw new Error('dangerous action classification failed (AUTO_WRITE on)');
  }

  process.env.ASSISTANT_AUTO_WRITE = 'false';
  if (
    !isDangerousAction({ type: 'send_message' })
    || !isDangerousAction({ type: 'create_thread' })
    || !isDangerousAction({ type: 'ban_member' })
    || isDangerousAction({ type: 'inspect_server' })
  ) {
    throw new Error('dangerous action classification failed (AUTO_WRITE off)');
  }
  delete process.env.ASSISTANT_AUTO_WRITE;

  if (tools.getMaxActions() < 1 || tools.getMaxActions() > 20) {
    throw new Error('getMaxActions out of range');
  }

  const ids = tools.collectIdCandidates(
    'xóa bài 1524440890490224670',
    'https://discord.com/channels/1/1524440890490224670/99'
  );
  if (!ids.includes('1524440890490224670') || !ids.includes('99')) {
    throw new Error('collectIdCandidates failed');
  }

  const permParse = tools.parsePermissionFlagList(['ViewChannel', 'SendMessages', 'NotARealFlag']);
  if (!permParse.flags.includes('ViewChannel') || !permParse.unknown.includes('NotARealFlag')) {
    throw new Error('parsePermissionFlagList failed');
  }

  const panels = require('./assistant_panels.js');
  const rolesPanel = panels.buildRolesPanelPayload();
  if (!rolesPanel.embeds?.length || !rolesPanel.components?.length) {
    throw new Error('roles panel payload incomplete');
  }
  if (!panels.buildVisaPanelPayload().components?.length) {
    throw new Error('visa panel payload incomplete');
  }
  if (!panels.buildRulesPanelPayload({ description: 'Test rule' }).embeds?.length) {
    throw new Error('rules panel payload incomplete');
  }

  const qa = require('./assistant_qa_tags.js');
  const tags = qa.getStatusTagIds({
    availableTags: [
      { id: 'u1', name: 'Chưa giải quyết' },
      { id: 's1', name: 'Đã giải quyết' },
    ],
  });
  if (tags.unsolvedId !== 'u1' || tags.solvedId !== 's1') {
    throw new Error('getStatusTagIds failed');
  }

  const fakeChannel = { id: '1522895554735112332', name: '💎・▌tài・nguyên' };
  const fakeGuild = {
    channels: {
      fetch: async id => (id === fakeChannel.id ? fakeChannel : null),
      cache: {
        find: predicate => (predicate(fakeChannel) ? fakeChannel : null),
      },
    },
  };
  if (tools.normalizeChannelName(fakeChannel.name) !== 'tai-nguyen') {
    throw new Error('channel name normalization failed');
  }
  if (await tools.findChannel(fakeGuild, 'tai-nguyen') !== fakeChannel) {
    throw new Error('channel lookup by plain ascii name failed');
  }
  if (await tools.findChannel(fakeGuild, 'forum tai-nguyen id 1522895554735112332') !== fakeChannel) {
    throw new Error('channel lookup by embedded id failed');
  }
  const fakeForum = {
    availableTags: [
      { id: 'tag-resource', name: 'Tài nguyên' },
      { id: 'tag-blender', name: 'Blender' },
    ],
  };
  if (tools.resolveForumTagIds(fakeForum, ['tai-nguyen'])[0] !== 'tag-resource') {
    throw new Error('forum tag lookup by ascii name failed');
  }
  if (tools.resolveForumTagIds(fakeForum, [], { fallback: true })[0] !== 'tag-resource') {
    throw new Error('forum tag fallback failed');
  }

  const pending = confirmations.createPendingConfirmation(context, {
    actions: [{ type: 'delete_messages', count: 2 }],
  });
  if (!pending || !confirmations.isConfirmationMessage('xác nhận')) {
    throw new Error('confirmation creation failed');
  }
  if (!confirmations.isConfirmationMessage('Xác nhận.') || !confirmations.isConfirmationMessage('ok xác nhận')) {
    throw new Error('confirmation phrase matching too strict');
  }
  if (!confirmations.isCancelMessage('hủy') || !confirmations.isCancelMessage('bo qua')) {
    throw new Error('cancel phrase matching failed');
  }
  if (!pending.token || pending.token.length !== 16) {
    throw new Error('confirmation token missing');
  }
  if (!confirmations.parseConfirmButtonId(`assistant_confirm:accept:${pending.token}`)) {
    throw new Error('confirm button id parse failed');
  }
  const components = confirmations.buildConfirmationComponents(pending.token);
  if (!components?.length || !components[0].components?.length) {
    throw new Error('confirmation buttons missing');
  }
  if (confirmations.getPendingConfirmationByToken(pending.token)?.token !== pending.token) {
    throw new Error('pending by token lookup failed');
  }
  // Flexible lookup by user even if channel key differs
  if (!confirmations.getPendingConfirmationForUser(context.userId)) {
    throw new Error('pending for user lookup failed');
  }
  if (!confirmations.consumePendingConfirmation({ ...context, channelId: 'other-channel' })?.actions?.length) {
    throw new Error('confirmation consume flexible failed');
  }
  if (confirmations.getPendingConfirmation(context) || confirmations.getPendingConfirmationByToken(pending.token)) {
    throw new Error('confirmation cleanup failed');
  }

  const pendingBtn = confirmations.createPendingConfirmation(context, {
    actions: [{ type: 'delete_thread', thread: 'demo' }],
  });
  const byToken = confirmations.consumePendingConfirmationByToken(pendingBtn.token);
  if (!byToken || byToken.actions[0].type !== 'delete_thread') {
    throw new Error('consume by token failed');
  }

  const candidates = autoMemory.parseMemoryCandidates(JSON.stringify({
    memories: [
      {
        scope: 'user',
        title: 'Preferred software',
        content: 'User prefers Blender for topology feedback.',
        tags: ['blender'],
        confidence: 0.9,
      },
      {
        scope: 'user',
        title: 'Temporary maybe',
        content: 'Maybe the user is hungry right now.',
        tags: ['temporary'],
        confidence: 0.3,
      },
    ],
  }));
  if (candidates.length !== 1 || candidates[0].scope !== 'user') {
    throw new Error('auto-memory candidate parsing failed');
  }
  if (!autoMemory.hasSecretLikeText('AI_API_KEY=sk-test-secret-value')) {
    throw new Error('auto-memory secret guard failed');
  }

  const inTwentyMinutes = reminders.parseRelativeTime('20 phút', 1_000_000);
  if (inTwentyMinutes !== 1_000_000 + 20 * 60_000) {
    throw new Error('reminder relative time parsing failed');
  }
  const tomorrow = reminders.parseRelativeTime('ngày mai', 1_000_000);
  if (tomorrow !== 1_000_000 + 24 * 60 * 60_000) {
    throw new Error('reminder tomorrow parsing failed');
  }

  const modelChain = aiHelper.getModelChain({
    model: 'xai/grok-4',
    fallbackModels: 'openai/gpt-5.5,xai/grok-4',
  });
  if (modelChain.length !== 2 || modelChain[1] !== 'openai/gpt-5.5') {
    throw new Error('AI model chain parsing failed');
  }

  const cleaned = aiHelper.cleanRouterResponseText('data: {"choices":[{"message":{"content":"ok"}}]}\n\ndata: [DONE]');
  if (!cleaned.includes('"content":"ok"') || cleaned.includes('[DONE]')) {
    throw new Error('AI router response cleanup failed');
  }

  const warning = await warnings.createWarning({
    guildId: 'guild',
    memberId: 'member',
    moderatorId: 'mod',
    reason: 'Test warning',
  });
  if (!warning?.id) {
    throw new Error('warning creation failed');
  }
  const activeWarnings = await warnings.listWarnings({ guildId: 'guild', memberId: 'member' });
  if (activeWarnings.length !== 1 || activeWarnings[0].reason !== 'Test warning') {
    throw new Error('warning listing failed');
  }
  const clearedWarning = await warnings.clearWarning({ guildId: 'guild', id: warning.id.slice(0, 8), moderatorId: 'mod' });
  if (!clearedWarning || clearedWarning.status !== 'cleared') {
    throw new Error('warning clearing failed');
  }

  const task = await tasks.createTask({
    args: { title: 'Set up artist roles', priority: 'high', tags: ['ops'] },
    context,
  });
  if (!task?.id) {
    throw new Error('task creation failed');
  }
  const openTasks = await tasks.listTasks({ context, status: 'open' });
  if (openTasks.length !== 1 || openTasks[0].priority !== 'high') {
    throw new Error('task listing failed');
  }
  const completedTask = await tasks.updateTaskStatus({ context, id: task.id.slice(0, 8), status: 'done' });
  if (!completedTask || completedTask.status !== 'done') {
    throw new Error('task completion failed');
  }

  const assistantStatus = await status.collectAssistantStatus({
    user: { tag: 'TestBot#0001' },
    guilds: { cache: { size: 1 } },
    channels: { cache: { size: 2 } },
    ws: { ping: 12 },
  });
  const statusText = status.formatAssistantStatus(assistantStatus);
  if (!statusText.includes('TestBot#0001') || !statusText.includes('Memory:')) {
    throw new Error('assistant status formatting failed');
  }

  const snapshot = advisor.buildServerSnapshot({
    id: 'guild',
    name: 'Test Guild',
    memberCount: 14,
    ownerId: 'owner',
    channels: {
      cache: new Map([
        ['cat', { id: 'cat', name: 'Community', type: 4, position: 0 }],
        ['rules', {
          id: 'rules',
          name: 'rules',
          type: 0,
          position: 1,
          parentId: 'cat',
          parent: { name: 'Community' },
          topic: 'Server rules',
        }],
      ]),
    },
    roles: {
      cache: new Map([
        ['guild', { id: 'guild', name: '@everyone', position: 0 }],
        ['artist', { id: 'artist', name: 'Artist', position: 1, members: { size: 3 } }],
      ]),
    },
  });
  if (snapshot.counts.channels !== 2 || snapshot.counts.roles !== 1 || snapshot.channels[0].name !== 'rules') {
    throw new Error('server advisor snapshot failed');
  }
  const advisorPrompt = advisor.buildAdvisorPrompt({ snapshot, question: 'Next stage?', tasks: [] });
  if (!advisorPrompt.includes('Test Guild') || !advisorPrompt.includes('Next stage?')) {
    throw new Error('server advisor prompt failed');
  }
  const profilePrompt = advisor.buildServerProfilePrompt({ snapshot, notes: 'Friendly 3D community' });
  if (!profilePrompt.includes('Friendly 3D community') || !profilePrompt.includes('Test Guild')) {
    throw new Error('server profile prompt failed');
  }
  const fallbackProfile = advisor.buildFallbackServerProfile(snapshot, 'Friendly 3D community');
  if (!fallbackProfile.includes('Test Guild') || !fallbackProfile.includes('Friendly 3D community')) {
    throw new Error('server profile fallback failed');
  }

  const welcomeConfig = onboarding.getOnboardingConfig({
    ASSISTANT_WELCOME_ENABLED: 'true',
    ASSISTANT_WELCOME_CHANNEL_ID: 'welcome',
    ASSISTANT_WELCOME_MESSAGE: 'Hi {user} to {server} #{memberCount}',
  });
  const fakeMember = {
    id: 'member',
    displayName: 'Member',
    user: { username: 'Member', tag: 'Member#0001' },
    guild: { name: 'Test Guild', memberCount: 14 },
  };
  if (!welcomeConfig.enabled || !onboarding.fillTemplate(welcomeConfig.message, fakeMember).includes('<@member>')) {
    throw new Error('onboarding config/template failed');
  }

  if (!web.isPrivateIp('127.0.0.1') || !web.isPrivateIp('192.168.1.2') || web.isPrivateIp('8.8.8.8')) {
    throw new Error('web private IP guard failed');
  }
  if (!web.isXStatusUrl(web.parsePublicUrl('https://x.com/Nona_xai/status/2069376735561318745'))) {
    throw new Error('web X status detection failed');
  }
  const tweetText = web.stripHtmlToText('<blockquote><p>Hello<br>World <a href="https://t.co/x">pic.twitter.com/x</a></p>&mdash; Nona (@Nona_xai) <a>June 23, 2026</a></blockquote>');
  if (!tweetText.includes('Hello\nWorld') || !tweetText.includes('Nona')) {
    throw new Error('web X oEmbed text extraction failed');
  }
  let blockedLocalhost = false;
  try {
    web.parsePublicUrl('http://localhost:3000');
  } catch {
    blockedLocalhost = true;
  }
  if (!blockedLocalhost) {
    throw new Error('web localhost guard failed');
  }
  const readable = web.extractReadableText('<html><head><title>X</title><style>.x{}</style></head><body><h1>Hello</h1><script>x()</script><p>World &amp; team</p></body></html>');
  if (!readable.includes('Hello') || !readable.includes('World & team') || readable.includes('x()')) {
    throw new Error('web readable text extraction failed');
  }
  const imageUrls = web.extractImageUrls('<img src="/images/intro.png"><img src="https://cdn.example.com/a.jpg">', 'https://docs.example.com/manual/page.html');
  if (imageUrls[0] !== 'https://docs.example.com/images/intro.png' || imageUrls[1] !== 'https://cdn.example.com/a.jpg') {
    throw new Error('web image extraction failed');
  }
  const markedImages = web.injectImageMarkers('<p>Before</p><img src="/shot.png"><p>After</p>', 'https://docs.example.com/page.html');
  const markedText = web.extractReadableText(markedImages.html);
  if (!markedText.includes('Before') || !markedText.includes('[HINH_1: https://docs.example.com/shot.png]') || !markedText.includes('After')) {
    throw new Error('web inline image marker failed');
  }
  const resourceParts = web.buildResourceMessageParts([
    'Intro paragraph.',
    'https://docs.example.com/shot.png',
    '**Caption for shot.**',
    'Next paragraph.',
  ].join('\n'), ['https://docs.example.com/shot.png']);
  if (!resourceParts[0]?.embed || resourceParts[0].embed.imageUrl !== 'https://docs.example.com/shot.png' || !resourceParts[0].embed.description.includes('Caption for shot')) {
    throw new Error('web resource image embed part failed');
  }
  if (resourceParts.some(part => part.content?.includes('https://docs.example.com/shot.png'))) {
    throw new Error('web resource text leaked raw image URL');
  }
  const mainHtml = web.extractMainHtml([
    '<html><body>',
    '<aside class="sidebar"><h2>Muc luc chinh</h2><a>Topbar</a><a>Workspaces</a></aside>',
    '<article role="main"><h1>Window System Introduction</h1><p>Main lesson text.</p><img src="/main.png"></article>',
    '</body></html>',
  ].join(''));
  const mainText = web.extractReadableText(mainHtml);
  if (!mainText.includes('Window System Introduction') || !mainText.includes('Main lesson text') || mainText.includes('Muc luc chinh')) {
    throw new Error('web main content extraction failed');
  }

  await fs.rm(tempMemoryPath, { force: true });
  await fs.rm(tempReminderPath, { force: true });
  await fs.rm(tempTaskPath, { force: true });
  await fs.rm(tempWarningPath, { force: true });
  console.log('assistant smoke test passed');
}

main().catch(async error => {
  await fs.rm(tempMemoryPath, { force: true }).catch(() => null);
  await fs.rm(tempReminderPath, { force: true }).catch(() => null);
  await fs.rm(tempTaskPath, { force: true }).catch(() => null);
  await fs.rm(tempWarningPath, { force: true }).catch(() => null);
  console.error(error);
  process.exit(1);
});
