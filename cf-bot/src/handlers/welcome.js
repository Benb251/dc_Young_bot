import { BUTTON_IDS, CHANNELS, ROLES, GUILD_ID } from '../config.js';
import { formatWelcomeDescription, parseEmbedColor } from '../defaults.js';
import { discordRequest, sendDiscordMessage } from '../discord.js';
import { getBotConfig, getWelcomeGifs } from '../storage.js';

// Build the visa/welcome panel message (posted to #bắt-đầu)
export async function buildWelcomePanel(env) {
  const config = await getBotConfig(env);
  return {
    embeds: [{
      color: 0x5865F2,
      title: config.visaTitle,
      description: config.visaDescription,
      fields: [
        {
          name: '📋 Bước tiếp theo sau khi nhận Visa:',
          value: `1. Ghé kênh <#${CHANNELS.ROLES}> để chọn khu vực hoạt động\n2. Đọc qua <#${CHANNELS.RULES}> để giữ gìn khu phố văn minh\n3. Vào kênh chuyên môn và bắt đầu cháy hết mình! 🔥`,
        },
      ],
    }],
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 1,
            custom_id: BUTTON_IDS.VISA_BTN,
            label: config.visaButtonLabel,
            emoji: { name: '🎟️' },
          },
        ],
      },
    ],
  };
}

function memberHasRole(interaction, roleId) {
  const roles = interaction?.member?.roles;
  if (!roles) return false;
  if (Array.isArray(roles)) return roles.includes(roleId);
  // Some payloads nest under roles
  if (Array.isArray(roles?.roles)) return roles.roles.includes(roleId);
  return false;
}

/**
 * Handle "Nhận Visa vào Phố".
 * Role assignment is awaited BEFORE success reply so users never see a false "đã cấp".
 */
export async function handleVisa(interaction, env, ctx) {
  const userId = interaction.member?.user?.id;
  if (!userId) {
    return {
      type: 4,
      data: {
        content: '❌ Không đọc được thông tin thành viên. Thử lại trong server.',
        flags: 64,
      },
    };
  }

  // Already has visa
  if (memberHasRole(interaction, ROLES.VISA)) {
    return {
      type: 4,
      data: {
        embeds: [{
          color: 0xFEE75C,
          title: '🎟️ Bạn đã có Visa rồi',
          description: `Bạn đã là cư dân. Ghé <#${CHANNELS.ROLES}> để chọn khu vực phần mềm nếu chưa chọn nhé!`,
        }],
        flags: 64,
      },
    };
  }

  // 1) Assign role FIRST (must succeed before we claim success)
  try {
    await discordRequest(env, `/guilds/${GUILD_ID}/members/${userId}/roles/${ROLES.VISA}`, {
      method: 'PUT',
    });
  } catch (error) {
    console.error('[VISA] Failed to assign role:', error);
    const detail = String(error?.message || error);
    let hint = 'Kiểm tra: bot có quyền **Manage Roles**, role bot **cao hơn** role Visa, và ROLE id còn đúng.';
    if (detail.includes('50013') || detail.toLowerCase().includes('missing permissions')) {
      hint = 'Bot thiếu quyền hoặc role bot đang **thấp hơn** role Visa trong Server Settings → Roles.';
    }
    return {
      type: 4,
      data: {
        content: `❌ Không cấp được role Visa.\n${hint}\n\nChi tiết: \`${detail.slice(0, 180)}\``,
        flags: 64,
      },
    };
  }

  // 2) Welcome message + GIF in background (must not block the interaction response)
  ctx.waitUntil((async () => {
    try {
      const gifs = await getWelcomeGifs(env);
      const randomGif = gifs[Math.floor(Math.random() * gifs.length)];
      const config = await getBotConfig(env);

      const guildData = await discordRequest(env, `/guilds/${GUILD_ID}?with_counts=true`);
      const memberCount = guildData.approximate_member_count || guildData.member_count || '?';
      const colorInt = parseEmbedColor(config.welcomeColor, 0x00B0F4);
      const desc = formatWelcomeDescription(config.welcomeDescription, { userId, memberCount });

      await sendDiscordMessage(env, CHANNELS.WELCOME, {
        embeds: [{
          color: colorInt,
          title: config.welcomeTitle,
          description: desc,
          image: { url: randomGif },
        }],
      });
    } catch (e) {
      // Role already granted — welcome is best-effort
      console.error('[VISA] Welcome message failed (role was still granted):', e);
    }
  })());

  // 3) Only now tell the user it worked
  return {
    type: 4,
    data: {
      embeds: [{
        color: 0x57F287,
        title: '✅ Visa đã được cấp!',
        description: `Chào mừng bạn đã chính thức đặt chân vào **Tổ Young Phố**! 🎉\n\nTiếp theo, hãy ghé kênh <#${CHANNELS.ROLES}> để chọn phần mềm bạn đang sử dụng và **mở khóa khu vực chuyên môn** tương ứng nhé!\n\nChúc bạn có thời gian cháy hết mình cùng anh em! 🔥`,
      }],
      flags: 64,
    },
  };
}
