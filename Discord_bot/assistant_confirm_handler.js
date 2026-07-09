/**
 * Confirmation execution for critical assistant actions.
 *
 * Primary UX: message reactions ✅ / ❌ (reliable on gateway bots).
 * Secondary: button interactions (with raw REST ack so Discord never shows
 * "This interaction failed" if the Node event loop is busy).
 * Tertiary: type "xác nhận" / "hủy".
 */
const fetch = require('node-fetch');
const {
  clearPendingConfirmationByToken,
  consumePendingConfirmationByToken,
  disabledConfirmationComponents,
  getPendingByConfirmMessageId,
  getPendingConfirmationByToken,
  parseConfirmButtonId,
  truncateDiscordContent,
  CONFIRM_CUSTOM_PREFIX,
} = require('./assistant_confirmations.js');
const { executeAssistantActions } = require('./assistant_tools.js');
const { appendConversationTurn } = require('./assistant_memory.js');
const { auditAssistantEvent } = require('./assistant_audit.js');

const CONFIRM_EMOJI = new Set(['✅', '✔️', '☑️', '🆗']);
const CANCEL_EMOJI = new Set(['❌', '✖️', '❎', '✖']);

function buildProxyFromParts({ user, member, channel, guild, client, messageId, url }) {
  return {
    id: messageId,
    author: user,
    member,
    channel,
    guild,
    client,
    content: '',
    url,
    mentions: { users: { first: () => null } },
    reference: null,
  };
}

/** Discord interaction callback does NOT need the bot token. */
async function rawDeferUpdate(interaction) {
  const url = `https://discord.com/api/v10/interactions/${interaction.id}/${interaction.token}/callback`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 6 }), // DEFERRED_UPDATE_MESSAGE
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`raw defer failed HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  // Keep discord.js state in sync best-effort
  try {
    interaction.deferred = true;
  } catch {
    /* ignore */
  }
}

async function rawEditOriginal(interaction, content, components) {
  const appId = interaction.applicationId || interaction.client?.application?.id || interaction.client?.user?.id;
  if (!appId) throw new Error('missing application id for webhook edit');
  const url = `https://discord.com/api/v10/webhooks/${appId}/${interaction.token}/messages/@original`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: truncateDiscordContent(content),
      components: components || [],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`raw edit failed HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
}

async function editConfirmMessageObject(message, content, components) {
  if (!message?.edit) return;
  await message.edit({
    content: truncateDiscordContent(content),
    components: components || [],
  }).catch(error => {
    console.error('[ASSISTANT CONFIRM] message.edit failed:', error?.message || error);
  });
}

async function sendResult(channel, text) {
  if (!channel?.send) return;
  let remaining = String(text || '');
  while (remaining.length > 0) {
    const chunk = remaining.slice(0, 1900);
    remaining = remaining.slice(1900);
    await channel.send(chunk).catch(error => {
      console.error('[ASSISTANT CONFIRM] channel.send failed:', error?.message || error);
    });
  }
}

/**
 * Shared accept/cancel execution for text, reaction, and button paths.
 */
async function executeConfirmDecision({
  pending,
  decision,
  proxyMessage,
  confirmMessage,
  source,
}) {
  const context = {
    guildId: pending.guildId || proxyMessage.guild?.id || null,
    channelId: pending.channelId || proxyMessage.channel?.id || null,
    userId: pending.userId,
  };

  if (decision === 'cancel') {
    clearPendingConfirmationByToken(pending.token);
    await auditAssistantEvent({
      message: proxyMessage,
      actions: pending.actions,
      status: 'cancelled',
      note: `Cancelled via ${source}.`,
    });
    await appendConversationTurn(context, {
      role: 'assistant',
      content: 'Đã hủy yêu cầu đang chờ xác nhận.',
    }).catch(() => null);

    if (confirmMessage) {
      await editConfirmMessageObject(
        confirmMessage,
        `${confirmMessage.content || ''}\n\n❌ Đã hủy.`,
        disabledConfirmationComponents(pending.token, 'cancel')
      );
    }
    return { ok: true, cancelled: true };
  }

  const consumed = consumePendingConfirmationByToken(pending.token);
  if (!consumed) {
    if (confirmMessage) {
      await editConfirmMessageObject(
        confirmMessage,
        `${confirmMessage.content || ''}\n\n⏱️ Yêu cầu đã được xử lý hoặc hết hạn.`,
        disabledConfirmationComponents(pending.token)
      );
    }
    return { ok: false, reason: 'missing' };
  }

  if (confirmMessage) {
    await editConfirmMessageObject(
      confirmMessage,
      `${confirmMessage.content || ''}\n\n⏳ Đang thực hiện…`,
      disabledConfirmationComponents(pending.token, 'accept')
    );
  }

  const actionResults = await executeAssistantActions({
    message: proxyMessage,
    actions: consumed.actions,
    context,
  });
  await auditAssistantEvent({
    message: proxyMessage,
    actions: consumed.actions,
    actionResults,
    status: 'executed_after_confirmation',
    note: `Confirmed via ${source}.`,
  });

  const finalResponse = actionResults.length
    ? `Đã xác nhận và thực hiện.\n\nKết quả hành động:\n${actionResults.join('\n')}`
    : 'Đã xác nhận, nhưng không có hành động nào để thực hiện.';

  await appendConversationTurn(context, { role: 'assistant', content: finalResponse }).catch(() => null);
  await sendResult(proxyMessage.channel, finalResponse);
  return { ok: true, cancelled: false, finalResponse };
}

/**
 * Add ✅ / ❌ reactions for reliable confirmation (gateway bots).
 */
async function attachConfirmReactions(message) {
  if (!message?.react) return;
  try {
    await message.react('✅');
    await message.react('❌');
  } catch (error) {
    console.error('[ASSISTANT CONFIRM] Failed to add reactions:', error?.message || error);
  }
}

/**
 * Handle ✅ / ❌ on a pending confirmation message.
 * @returns {Promise<boolean>}
 */
async function handleConfirmReaction(reaction, user) {
  if (!user || user.bot) return false;

  try {
    if (reaction.partial) await reaction.fetch();
    if (reaction.message?.partial) await reaction.message.fetch();
  } catch (error) {
    console.error('[ASSISTANT CONFIRM] reaction fetch failed:', error?.message || error);
    return false;
  }

  const emoji = reaction.emoji?.name || '';
  const isConfirm = CONFIRM_EMOJI.has(emoji);
  const isCancel = CANCEL_EMOJI.has(emoji);
  if (!isConfirm && !isCancel) return false;

  const message = reaction.message;
  const pending = getPendingByConfirmMessageId(message.id);
  if (!pending) return false;

  if (user.id !== pending.userId) {
    // Remove other users' reactions quietly
    try {
      await reaction.users.remove(user.id);
    } catch {
      /* ignore */
    }
    return true;
  }

  console.log(`[ASSISTANT CONFIRM] reaction ${emoji} from ${user.id} on ${message.id}`);

  const member = message.guild
    ? await message.guild.members.fetch(user.id).catch(() => null)
    : null;

  const proxyMessage = buildProxyFromParts({
    user,
    member,
    channel: message.channel,
    guild: message.guild,
    client: message.client,
    messageId: message.id,
    url: message.url,
  });

  await executeConfirmDecision({
    pending,
    decision: isConfirm ? 'accept' : 'cancel',
    proxyMessage,
    confirmMessage: message,
    source: 'reaction',
  });
  return true;
}

/**
 * Button path — ack via raw REST first (survives busy event loop better).
 * @returns {Promise<boolean>}
 */
async function handleAssistantConfirmationButton(interaction) {
  if (!interaction?.isButton?.()) return false;

  const customId = String(interaction.customId || '');
  if (!customId.startsWith(`${CONFIRM_CUSTOM_PREFIX}:`)) return false;

  console.log(`[ASSISTANT CONFIRM] button customId=${customId} user=${interaction.user?.id}`);

  // 1) ACK within 3s using raw HTTP (does not depend on discord.js queue state).
  try {
    await rawDeferUpdate(interaction);
    console.log('[ASSISTANT CONFIRM] raw defer OK');
  } catch (error) {
    console.error('[ASSISTANT CONFIRM] raw defer failed:', error?.message || error);
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate();
      }
    } catch (error2) {
      console.error('[ASSISTANT CONFIRM] djs defer also failed:', error2?.message || error2);
      try {
        await interaction.reply({ content: 'Đang xử lý…', ephemeral: true });
      } catch {
        /* give up ack */
      }
      return true;
    }
  }

  const parsed = parseConfirmButtonId(customId);
  if (!parsed) {
    try {
      await rawEditOriginal(
        interaction,
        `${interaction.message?.content || ''}\n\n⚠️ Nút không hợp lệ. Hãy react ✅/❌ hoặc gửi lại lệnh.`,
        disabledConfirmationComponents('0000000000000000')
      );
    } catch {
      /* ignore */
    }
    return true;
  }

  const { decision, token } = parsed;
  const livePending = getPendingConfirmationByToken(token);

  try {
    if (!livePending) {
      await rawEditOriginal(
        interaction,
        `${interaction.message?.content || ''}\n\n⏱️ Hết hạn hoặc bot restart. Gửi lại lệnh — rồi bấm ✅ react (ổn định hơn nút).`,
        disabledConfirmationComponents(token)
      );
      return true;
    }

    if (interaction.user.id !== livePending.userId) {
      // Cannot easily ephemeral after deferUpdate; no-op for other users.
      return true;
    }

    const proxyMessage = buildProxyFromParts({
      user: interaction.user,
      member: interaction.member,
      channel: interaction.channel,
      guild: interaction.guild,
      client: interaction.client,
      messageId: interaction.message?.id,
      url: interaction.message?.url,
    });

    // Prefer editing via message object (works after raw ack).
    const confirmMessage = interaction.message;

    if (decision === 'cancel') {
      await executeConfirmDecision({
        pending: livePending,
        decision: 'cancel',
        proxyMessage,
        confirmMessage,
        source: 'button',
      });
      return true;
    }

    await executeConfirmDecision({
      pending: livePending,
      decision: 'accept',
      proxyMessage,
      confirmMessage,
      source: 'button',
    });
  } catch (error) {
    console.error('[ASSISTANT CONFIRM] button process error:', error);
    try {
      await interaction.channel?.send?.(
        `Lỗi khi xử lý xác nhận: ${error.message || error}\nThử react ✅ trên tin xác nhận, hoặc gõ \`xác nhận\`.`
      );
    } catch {
      /* ignore */
    }
  }

  return true;
}

module.exports = {
  attachConfirmReactions,
  executeConfirmDecision,
  handleAssistantConfirmationButton,
  handleConfirmReaction,
};
