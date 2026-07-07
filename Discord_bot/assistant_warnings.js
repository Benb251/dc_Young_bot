const fs = require('fs/promises');
const path = require('path');

const WARNING_PATH = process.env.ASSISTANT_WARNING_FILE
  || path.join(__dirname, 'data', 'assistant_warnings.json');

const DEFAULT_STORE = {
  warnings: [],
};

async function ensureStore() {
  await fs.mkdir(path.dirname(WARNING_PATH), { recursive: true });
  try {
    const raw = await fs.readFile(WARNING_PATH, 'utf8');
    return { ...DEFAULT_STORE, ...JSON.parse(raw) };
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('[WARNINGS] Failed to read store, using empty warnings:', error);
    }
    return { ...DEFAULT_STORE, warnings: [] };
  }
}

async function saveStore(store) {
  await fs.mkdir(path.dirname(WARNING_PATH), { recursive: true });
  await fs.writeFile(WARNING_PATH, JSON.stringify(store, null, 2), 'utf8');
}

async function createWarning({ guildId, memberId, moderatorId, reason, contextMessageId = null }) {
  const store = await ensureStore();
  const now = new Date().toISOString();
  const warning = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    guildId: guildId || null,
    memberId: String(memberId || ''),
    moderatorId: moderatorId || null,
    reason: String(reason || 'No reason provided.').trim().slice(0, 1000),
    contextMessageId,
    createdAt: now,
    status: 'active',
  };

  if (!warning.guildId || !warning.memberId) return null;
  store.warnings.push(warning);
  store.warnings = store.warnings.slice(-Math.max(Number(process.env.ASSISTANT_MAX_WARNINGS || 1000), 100));
  await saveStore(store);
  return warning;
}

async function listWarnings({ guildId, memberId = null, limit = 10 }) {
  const store = await ensureStore();
  const max = Math.min(Math.max(Number(limit) || 10, 1), 50);
  return store.warnings
    .filter(warning => warning.guildId === guildId && warning.status === 'active')
    .filter(warning => !memberId || warning.memberId === String(memberId))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, max);
}

async function clearWarning({ guildId, id, moderatorId }) {
  const store = await ensureStore();
  const wanted = String(id || '').trim();
  const warning = store.warnings.find(item => (
    item.guildId === guildId
    && item.status === 'active'
    && (item.id === wanted || item.id.startsWith(wanted))
  ));
  if (!warning) return null;

  warning.status = 'cleared';
  warning.clearedAt = new Date().toISOString();
  warning.clearedBy = moderatorId || null;
  await saveStore(store);
  return warning;
}

module.exports = {
  clearWarning,
  createWarning,
  listWarnings,
};
