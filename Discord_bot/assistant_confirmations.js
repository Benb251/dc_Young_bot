const crypto = require('crypto');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

const DEFAULT_TTL_MS = 60_000;
const MAX_TTL_MS = 10 * 60_000;

const CONFIRM_CUSTOM_PREFIX = 'assistant_confirm';

const pendingConfirmations = new Map();
const pendingByToken = new Map();

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
    if (pending.expiresAt <= now) {
      pendingConfirmations.delete(key);
      if (pending.token) pendingByToken.delete(pending.token);
    }
  }
}

function indexPending(pending) {
  pendingConfirmations.set(pending.key, pending);
  if (pending.token) pendingByToken.set(pending.token, pending);
}

function unindexPending(pending) {
  if (!pending) return;
  pendingConfirmations.delete(pending.key);
  if (pending.token) pendingByToken.delete(pending.token);
}

function createPendingConfirmation(context, payload) {
  cleanupExpired();
  const ttlMs = getTtlMs();
  const key = buildConfirmationKey(context);
  const previous = pendingConfirmations.get(key);
  if (previous) unindexPending(previous);

  // One pending per user at a time (avoids orphaned button tokens in other channels).
  if (context.userId) {
    for (const existing of [...pendingConfirmations.values()]) {
      if (existing.userId === context.userId) unindexPending(existing);
    }
  }

  const token = crypto.randomBytes(8).toString('hex');
  const pending = {
    ...payload,
    key,
    token,
    userId: context.userId || payload.userId || null,
    guildId: context.guildId || null,
    channelId: context.channelId || null,
    createdAt: Date.now(),
    expiresAt: Date.now() + ttlMs,
    ttlMs,
    confirmMessageId: null,
  };
  indexPending(pending);
  return pending;
}

function getPendingConfirmation(context) {
  cleanupExpired();
  return pendingConfirmations.get(buildConfirmationKey(context)) || null;
}

function getPendingConfirmationForUser(userId) {
  cleanupExpired();
  if (!userId) return null;
  for (const pending of pendingConfirmations.values()) {
    if (pending.userId === userId) return pending;
  }
  return null;
}

function getPendingConfirmationFlexible(context) {
  return getPendingConfirmation(context) || getPendingConfirmationForUser(context?.userId);
}

function getPendingConfirmationByToken(token) {
  cleanupExpired();
  if (!token) return null;
  return pendingByToken.get(String(token).toLowerCase()) || null;
}

function consumePendingConfirmation(context) {
  const pending = getPendingConfirmationFlexible(context);
  if (!pending) return null;
  unindexPending(pending);
  return pending;
}

function consumePendingConfirmationByToken(token) {
  const pending = getPendingConfirmationByToken(token);
  if (!pending) return null;
  unindexPending(pending);
  return pending;
}

function clearPendingConfirmation(context) {
  const pending = getPendingConfirmationFlexible(context);
  if (!pending) return false;
  unindexPending(pending);
  return true;
}

function clearPendingConfirmationByToken(token) {
  const pending = getPendingConfirmationByToken(token);
  if (!pending) return false;
  unindexPending(pending);
  return true;
}

function normalizeConfirmationText(content) {
  return String(content || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isConfirmationMessage(content) {
  const normalized = normalizeConfirmationText(content);
  if (!normalized) return false;
  if (['xac nhan', 'dong y', 'confirm', 'yes', 'ok', 'oke', 'y', 'yea', 'yeah'].includes(normalized)) {
    return true;
  }
  // Allow short phrases like "ok xac nhan", "xac nhan nhe"
  if (/^(ok|oke|yes|y|vangi|vang)?\s*xac nhan\b/.test(normalized)) return true;
  if (/^dong y\b/.test(normalized)) return true;
  if (/^confirm\b/.test(normalized)) return true;
  return false;
}

function isCancelMessage(content) {
  const normalized = normalizeConfirmationText(content);
  if (!normalized) return false;
  if (['huy', 'cancel', 'khong', 'no', 'n', 'stop', 'bo qua'].includes(normalized)) {
    return true;
  }
  if (/^(ok|oke)?\s*huy\b/.test(normalized)) return true;
  if (/^cancel\b/.test(normalized)) return true;
  if (/^bo qua\b/.test(normalized)) return true;
  return false;
}

function parseConfirmButtonId(customId) {
  const raw = String(customId || '');
  // assistant_confirm:accept:<token> | assistant_confirm:cancel:<token>
  // ignore trailing :done on disabled buttons
  const match = raw.match(new RegExp(`^${CONFIRM_CUSTOM_PREFIX}:(accept|cancel):([a-f0-9]{16})(?::done)?$`, 'i'));
  if (!match) return null;
  return { decision: match[1].toLowerCase(), token: match[2].toLowerCase() };
}

function isConfirmButtonId(customId) {
  return Boolean(parseConfirmButtonId(customId));
}

function buildConfirmationComponents(token) {
  const safeToken = String(token || '').slice(0, 16);
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${CONFIRM_CUSTOM_PREFIX}:accept:${safeToken}`)
        .setLabel('Xác nhận')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅'),
      new ButtonBuilder()
        .setCustomId(`${CONFIRM_CUSTOM_PREFIX}:cancel:${safeToken}`)
        .setLabel('Hủy')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('❌'),
    ),
  ];
}

function disabledConfirmationComponents(token, chosen = null) {
  const safeToken = String(token || '0000000000000000').slice(0, 16);
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`${CONFIRM_CUSTOM_PREFIX}:accept:${safeToken}:done`)
        .setLabel(chosen === 'accept' ? 'Đã xác nhận' : 'Xác nhận')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅')
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(`${CONFIRM_CUSTOM_PREFIX}:cancel:${safeToken}:done`)
        .setLabel(chosen === 'cancel' ? 'Đã hủy' : 'Hủy')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('❌')
        .setDisabled(true),
    ),
  ];
}

function truncateDiscordContent(text, max = 2000) {
  const value = String(text || '');
  if (value.length <= max) return value;
  return `${value.slice(0, max - 3)}...`;
}

module.exports = {
  CONFIRM_CUSTOM_PREFIX,
  buildConfirmationComponents,
  buildConfirmationKey,
  clearPendingConfirmation,
  clearPendingConfirmationByToken,
  consumePendingConfirmation,
  consumePendingConfirmationByToken,
  createPendingConfirmation,
  disabledConfirmationComponents,
  getPendingConfirmation,
  getPendingConfirmationByToken,
  getPendingConfirmationFlexible,
  getPendingConfirmationForUser,
  isCancelMessage,
  isConfirmButtonId,
  isConfirmationMessage,
  parseConfirmButtonId,
  truncateDiscordContent,
};
