const { ChannelType, EmbedBuilder } = require('discord.js');

function getStatusTagIds(parentChannel) {
  if (!parentChannel?.availableTags?.length) {
    return { unsolvedId: null, solvedId: null };
  }
  const unsolvedTag = parentChannel.availableTags.find(tag => String(tag.name).includes('Chưa giải quyết'));
  const solvedTag = parentChannel.availableTags.find(tag => String(tag.name).includes('Đã giải quyết'));
  return {
    unsolvedId: unsolvedTag ? unsolvedTag.id : null,
    solvedId: solvedTag ? solvedTag.id : null,
  };
}

/**
 * Mark a Q&A forum thread as solved by swapping status tags.
 * @returns {Promise<string|null>} human-readable result or null if not applicable
 */
async function markThreadSolved(thread, triggerUser) {
  if (!thread?.isThread?.() || !thread.parentId) {
    return null;
  }

  const parentChannel = thread.parent
    || await thread.guild.channels.fetch(thread.parentId).catch(() => null);
  if (!parentChannel || parentChannel.type !== ChannelType.GuildForum) {
    return 'Thread không thuộc forum Q&A.';
  }

  const { unsolvedId, solvedId } = getStatusTagIds(parentChannel);
  if (!unsolvedId || !solvedId) {
    return 'Forum thiếu tag "Chưa giải quyết" / "Đã giải quyết".';
  }

  const currentTags = thread.appliedTags || [];
  if (currentTags.includes(solvedId) && !currentTags.includes(unsolvedId)) {
    return `Thread "${thread.name}" đã ở trạng thái Đã giải quyết.`;
  }

  const newTags = currentTags
    .filter(id => id !== unsolvedId)
    .concat(solvedId);

  await thread.setAppliedTags([...new Set(newTags)]);

  const solvedEmbed = new EmbedBuilder()
    .setColor('#57F287')
    .setDescription(
      `✅ Bài đăng này đã được đánh dấu là **Đã giải quyết** bởi **${triggerUser?.username || 'admin'}**. Cảm ơn mọi người!`
    );
  await thread.send({ embeds: [solvedEmbed] }).catch(() => null);

  return `Đã đánh dấu thread "${thread.name}" là Đã giải quyết.`;
}

module.exports = {
  getStatusTagIds,
  markThreadSolved,
};
