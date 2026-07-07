const DEFAULT_TTL_MS = 60_000;
const MAX_TTL_MS = 10 * 60_000;

const pendingConfirmations = new Map();

function getTtlMs() {
  const configured = Number(process.env.ASSISTANT_CONFIRM_TTL_MS);
  if (!Number.isFinite(configured) || configured <= 0) return DEFAULT_TTL_MS;
  return Math.min(configured, MAX_TTL_MS);
}

function buildConfirmationKey(context) {
  return [
    context.guildId || 'dm',
    context.channelId || 'unknown-channel',
    context.userId || 'unknown-user',
  ].join(':');
}

function cleanupExpired(now = Date.now()) {
  for (const [key, pending] of pendingConfirmations.entries()) {
    if (pending.expiresAt <= now) pendingConfirmations.delete(key);
  }
}

function createPendingConfirmation(context, payload) {
  cleanupExpired();
  const ttlMs = getTtlMs();
  const key = buildConfirmationKey(context);
  const pending = {
    ...payload,
    key,
    createdAt: Date.now(),
    expiresAt: Date.now() + ttlMs,
    ttlMs,
  };
  pendingConfirmations.set(key, pending);
  return pending;
}

function getPendingConfirmation(context) {
  cleanupExpired();
  return pendingConfirmations.get(buildConfirmationKey(context)) || null;
}

function consumePendingConfirmation(context) {
  const pending = getPendingConfirmation(context);
  if (!pending) return null;
  pendingConfirmations.delete(buildConfirmationKey(context));
  return pending;
}

function clearPendingConfirmation(context) {
  return pendingConfirmations.delete(buildConfirmationKey(context));
}

function normalizeConfirmationText(content) {
  return String(content || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function isConfirmationMessage(content) {
  const normalized = normalizeConfirmationText(content);
  return ['xac nhan', 'dong y', 'confirm', 'yes', 'ok', 'oke'].includes(normalized);
}

function isCancelMessage(content) {
  const normalized = normalizeConfirmationText(content);
  return ['huy', 'cancel', 'khong', 'no'].includes(normalized);
}

module.exports = {
  buildConfirmationKey,
  clearPendingConfirmation,
  consumePendingConfirmation,
  createPendingConfirmation,
  getPendingConfirmation,
  isCancelMessage,
  isConfirmationMessage,
};
