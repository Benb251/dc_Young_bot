import { BUTTON_IDS, CHANNELS, ROLES, GUILD_ID } from '../config.js';
import { formatWelcomeDescription, parseEmbedColor } from '../defaults.js';
import { discordRequest, sendDiscordMessage } from '../discord.js';
import { getBotConfig, getWelcomeGifs } from '../storage.js';

// Build the visa/welcome panel message (posted to #bắt-đầu)
export async function buildWelcomePanel(env) {
  const config = await getBotConfig(env);
  return {
    embeds: [{
      color: 0x5865F2, // Discord blurple
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
            style: 1, // PRIMARY (blurple)
            custom_id: BUTTON_IDS.VISA_BTN,
            label: config.visaButtonLabel,
            emoji: { name: '🎟️' },
          },
        ],
      },
    ],
  };
}

// Handle when user clicks "Nhận Visa vào Phố"
export async function handleVisa(interaction, env, ctx) {
  const userId = interaction.member.user.id;
  
  // Pick a random GIF from KV or fallback to config
  const gifs = await getWelcomeGifs(env);

  const randomGif = gifs[Math.floor(Math.random() * gifs.length)];
  const config = await getBotConfig(env);

  // Xử lý ngầm (background) để Discord không bị timeout 3 giây
  ctx.waitUntil((async () => {
    try {
      // 1. Lấy thông tin Server để đếm tổng số Member (membercount)
      const guildData = await discordRequest(env, `/guilds/${GUILD_ID}?with_counts=true`);
      const memberCount = guildData.approximate_member_count || guildData.member_count || '?';

      // 2. Assign the Visa role
      await discordRequest(env, `/guilds/${GUILD_ID}/members/${userId}/roles/${ROLES.VISA}`, {
        method: 'PUT',
      });

      // 3. Prepare message color and text
      const colorInt = parseEmbedColor(config.welcomeColor, 0x00B0F4);
      const desc = formatWelcomeDescription(config.welcomeDescription, { userId, memberCount });

      // 4. Send public welcome message to #chao-mung
      await sendDiscordMessage(env, CHANNELS.WELCOME, {
        embeds: [{
          color: colorInt,
          title: config.welcomeTitle,
          description: desc,
          image: {
            url: randomGif
          }
        }]
      });
    } catch (e) {
      console.error(e);
    }
  })());

  // Return ephemeral confirmation to the user NGAY LẬP TỨC
  return {
    type: 4,
    data: {
      embeds: [{
        color: 0x57F287, // Green
        title: '✅ Visa đã được cấp!',
        description: `Chào mừng bạn đã chính thức đặt chân vào **Tổ Young Phố**! 🎉\n\nTiếp theo, hãy ghé kênh <#${CHANNELS.ROLES}> để chọn phần mềm bạn đang sử dụng và **mở khóa khu vực chuyên môn** tương ứng nhé!\n\nChúc bạn có thời gian cháy hết mình cùng anh em! 🔥`,
      }],
      flags: 64, // EPHEMERAL
    },
  };
}
