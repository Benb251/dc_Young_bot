import { BUTTON_IDS, CHANNELS, ROLES, GUILD_ID, DISCORD_API, WELCOME_GIFS } from '../config.js';

async function getBotConfig(env) {
  let config = {};
  try {
    const configStr = await env.BOT_CONFIG.get('BOT_CONFIG');
    if (configStr) config = JSON.parse(configStr);
  } catch (e) {}

  const defaults = {
    welcomeTitle: '🎉 Chào mừng đến với Tổ Young Phố!',
    welcomeDescription: `Chào mừng <@{userId}> đến với nơi những đứa trẻ phố phường chia sẻ và phát triển kỹ năng **3D Game Art & Design**.\n\n**Để bắt đầu:**\n• Đọc <#{rulesChannel}> để hiểu quy tắc\n• Đến <#{rolesChannel}> để chọn vai trò\n\nChúc bạn có những trải nghiệm vui vẻ và học hỏi được nhiều thứ tại đây! 🔥\nBạn là thành viên thứ **{memberCount}** của Tổ Young Phố!`,
    welcomeColor: '#00B0F4',
    visaTitle: '🏡 Chào mừng đến với Tổ Young Phố!',
    visaDescription: `Bạn đang đứng trước cổng **Tổ Young Phố** — cộng đồng chia sẻ, học hỏi và cháy hết mình với đam mê 3D, Game & 2D Design!\n\n**Trước khi vào Phố, hãy nhận Visa của bạn** ⬇️`,
    visaButtonLabel: 'Nhận Visa vào Phố 🏡',
  };

  return { ...defaults, ...config };
}

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
  let gifs = [];
  try {
    const gifsStr = await env.BOT_CONFIG.get('WELCOME_GIFS');
    if (gifsStr) gifs = JSON.parse(gifsStr);
  } catch (e) {
    console.error('Error reading KV', e);
  }
  if (gifs.length === 0) gifs = WELCOME_GIFS;

  const randomGif = gifs[Math.floor(Math.random() * gifs.length)];
  const config = await getBotConfig(env);

  // Xử lý ngầm (background) để Discord không bị timeout 3 giây
  ctx.waitUntil((async () => {
    try {
      // 1. Lấy thông tin Server để đếm tổng số Member (membercount)
      const guildRes = await fetch(`${DISCORD_API}/guilds/${GUILD_ID}?with_counts=true`, {
        headers: { 'Authorization': `Bot ${env.DISCORD_TOKEN}` }
      });
      const guildData = await guildRes.json();
      const memberCount = guildData.approximate_member_count || guildData.member_count || '?';

      // 2. Assign the Visa role
      await fetch(`${DISCORD_API}/guilds/${GUILD_ID}/members/${userId}/roles/${ROLES.VISA}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bot ${env.DISCORD_TOKEN}`,
          'Content-Type': 'application/json',
        },
      });

      // 3. Prepare message color and text
      let colorInt = 0x00B0F4;
      try {
        if (config.welcomeColor) {
           colorInt = parseInt(config.welcomeColor.replace('#', ''), 16);
        }
      } catch(e){}

      let desc = config.welcomeDescription
        .replace(/{userId}/g, userId)
        .replace(/{memberCount}/g, memberCount)
        .replace(/{rulesChannel}/g, CHANNELS.RULES)
        .replace(/{rolesChannel}/g, CHANNELS.ROLES);

      // 4. Send public welcome message to #chào-mừng
      await fetch(`${DISCORD_API}/channels/${CHANNELS.WELCOME}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bot ${env.DISCORD_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          embeds: [{
            color: colorInt,
            title: config.welcomeTitle,
            description: desc,
            image: {
              url: randomGif
            }
          }]
        })
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
