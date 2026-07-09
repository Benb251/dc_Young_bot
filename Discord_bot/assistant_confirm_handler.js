/**
 * Lightweight, fail-safe confirmation button handler.
 * Must ACK Discord interactions within 3 seconds or the client shows
 * "This interaction failed" / "Tương tác này không thành công".
 */
const {
  clearPendingConfirmationByToken,
  consumePendingConfirmationByToken,
  disabledConfirmationComponents,
  getPendingConfirmationByToken,
  parseConfirmButtonId,
  truncateDiscordContent,
  CONFIRM_CUSTOM_PREFIX,
} = require('./assistant_confirmations.js');
const { executeAssistantActions } = require('./assistant_tools.js');
const { appendConversationTurn } = require('./assistant_memory.js');
const { auditAssistantEvent } = require('./assistant_audit.js');

function buildProxyMessage(interaction) {
  return {
    id: interaction.message?.id,
    author: interaction.user,
    member: interaction.member,
    channel: interaction.channel,
    guild: interaction.guild,
    client: interaction.client,
    content: '',
    url: interaction.message?.url,
    mentions: { users: { first: () => null } },
    reference: null,
  };
}

async function safeAck(interaction) {
  if (interaction.deferred || interaction.replied) return true;
  try {
    await interaction.deferUpdate();
    return true;
  } catch (error) {
    console.error('[ASSISTANT CONFIRM] deferUpdate failed:', error?.message || error);
  }
  try {
    await interaction.reply({ content: 'Đang xử lý xác nhận…', ephemeral: true });
    return true;
  } catch (error) {
    console.error('[ASSISTANT CONFIRM] reply ack failed:', error?.message || error);
  }
  return false;
}

async function safeEditOriginal(interaction, content, components) {
  const payload = {
    content: truncateDiscordContent(content),
    components: components || [],
  };
  try {
    if (interaction.deferred || interaction.replied) {
      // deferUpdate → editReply updates the message with the buttons
      await interaction.editReply(payload);
      return;
    }
    await interaction.update(payload);
    return;
  } catch (error) {
    console.error('[ASSISTANT CONFIRM] editReply/update failed:', error?.message || error);
  }
  try {
    const msg = interaction.message;
    if (msg?.editable) {
      await msg.edit(payload);
      return;
    }
    if (msg?.id && interaction.channel?.messages?.fetch) {
      const fetched = await interaction.channel.messages.fetch(msg.id).catch(() => null);
      if (fetched?.editable) await fetched.edit(payload);
    }
  } catch (error) {
    console.error('[ASSISTANT CONFIRM] message.edit fallback failed:', error?.message || error);
  }
}

async function safeFollowUp(interaction, content) {
  const text = truncateDiscordContent(content, 1900);
  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: text });
      return;
    }
  } catch (error) {
    console.error('[ASSISTANT CONFIRM] followUp failed:', error?.message || error);
  }
  try {
    await interaction.channel?.send?.(text);
  } catch (error) {
    console.error('[ASSISTANT CONFIRM] channel.send failed:', error?.message || error);
  }
}

/**
 * @returns {Promise<boolean>} true if this was an assistant confirm button
 */
async function handleAssistantConfirmationButton(interaction) {
  if (!interaction?.isButton?.()) return false;

  const customId = String(interaction.customId || '');
  if (!customId.startsWith(`${CONFIRM_CUSTOM_PREFIX}:`)) return false;

  // ALWAYS ack first — even if token is bad — so Discord never shows "interaction failed".
  await safeAck(interaction);

  const parsed = parseConfirmButtonId(customId);
  if (!parsed) {
    console.error('[ASSISTANT CONFIRM] Unparsed customId:', customId);
    await safeEditOriginal(
      interaction,
      `${interaction.message?.content || ''}\n\n⚠️ Nút xác nhận không hợp lệ. Hãy gửi lại lệnh.`,
      disabledConfirmationComponents('0000000000000000')
    );
    return true;
  }

  const { decision, token } = parsed;
  console.log(`[ASSISTANT CONFIRM] click decision=${decision} token=${token} user=${interaction.user?.id}`);

  try {
    const livePending = getPendingConfirmationByToken(token);

    if (!livePending) {
      await safeEditOriginal(
        interaction,
        `${interaction.message?.content || ''}\n\n⏱️ Hết hạn hoặc bot đã restart — gửi lại lệnh để xác nhận mới.`,
        disabledConfirmationComponents(token)
      );
      return true;
    }

    if (interaction.user.id !== livePending.userId) {
      await safeFollowUp(interaction, 'Chỉ người yêu cầu hành động mới được bấm xác nhận/hủy.');
      return true;
    }

    const proxyMessage = buildProxyMessage(interaction);
    const context = {
      guildId: livePending.guildId || interaction.guildId || null,
      channelId: livePending.channelId || interaction.channelId || null,
      userId: livePending.userId,
    };

    if (decision === 'cancel') {
      clearPendingConfirmationByToken(token);
      await auditAssistantEvent({
        message: proxyMessage,
        actions: livePending.actions,
        status: 'cancelled',
        note: 'User cancelled via button.',
      });
      await appendConversationTurn(context, {
        role: 'assistant',
        content: 'Đã hủy yêu cầu đang chờ xác nhận.',
      }).catch(() => null);
      await safeEditOriginal(
        interaction,
        `${interaction.message?.content || ''}\n\n❌ Đã hủy.`,
        disabledConfirmationComponents(token, 'cancel')
      );
      return true;
    }

    // accept
    const consumed = consumePendingConfirmationByToken(token);
    if (!consumed) {
      await safeEditOriginal(
        interaction,
        `${interaction.message?.content || ''}\n\n⏱️ Yêu cầu đã được xử lý hoặc hết hạn.`,
        disabledConfirmationComponents(token)
      );
      return true;
    }

    await safeEditOriginal(
      interaction,
      `${interaction.message?.content || ''}\n\n⏳ Đang thực hiện…`,
      disabledConfirmationComponents(token, 'accept')
    );

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
      note: 'Confirmed via button.',
    });

    const finalResponse = actionResults.length
      ? `Đã xác nhận và thực hiện.\n\nKết quả hành động:\n${actionResults.join('\n')}`
      : 'Đã xác nhận, nhưng không có hành động nào để thực hiện.';

    await appendConversationTurn(context, { role: 'assistant', content: finalResponse }).catch(() => null);

    // Chunk follow-ups
    let remaining = finalResponse;
    while (remaining.length > 0) {
      const chunk = remaining.slice(0, 1900);
      remaining = remaining.slice(1900);
      await safeFollowUp(interaction, chunk);
    }
  } catch (error) {
    console.error('[ASSISTANT CONFIRM] handler error:', error);
    await safeFollowUp(
      interaction,
      `Lỗi khi xử lý xác nhận: ${error.message || error}`
    );
  }

  return true;
}

module.exports = {
  handleAssistantConfirmationButton,
};
