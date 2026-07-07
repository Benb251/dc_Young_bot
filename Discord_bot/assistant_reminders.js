const fs = require('fs/promises');
const path = require('path');

const REMINDER_PATH = process.env.ASSISTANT_REMINDER_FILE
  || path.join(__dirname, 'data', 'assistant_reminders.json');

const DEFAULT_STORE = {
  reminders: [],
};

const REMINDER_POLL_MS = Math.max(Number(process.env.ASSISTANT_REMINDER_POLL_MS || 30_000), 5_000);

async function ensureStore() {
  await fs.mkdir(path.dirname(REMINDER_PATH), { recursive: true });
  try {
    const raw = await fs.readFile(REMINDER_PATH, 'utf8');
    return { ...DEFAULT_STORE, ...JSON.parse(raw) };
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('[REMINDER] Failed to read store, using empty reminders:', error);
    }
    return { ...DEFAULT_STORE, reminders: [] };
  }
}

async function saveStore(store) {
  await fs.mkdir(path.dirname(REMINDER_PATH), { recursive: true });
  await fs.writeFile(REMINDER_PATH, JSON.stringify(store, null, 2), 'utf8');
}

function parseRelativeTime(input, now = Date.now()) {
  const text = String(input || '').trim().toLowerCase();
  if (!text) return null;

  const compact = text.match(/^(\d+)\s*(m|min|mins|minute|minutes|phut|phút|p)$/i);
  if (compact) return now + Number(compact[1]) * 60_000;

  const compactHours = text.match(/^(\d+)\s*(h|hr|hrs|hour|hours|gio|giờ)$/i);
  if (compactHours) return now + Number(compactHours[1]) * 60 * 60_000;

  const compactDays = text.match(/^(\d+)\s*(d|day|days|ngay|ngày)$/i);
  if (compactDays) return now + Number(compactDays[1]) * 24 * 60 * 60_000;

  const phrase = text.match(/(\d+)\s*(giây|giay|seconds?|secs?|s|phút|phut|minutes?|mins?|m|giờ|gio|hours?|hrs?|h|ngày|ngay|days?|d)/i);
  if (phrase) {
    const amount = Number(phrase[1]);
    const unit = phrase[2];
    if (/giây|giay|sec|s/.test(unit)) return now + amount * 1000;
    if (/phút|phut|min|m/.test(unit)) return now + amount * 60_000;
    if (/giờ|gio|hour|hr|h/.test(unit)) return now + amount * 60 * 60_000;
    if (/ngày|ngay|day|d/.test(unit)) return now + amount * 24 * 60 * 60_000;
  }

  if (/(tomorrow|ngày mai|ngay mai)/i.test(text)) {
    return now + 24 * 60 * 60_000;
  }

  const parsed = Date.parse(input);
  return Number.isNaN(parsed) ? null : parsed;
}

function normalizeReminderInput(args, context, message) {
  const content = String(args.content || args.message || args.text || '').trim().slice(0, 1200);
  const dueInput = args.dueAt || args.due_at || args.when || args.time || args.in;
  const dueAtMs = parseRelativeTime(dueInput);
  if (!content || !dueAtMs) return null;

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    content,
    dueAt: new Date(dueAtMs).toISOString(),
    createdAt: new Date().toISOString(),
    createdBy: context.userId,
    guildId: context.guildId || null,
    channelId: args.channelId || args.channel_id || message.channel?.id || context.channelId || null,
    userId: args.userId || args.user_id || context.userId || null,
    status: 'pending',
  };
}

async function createReminder({ args, context, message }) {
  const reminder = normalizeReminderInput(args, context, message);
  if (!reminder) return null;

  const store = await ensureStore();
  store.reminders.push(reminder);
  const maxReminders = Math.max(Number(process.env.ASSISTANT_MAX_REMINDERS || 500), 50);
  store.reminders = store.reminders.slice(-maxReminders);
  await saveStore(store);
  return reminder;
}

async function listReminders(context, limit = 10) {
  const store = await ensureStore();
  const max = Math.min(Math.max(Number(limit) || 10, 1), 25);
  return store.reminders
    .filter(reminder => reminder.status === 'pending')
    .filter(reminder => {
      if (reminder.guildId && context.guildId && reminder.guildId !== context.guildId) return false;
      return reminder.createdBy === context.userId || reminder.userId === context.userId;
    })
    .sort((a, b) => String(a.dueAt).localeCompare(String(b.dueAt)))
    .slice(0, max);
}

async function cancelReminder(context, id) {
  const store = await ensureStore();
  const wanted = String(id || '').trim();
  const reminder = store.reminders.find(item => item.status === 'pending' && item.id.startsWith(wanted));
  if (!reminder) return null;
  if (reminder.createdBy !== context.userId && reminder.userId !== context.userId) return null;
  reminder.status = 'cancelled';
  reminder.cancelledAt = new Date().toISOString();
  await saveStore(store);
  return reminder;
}

async function markReminderDone(id, status = 'sent', error = null) {
  const store = await ensureStore();
  const reminder = store.reminders.find(item => item.id === id);
  if (!reminder) return null;
  reminder.status = status;
  reminder.sentAt = new Date().toISOString();
  if (error) reminder.error = String(error).slice(0, 500);
  await saveStore(store);
  return reminder;
}

async function getDueReminders(now = Date.now()) {
  const store = await ensureStore();
  return store.reminders
    .filter(reminder => reminder.status === 'pending' && Date.parse(reminder.dueAt) <= now)
    .slice(0, 20);
}

async function sendReminder(client, reminder) {
  const channel = reminder.channelId
    ? await client.channels.fetch(reminder.channelId).catch(() => null)
    : null;
  const targetUser = reminder.userId
    ? await client.users.fetch(reminder.userId).catch(() => null)
    : null;

  const body = [
    `Nhắc nhẹ: ${reminder.content}`,
    reminder.userId ? `<@${reminder.userId}>` : null,
  ].filter(Boolean).join('\n');

  if (channel?.isTextBased?.()) {
    await channel.send(body);
    return;
  }
  if (targetUser) {
    await targetUser.send(body);
    return;
  }
  throw new Error('No reminder channel or user target is reachable');
}

function startReminderLoop(client) {
  async function tick() {
    const due = await getDueReminders();
    for (const reminder of due) {
      try {
        await markReminderDone(reminder.id, 'sending');
        await sendReminder(client, reminder);
        await markReminderDone(reminder.id, 'sent');
        console.log(`[REMINDER] Sent reminder ${reminder.id}`);
      } catch (error) {
        console.error(`[REMINDER] Failed to send ${reminder.id}:`, error);
        await markReminderDone(reminder.id, 'failed', error.message);
      }
    }
  }

  tick().catch(error => console.error('[REMINDER] Initial tick failed:', error));
  return setInterval(() => {
    tick().catch(error => console.error('[REMINDER] Tick failed:', error));
  }, REMINDER_POLL_MS);
}

module.exports = {
  cancelReminder,
  createReminder,
  listReminders,
  parseRelativeTime,
  startReminderLoop,
};
