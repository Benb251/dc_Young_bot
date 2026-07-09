function truncate(value, max = 700) {
  const text = String(value || '').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3)}...`;
}

function describeAction(action) {
  const type = action?.type || action?.action || 'unknown';
  const args = action?.args || action || {};
  const labelParts = [type];

  if (args.channel || args.channelId || args.channel_name) {
    labelParts.push(`channel=${args.channel || args.channelId || args.channel_name}`);
  }
  if (args.member || args.user || args.userId) {
    labelParts.push(`member=${args.member || args.user || args.userId}`);
  }
  if (args.role || args.roleId || args.role_name) {
    labelParts.push(`role=${args.role || args.roleId || args.role_name}`);
  }
  if (args.name || args.new_name) {
    labelParts.push(`name=${args.name || args.new_name}`);
  }
  if (args.count) {
    labelParts.push(`count=${args.count}`);
  }
  if (args.category || args.parent || args.parentId) {
    labelParts.push(`category=${args.category || args.parent || args.parentId}`);
  }
  if (args.target) {
    labelParts.push(`target=${args.target}`);
  }
  if (args.allow) {
    labelParts.push(`allow=${Array.isArray(args.allow) ? args.allow.join('|') : args.allow}`);
  }
  if (args.deny) {
    labelParts.push(`deny=${Array.isArray(args.deny) ? args.deny.join('|') : args.deny}`);
  }
  if (args.nickname || args.nick) {
    labelParts.push(`nick=${args.nickname || args.nick}`);
  }

  return truncate(labelParts.join(' '), 220);
}

function formatAuditLine({ message, actions = [], actionResults = [], status, note }) {
  const channelLabel = message.guild
    ? `${message.channel?.name || message.channel?.id || 'unknown'} (${message.channel?.id || 'no-id'})`
    : 'DM';
  const actionText = actions.length ? actions.map(describeAction).join('\n') : 'none';
  const resultText = actionResults.length ? actionResults.map(result => truncate(result, 350)).join('\n') : 'none';

  return [
    '[ASSISTANT AUDIT]',
    `status=${status || 'unknown'}`,
    `user=${message.author?.tag || message.author?.username || 'unknown'} (${message.author?.id || 'no-id'})`,
    `guild=${message.guild?.name || 'DM'} (${message.guild?.id || 'dm'})`,
    `channel=${channelLabel}`,
    `actions=\n${actionText}`,
    `results=\n${resultText}`,
    note ? `note=${truncate(note, 500)}` : null,
  ].filter(Boolean).join('\n');
}

async function findAuditChannel(message) {
  const channelId = process.env.ASSISTANT_AUDIT_CHANNEL_ID;
  if (!channelId) return null;

  const cached = message.client.channels.cache.get(channelId);
  if (cached?.isTextBased?.()) return cached;

  const fetched = await message.client.channels.fetch(channelId).catch(error => {
    console.error('[ASSISTANT AUDIT] Failed to fetch audit channel:', error);
    return null;
  });
  return fetched?.isTextBased?.() ? fetched : null;
}

async function auditAssistantEvent({ message, actions = [], actionResults = [], status, note }) {
  const line = formatAuditLine({ message, actions, actionResults, status, note });
  console.log(line);

  const auditChannel = await findAuditChannel(message);
  if (!auditChannel) return;

  await auditChannel.send(`\`\`\`\n${truncate(line, 1850)}\n\`\`\``).catch(error => {
    console.error('[ASSISTANT AUDIT] Failed to send audit message:', error);
  });
}

module.exports = {
  auditAssistantEvent,
  describeAction,
  formatAuditLine,
};
