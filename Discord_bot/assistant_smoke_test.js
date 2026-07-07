const fs = require('fs/promises');
const os = require('os');
const path = require('path');

const tempMemoryPath = path.join(os.tmpdir(), `assistant-memory-${Date.now()}.json`);
process.env.ASSISTANT_MEMORY_FILE = tempMemoryPath;

const { extractJson } = require('./assistant_brain.js');
const memory = require('./assistant_memory.js');
const confirmations = require('./assistant_confirmations.js');
const { isDangerousAction } = require('./assistant_tools.js');
const autoMemory = require('./assistant_auto_memory.js');
const reminders = require('./assistant_reminders.js');
const aiHelper = require('./ai_helper.js');

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

  if (
    !isDangerousAction({ type: 'ban_member' })
    || !isDangerousAction({ type: 'lock_channel' })
    || !isDangerousAction({ type: 'set_slowmode' })
    || isDangerousAction({ type: 'recall_memory' })
    || isDangerousAction({ type: 'forget_memory' })
    || isDangerousAction({ type: 'diagnose_permissions' })
    || isDangerousAction({ type: 'inspect_server' })
    || isDangerousAction({ type: 'search_messages' })
    || isDangerousAction({ type: 'schedule_reminder' })
  ) {
    throw new Error('dangerous action classification failed');
  }

  const pending = confirmations.createPendingConfirmation(context, {
    actions: [{ type: 'delete_messages', count: 2 }],
  });
  if (!pending || !confirmations.isConfirmationMessage('xác nhận')) {
    throw new Error('confirmation creation failed');
  }
  if (!confirmations.consumePendingConfirmation(context)?.actions?.length) {
    throw new Error('confirmation consume failed');
  }
  if (confirmations.getPendingConfirmation(context)) {
    throw new Error('confirmation cleanup failed');
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

  await fs.rm(tempMemoryPath, { force: true });
  console.log('assistant smoke test passed');
}

main().catch(async error => {
  await fs.rm(tempMemoryPath, { force: true }).catch(() => null);
  console.error(error);
  process.exit(1);
});
