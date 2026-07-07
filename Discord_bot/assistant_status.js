const fs = require('fs/promises');
const path = require('path');
const { getModelChain } = require('./ai_helper.js');

function getStorePaths() {
  return {
    memory: process.env.ASSISTANT_MEMORY_FILE || path.join(__dirname, 'data', 'assistant_memory.json'),
    reminders: process.env.ASSISTANT_REMINDER_FILE || path.join(__dirname, 'data', 'assistant_reminders.json'),
    warnings: process.env.ASSISTANT_WARNING_FILE || path.join(__dirname, 'data', 'assistant_warnings.json'),
  };
}

async function readJsonStore(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const stat = await fs.stat(filePath);
    return {
      exists: true,
      data: JSON.parse(raw),
      updatedAt: stat.mtime.toISOString(),
      bytes: stat.size,
    };
  } catch (error) {
    if (error.code !== 'ENOENT') {
      return {
        exists: false,
        data: fallback,
        error: error.message,
      };
    }
    return {
      exists: false,
      data: fallback,
    };
  }
}

function countBy(items, getter) {
  return items.reduce((acc, item) => {
    const key = getter(item) || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

async function collectAssistantStatus(client) {
  const paths = getStorePaths();
  const [memory, reminders, warnings] = await Promise.all([
    readJsonStore(paths.memory, { facts: [], conversations: {} }),
    readJsonStore(paths.reminders, { reminders: [] }),
    readJsonStore(paths.warnings, { warnings: [] }),
  ]);

  const reminderItems = Array.isArray(reminders.data.reminders) ? reminders.data.reminders : [];
  const warningItems = Array.isArray(warnings.data.warnings) ? warnings.data.warnings : [];
  const facts = Array.isArray(memory.data.facts) ? memory.data.facts : [];
  const conversations = memory.data.conversations || {};
  const guilds = client?.guilds?.cache?.size ?? 0;
  const channels = client?.channels?.cache?.size ?? 0;

  return {
    runtime: {
      bot: client?.user?.tag || 'unknown',
      uptimeSeconds: Math.floor(process.uptime()),
      node: process.version,
      guilds,
      channels,
      pingMs: client?.ws?.ping ?? null,
    },
    ai: {
      endpoint: process.env.AI_ENDPOINT || 'http://localhost:20128/v1',
      modelChain: getModelChain(),
      timeoutMs: Number(process.env.AI_TIMEOUT_MS || 60_000),
      maxRetries: Number(process.env.AI_MAX_RETRIES || 1),
    },
    memory: {
      path: paths.memory,
      exists: memory.exists,
      updatedAt: memory.updatedAt || null,
      facts: facts.length,
      factsByScope: countBy(facts, fact => fact.scope),
      conversations: Object.keys(conversations).length,
      error: memory.error || null,
    },
    reminders: {
      path: paths.reminders,
      exists: reminders.exists,
      updatedAt: reminders.updatedAt || null,
      total: reminderItems.length,
      byStatus: countBy(reminderItems, reminder => reminder.status),
      error: reminders.error || null,
    },
    warnings: {
      path: paths.warnings,
      exists: warnings.exists,
      updatedAt: warnings.updatedAt || null,
      total: warningItems.length,
      byStatus: countBy(warningItems, warning => warning.status),
      error: warnings.error || null,
    },
  };
}

function formatAssistantStatus(status) {
  return [
    `Assistant status for ${status.runtime.bot}:`,
    `- Uptime: ${status.runtime.uptimeSeconds}s | Node: ${status.runtime.node} | Ping: ${status.runtime.pingMs ?? 'unknown'}ms`,
    `- Cached guilds/channels: ${status.runtime.guilds}/${status.runtime.channels}`,
    `- AI endpoint: ${status.ai.endpoint}`,
    `- AI models: ${status.ai.modelChain.join(' -> ')}`,
    `- AI timeout/retries: ${status.ai.timeoutMs}ms / ${status.ai.maxRetries}`,
    `- Memory: ${status.memory.facts} facts, ${status.memory.conversations} conversations, scopes=${JSON.stringify(status.memory.factsByScope)}`,
    `- Reminders: ${status.reminders.total}, statuses=${JSON.stringify(status.reminders.byStatus)}`,
    `- Warnings: ${status.warnings.total}, statuses=${JSON.stringify(status.warnings.byStatus)}`,
    `- Stores exist: memory=${status.memory.exists}, reminders=${status.reminders.exists}, warnings=${status.warnings.exists}`,
  ].join('\n');
}

module.exports = {
  collectAssistantStatus,
  formatAssistantStatus,
  getStorePaths,
};
