const fs = require('fs/promises');
const path = require('path');

const TASK_PATH = process.env.ASSISTANT_TASK_FILE
  || path.join(__dirname, 'data', 'assistant_tasks.json');

const DEFAULT_STORE = {
  tasks: [],
};

async function ensureStore() {
  await fs.mkdir(path.dirname(TASK_PATH), { recursive: true });
  try {
    const raw = await fs.readFile(TASK_PATH, 'utf8');
    return { ...DEFAULT_STORE, ...JSON.parse(raw) };
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('[TASKS] Failed to read store, using empty tasks:', error);
    }
    return { ...DEFAULT_STORE, tasks: [] };
  }
}

async function saveStore(store) {
  await fs.mkdir(path.dirname(TASK_PATH), { recursive: true });
  await fs.writeFile(TASK_PATH, JSON.stringify(store, null, 2), 'utf8');
}

function normalizePriority(priority) {
  const value = String(priority || 'normal').toLowerCase();
  return ['low', 'normal', 'high', 'urgent'].includes(value) ? value : 'normal';
}

function visibleInContext(task, context) {
  if (task.scope === 'global') return true;
  if (task.scope === 'guild') return task.guildId === context.guildId;
  if (task.scope === 'channel') return task.guildId === context.guildId && task.channelId === context.channelId;
  if (task.scope === 'user') return task.userId === context.userId;
  return false;
}

async function createTask({ args, context }) {
  const title = String(args.title || args.name || '').trim().slice(0, 180);
  const details = String(args.details || args.description || args.content || '').trim().slice(0, 1200);
  if (!title) return null;

  const now = new Date().toISOString();
  const task = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    details,
    status: 'open',
    priority: normalizePriority(args.priority),
    tags: Array.isArray(args.tags) ? args.tags.map(tag => String(tag).slice(0, 40)).slice(0, 8) : [],
    scope: ['global', 'guild', 'channel', 'user'].includes(args.scope) ? args.scope : 'guild',
    guildId: context.guildId || null,
    channelId: context.channelId || null,
    userId: context.userId || null,
    createdBy: context.userId || null,
    createdAt: now,
    updatedAt: now,
  };

  const store = await ensureStore();
  store.tasks.push(task);
  store.tasks = store.tasks.slice(-Math.max(Number(process.env.ASSISTANT_MAX_TASKS || 500), 50));
  await saveStore(store);
  return task;
}

async function listTasks({ context, status = 'open', query = '', limit = 12 }) {
  const store = await ensureStore();
  const max = Math.min(Math.max(Number(limit) || 12, 1), 50);
  const terms = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  return store.tasks
    .filter(task => visibleInContext(task, context))
    .filter(task => !status || status === 'all' || task.status === status)
    .filter(task => {
      if (!terms.length) return true;
      const haystack = `${task.title || ''} ${task.details || ''} ${(task.tags || []).join(' ')}`.toLowerCase();
      return terms.every(term => haystack.includes(term));
    })
    .sort((a, b) => {
      const priorityScore = { urgent: 4, high: 3, normal: 2, low: 1 };
      return (priorityScore[b.priority] || 0) - (priorityScore[a.priority] || 0)
        || String(b.updatedAt).localeCompare(String(a.updatedAt));
    })
    .slice(0, max);
}

async function updateTaskStatus({ context, id, status }) {
  const store = await ensureStore();
  const wanted = String(id || '').trim();
  const task = store.tasks.find(item => (
    visibleInContext(item, context)
    && (item.id === wanted || item.id.startsWith(wanted))
  ));
  if (!task) return null;

  task.status = status;
  task.updatedAt = new Date().toISOString();
  if (status === 'done') task.completedAt = task.updatedAt;
  if (status === 'cancelled') task.cancelledAt = task.updatedAt;
  await saveStore(store);
  return task;
}

module.exports = {
  createTask,
  listTasks,
  updateTaskStatus,
};
