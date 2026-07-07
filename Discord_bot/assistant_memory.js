const fs = require('fs/promises');
const path = require('path');

const MEMORY_PATH = process.env.ASSISTANT_MEMORY_FILE
  || path.join(__dirname, 'data', 'assistant_memory.json');

const DEFAULT_MEMORY = {
  facts: [],
  conversations: {},
};

async function ensureStore() {
  await fs.mkdir(path.dirname(MEMORY_PATH), { recursive: true });
  try {
    const raw = await fs.readFile(MEMORY_PATH, 'utf8');
    return { ...DEFAULT_MEMORY, ...JSON.parse(raw) };
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('[MEMORY] Failed to read store, using empty memory:', error);
    }
    return { ...DEFAULT_MEMORY, facts: [], conversations: {} };
  }
}

async function saveStore(store) {
  await fs.mkdir(path.dirname(MEMORY_PATH), { recursive: true });
  await fs.writeFile(MEMORY_PATH, JSON.stringify(store, null, 2), 'utf8');
}

function normalizeScope(scope) {
  return ['global', 'guild', 'channel', 'user'].includes(scope) ? scope : 'channel';
}

function buildContextKey({ guildId, channelId, userId }) {
  return [guildId || 'dm', channelId || 'dm', userId || 'unknown'].join(':');
}

function scoreFact(fact, query, context) {
  let score = 0;
  const haystack = `${fact.title || ''} ${fact.content || ''} ${(fact.tags || []).join(' ')}`.toLowerCase();
  const terms = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  for (const term of terms) {
    if (term.length > 2 && haystack.includes(term)) score += 2;
  }
  if (fact.scope === 'global') score += 1;
  if (fact.scope === 'guild' && fact.guildId === context.guildId) score += 2;
  if (fact.scope === 'channel' && fact.channelId === context.channelId) score += 3;
  if (fact.scope === 'user' && fact.userId === context.userId) score += 3;
  return score;
}

async function rememberFact({ scope, title, content, tags = [], context }) {
  const store = await ensureStore();
  const now = new Date().toISOString();
  const fact = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    scope: normalizeScope(scope),
    title: String(title || 'Ghi nhớ').slice(0, 120),
    content: String(content || '').slice(0, 1200),
    tags: Array.isArray(tags) ? tags.map(tag => String(tag).slice(0, 40)).slice(0, 8) : [],
    guildId: context.guildId || null,
    channelId: context.channelId || null,
    userId: context.userId || null,
    createdAt: now,
    updatedAt: now,
  };

  if (!fact.content.trim()) return null;
  store.facts.push(fact);
  store.facts = store.facts.slice(-Number(process.env.ASSISTANT_MAX_FACTS || 500));
  await saveStore(store);
  return fact;
}

async function recallFacts(query, context, limit = 8) {
  const store = await ensureStore();
  return store.facts
    .map(fact => ({ fact, score: scoreFact(fact, query, context) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || String(b.fact.updatedAt).localeCompare(String(a.fact.updatedAt)))
    .slice(0, limit)
    .map(item => item.fact);
}

async function appendConversationTurn(context, turn) {
  const store = await ensureStore();
  const key = buildContextKey(context);
  const current = store.conversations[key] || [];
  current.push({
    role: turn.role,
    content: String(turn.content || '').slice(0, 1800),
    at: new Date().toISOString(),
  });
  store.conversations[key] = current.slice(-Number(process.env.ASSISTANT_CONVERSATION_TURNS || 16));
  await saveStore(store);
}

async function getConversationContext(context) {
  const store = await ensureStore();
  return store.conversations[buildContextKey(context)] || [];
}

module.exports = {
  appendConversationTurn,
  getConversationContext,
  recallFacts,
  rememberFact,
};
