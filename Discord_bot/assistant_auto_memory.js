const { getAIChatResponse } = require('./ai_helper.js');
const { rememberFact } = require('./assistant_memory.js');

const AUTO_MEMORY_PROMPT = `
You are the memory curator for a Vietnamese Discord assistant.
Extract only durable, useful memories from the latest conversation turn.

Return valid JSON only:
{
  "memories": [
    {
      "scope": "user|channel|guild|global",
      "title": "short label",
      "content": "stable fact worth remembering",
      "tags": ["short", "tags"],
      "confidence": 0.0
    }
  ]
}

Remember only stable facts such as:
- user preferences, skills, goals, projects, tools, workflow preferences
- server rules, channel purpose, role conventions, community decisions
- recurring bot setup preferences or operational notes

Do not remember:
- passwords, tokens, API keys, secrets, private credentials
- one-off small talk, temporary status, jokes, exact message wording
- facts with low confidence or unclear ownership

Use Vietnamese for title/content when natural.
`.trim();

const SECRET_PATTERNS = [
  /token/i,
  /api[_ -]?key/i,
  /password/i,
  /passwd/i,
  /secret/i,
  /authorization/i,
  /bearer\s+[a-z0-9._-]+/i,
  /sk-[a-z0-9_-]{12,}/i,
  /[a-z0-9_-]{24}\.[a-z0-9_-]{6}\.[a-z0-9_-]{20,}/i,
];

function isAutoMemoryEnabled() {
  return String(process.env.ASSISTANT_AUTO_MEMORY || 'true').toLowerCase() !== 'false';
}

function getAutoMemoryLimit() {
  const configured = Number(process.env.ASSISTANT_AUTO_MEMORY_LIMIT || 3);
  if (!Number.isFinite(configured) || configured <= 0) return 3;
  return Math.min(configured, 6);
}

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

function hasSecretLikeText(value) {
  const text = String(value || '');
  return SECRET_PATTERNS.some(pattern => pattern.test(text));
}

function normalizeScope(scope) {
  return ['global', 'guild', 'channel', 'user'].includes(scope) ? scope : 'channel';
}

function normalizeMemoryCandidate(candidate) {
  if (!candidate || typeof candidate !== 'object') return null;
  const title = String(candidate.title || '').trim().slice(0, 120);
  const content = String(candidate.content || '').trim().slice(0, 1200);
  const confidence = Number(candidate.confidence ?? 0);
  const tags = Array.isArray(candidate.tags)
    ? candidate.tags.map(tag => String(tag).trim()).filter(Boolean).slice(0, 8)
    : [];

  if (!title || !content) return null;
  if (confidence < 0.65) return null;
  if (hasSecretLikeText(`${title} ${content} ${tags.join(' ')}`)) return null;

  return {
    scope: normalizeScope(candidate.scope),
    title,
    content,
    tags,
  };
}

function parseMemoryCandidates(text, limit = getAutoMemoryLimit()) {
  let parsed;
  try {
    parsed = extractJson(text);
  } catch {
    return [];
  }

  const memories = Array.isArray(parsed?.memories) ? parsed.memories : [];
  return memories
    .map(normalizeMemoryCandidate)
    .filter(Boolean)
    .slice(0, limit);
}

function buildMemoryPrompt({ userText, assistantText, existingFacts = [] }) {
  const knownFacts = existingFacts.length
    ? existingFacts.map(fact => `- [${fact.scope}] ${fact.title}: ${fact.content}`).join('\n')
    : '- none';

  return [
    `Known related memories:\n${knownFacts}`,
    `User message:\n${String(userText || '').slice(0, 1800)}`,
    `Assistant response:\n${String(assistantText || '').slice(0, 1800)}`,
  ].join('\n\n');
}

async function autoRememberFromTurn({ context, userText, assistantText, existingFacts = [] }) {
  if (!isAutoMemoryEnabled()) return [];
  if (!String(userText || '').trim() || hasSecretLikeText(userText)) return [];

  const raw = await getAIChatResponse([
    { role: 'system', content: AUTO_MEMORY_PROMPT },
    { role: 'user', content: buildMemoryPrompt({ userText, assistantText, existingFacts }) },
  ], [], { includeDefaultSystem: false, temperature: 0.1 });

  const candidates = parseMemoryCandidates(raw);
  const saved = [];
  for (const candidate of candidates) {
    const fact = await rememberFact({ ...candidate, context });
    if (fact) saved.push(fact);
  }
  return saved;
}

module.exports = {
  autoRememberFromTurn,
  hasSecretLikeText,
  isAutoMemoryEnabled,
  parseMemoryCandidates,
};
