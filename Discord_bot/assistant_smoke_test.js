const fs = require('fs/promises');
const os = require('os');
const path = require('path');

const tempMemoryPath = path.join(os.tmpdir(), `assistant-memory-${Date.now()}.json`);
process.env.ASSISTANT_MEMORY_FILE = tempMemoryPath;

const { extractJson } = require('./assistant_brain.js');
const memory = require('./assistant_memory.js');
const confirmations = require('./assistant_confirmations.js');
const { isDangerousAction } = require('./assistant_tools.js');

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

  if (!isDangerousAction({ type: 'ban_member' }) || isDangerousAction({ type: 'recall_memory' })) {
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

  await fs.rm(tempMemoryPath, { force: true });
  console.log('assistant smoke test passed');
}

main().catch(async error => {
  await fs.rm(tempMemoryPath, { force: true }).catch(() => null);
  console.error(error);
  process.exit(1);
});
