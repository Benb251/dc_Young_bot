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

function createPendingConfirmation(context, payload) {
  cleanupExpired();
  const ttlMs = getTtlMs();
  const key = buildConfirmationKey(context);
  const previous = pendingConfirmations.get(key);
  if (previous?.token) pendingByToken.delete(previous.token);

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
  };
  pendingConfirmations.set(key, pending);
  pendingByToken.set(token, pending);
  return pending;
}

function getPendingConfirmation(context) {
  cleanupExpired();
  return pendingConfirmations.get(buildConfirmationKey(context)) || null;
}

function getPendingConfirmationByToken(token) {
  cleanupExpired();
  if (!token) return null;
  return pendingByToken.get(String(token)) || null;
}

function consumePendingConfirmation(context) {
  const pending = getPendingConfirmation(context);
  if (!pending) return null;
  pendingConfirmations.delete(buildConfirmationKey(context));
  if (pending.token) pendingByToken.delete(pending.token);
  return pending;
}

function consumePendingConfirmationByToken(token) {
  const pending = getPendingConfirmationByToken(token);
  if (!pending) return null;
  pendingConfirmations.delete(pending.key);
  pendingByToken.delete(pending.token);
  return pending;
}

function clearPendingConfirmation(context) {
  const pending = getPendingConfirmation(context);
  if (!pending) return false;
  pendingConfirmations.delete(buildConfirmationKey(context));
  if (pending.token) pendingByToken.delete(pending.token);
  return true;
}

function clearPendingConfirmationByToken(token) {
  const pending = getPendingConfirmationByToken(token);
  if (!pending) return false;
  pendingConfirmations.delete(pending.key);
  pendingByToken.delete(pending.token);
  return true;
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

function parseConfirmButtonId(customId) {
  const raw = String(customId || '');
  // assistant_confirm:accept:<token> | assistant_confirm:cancel:<token>
  const match = raw.match(new RegExp(`^${CONFIRM_CUSTOM_PREFIX}:(accept|cancel):([a-f0-9]{16})$`, 'i'));
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
  const safeToken = String(token || '').slice(0, 16);
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
  isCancelMessage,
  isConfirmButtonId,
  isConfirmationMessage,
  parseConfirmButtonId,
};
