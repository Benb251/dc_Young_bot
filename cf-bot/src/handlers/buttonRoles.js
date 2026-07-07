import { ROLES, EMOJI, BUTTON_IDS, GUILD_ID } from '../config.js';
import { DEFAULT_ROLE_PANEL_THUMBNAIL } from '../defaults.js';
import { discordRequest } from '../discord.js';
import { getBotConfig } from '../storage.js';

// Map button ID → role ID + display name
const ROLE_MAP = {
  [BUTTON_IDS.ROLE_BLENDER]:   { id: ROLES.BLENDER,   name: 'Blender',         emoji: EMOJI.BLENDER },
  [BUTTON_IDS.ROLE_MAYA]:      { id: ROLES.MAYA,       name: 'Maya / Max',      emoji: EMOJI.MAYA },
  [BUTTON_IDS.ROLE_ZBRUSH]:    { id: ROLES.ZBRUSH,     name: 'ZBrush',          emoji: EMOJI.ZBRUSH },
  [BUTTON_IDS.ROLE_SUBSTANCE]: { id: ROLES.SUBSTANCE,  name: 'Substance',       emoji: EMOJI.SUBSTANCE },
  [BUTTON_IDS.ROLE_2D]:        { id: ROLES.TWO_D,      name: '2D Design',       emoji: EMOJI.TWO_D },
  [BUTTON_IDS.ROLE_BEGINNER]:  { id: ROLES.BEGINNER,   name: 'Beginner',        emoji: EMOJI.BEGINNER },
};

export async function handleButtonRole(interaction, env) {
  const buttonId = interaction.data.custom_id;
  const role = ROLE_MAP[buttonId];
  if (!role) return null;

  const userId = interaction.member.user.id;
  const memberRoles = interaction.member.roles;
  const hasRole = memberRoles.includes(role.id);

  if (hasRole) {
    // Remove role
    await discordRequest(env, `/guilds/${GUILD_ID}/members/${userId}/roles/${role.id}`, {
      method: 'DELETE',
    });
    return {
      type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
      data: {
        content: `${role.emoji} Bạn đã **rời khỏi** nhóm **${role.name}**. Bấm lại để quay trở lại bất kỳ lúc nào!`,
        flags: 64, // EPHEMERAL
      },
    };
  } else {
    // Add role
    await discordRequest(env, `/guilds/${GUILD_ID}/members/${userId}/roles/${role.id}`, {
      method: 'PUT',
    });
    return {
      type: 4,
      data: {
        content: `${role.emoji} Chào mừng bạn đến với nhóm **${role.name}**! Khu vực riêng đã được mở khóa ở thanh bên trái. 🎉`,
        flags: 64,
      },
    };
  }
}

// Build the roles panel message payload (called by /send-roles-panel)
export async function buildRolesPanel(env) {
  const config = await getBotConfig(env);
  const thumbnail = config.rolePanelThumbnail || DEFAULT_ROLE_PANEL_THUMBNAIL;

  return {
    embeds: [{
      color: 0x2b2d31,
      title: 'BẠN ĐANG SỬ DỤNG PHẦN MỀM NÀO?',
      description: `Chào mừng đến với **Tổ Young Phố**! 🏡\n\nĐể giúp server luôn gọn gàng và phù hợp nhất với nhu cầu của bạn, hãy chọn các phần mềm/chuyên môn mà bạn đang sử dụng.\n\n👉 Bấm vào các **nút bên dưới**. Bạn có thể chọn bao nhiêu tùy thích.\nBấm lại lần nữa để **gỡ** nếu muốn.`,
      thumbnail: {
        url: thumbnail,
      },
    }],
    components: [
      {
        type: 1, // ACTION_ROW
        components: [
          {
            type: 2, // BUTTON
            style: 2, // SECONDARY (gray)
            custom_id: BUTTON_IDS.ROLE_BLENDER,
            label: 'Blender',
            emoji: { id: '1522897564255654000', name: 'Blender_logo_no_textsvg' },
          },
          {
            type: 2,
            style: 2,
            custom_id: BUTTON_IDS.ROLE_MAYA,
            label: 'Maya / Max',
            emoji: { id: '1522898226557091840', name: 'autodeskmayalogopng_seeklogo4824' },
          },
          {
            type: 2,
            style: 2,
            custom_id: BUTTON_IDS.ROLE_ZBRUSH,
            label: 'ZBrush',
            emoji: { id: '1522898595311779840', name: 'NicePng_zbrushlogopng_2091028' },
          },
        ],
      },
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 2,
            custom_id: BUTTON_IDS.ROLE_SUBSTANCE,
            label: 'Substance',
            emoji: { id: '1522900833098928138', name: '71288substancepainter' },
          },
          {
            type: 2,
            style: 2,
            custom_id: BUTTON_IDS.ROLE_2D,
            label: '2D Design',
            emoji: { id: '1522900876245602324', name: '958995designpalette' },
          },
          {
            type: 2,
            style: 2,
            custom_id: BUTTON_IDS.ROLE_BEGINNER,
            label: 'Beginner',
            emoji: { name: '📚' },
          },
        ],
      },
    ],
  };
}
