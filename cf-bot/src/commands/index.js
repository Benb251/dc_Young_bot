// Slash command definitions for registration
import { sendDiscordMessage, updateDiscordMessage } from '../discord.js';
import { formatWelcomeDescription, parseEmbedColor } from '../defaults.js';
import { getBotConfig, getWelcomeGifs } from '../storage.js';

export const commands = [
  {
    name: 'ping',
    description: '🏓 Test xem bot còn sống không',
  },
  {
    name: 'send-roles-panel',
    description: '🎭 Gửi bảng Button Roles vào kênh chỉ định (Admin only)',
    default_member_permissions: '8', // ADMINISTRATOR
    options: [
      {
        name: 'channel',
        description: 'Kênh để gửi bảng roles (mặc định: #chọn-vai-trò)',
        type: 7, // CHANNEL
        required: false,
      },
    ],
  },
  {
    name: 'send-welcome-panel',
    description: '🚀 Gửi nút "Nhận Visa vào Phố" vào kênh chỉ định (Admin only)',
    default_member_permissions: '8', // ADMINISTRATOR
    options: [
      {
        name: 'channel',
        description: 'Kênh để gửi welcome panel (mặc định: #bắt-đầu)',
        type: 7,
        required: false,
      },
    ],
  },
  {
    name: 'test-welcome',
    description: '👀 Xem thử mẫu tin nhắn chào mừng Public (để dễ hình dung)',
    default_member_permissions: '8', // ADMINISTRATOR
  },
  {
    name: 'send-rules-panel',
    description: '📜 Gửi bảng Nội Quy (Rules) vào kênh chỉ định (Admin only)',
    default_member_permissions: '8',
    options: [
      {
        name: 'channel',
        description: 'Kênh để gửi Rules (mặc định: #rules)',
        type: 7,
        required: false,
      },
    ],
  },
  {
    name: 'edit-panel',
    description: '✏️ Sửa đè một Panel đã gửi (Luật / Visa / Roles) bằng Message ID',
    default_member_permissions: '8',
    options: [
      {
        name: 'type',
        description: 'Loại bảng muốn sửa',
        type: 3, // STRING
        required: true,
        choices: [
          { name: '📜 Bảng Nội Quy (Rules)', value: 'rules' },
          { name: '🚀 Bảng Nhận Visa', value: 'visa' },
          { name: '🎭 Bảng Chọn Vai Trò (Roles)', value: 'roles' },
        ],
      },
      {
        name: 'message_id',
        description: 'ID của tin nhắn muốn sửa đè',
        type: 3, // STRING
        required: true,
      },
      {
        name: 'channel',
        description: 'Kênh chứa tin nhắn (mặc định: kênh hiện tại)',
        type: 7, // CHANNEL
        required: false,
      }
    ],
  },
];

export async function handleSlashCommand(interaction, env) {
  const { name } = interaction.data;

  switch (name) {
    case 'ping':
      return {
        type: 4,
        data: {
          content: '🏓 Pong! Bot đang hoạt động trên Cloudflare Workers. Tốc độ bàn thờ!',
          flags: 64,
        },
      };

    case 'send-roles-panel': {
      const { buildRolesPanel } = await import('../handlers/buttonRoles.js');
      const { CHANNELS } = await import('../config.js');

      // Get target channel from option, or default to CHANNELS.ROLES
      const channelOption = interaction.data.options?.find(o => o.name === 'channel');
      const channelId = channelOption?.value ?? CHANNELS.ROLES;
      const panelPayload = await buildRolesPanel(env);

      // Send panel to channel via Discord REST API
      await sendDiscordMessage(env, channelId, panelPayload);

      return {
        type: 4,
        data: {
          content: `✅ Đã gửi bảng Button Roles vào <#${channelId}>!`,
          flags: 64,
        },
      };
    }

    case 'send-welcome-panel': {
      const { buildWelcomePanel } = await import('../handlers/welcome.js');
      const { CHANNELS } = await import('../config.js');

      const channelOption = interaction.data.options?.find(o => o.name === 'channel');
      const channelId = channelOption?.value ?? CHANNELS.START;
      const panelPayload = await buildWelcomePanel(env);

      await sendDiscordMessage(env, channelId, panelPayload);

      return {
        type: 4,
        data: {
          content: `✅ Đã gửi Welcome Panel vào <#${channelId}>!`,
          flags: 64,
        },
      };
    }

    case 'test-welcome': {
      const userId = interaction.member.user.id;
      const gifs = await getWelcomeGifs(env);
      const randomGif = gifs[Math.floor(Math.random() * gifs.length)];
      const finalConfig = await getBotConfig(env);
      const colorInt = parseEmbedColor(finalConfig.welcomeColor, 0x00B0F4);
      const desc = formatWelcomeDescription(finalConfig.welcomeDescription, {
        userId,
        memberCount: '999',
      });

      return {
        type: 4,
        data: {
          embeds: [{
            color: colorInt,
            title: finalConfig.welcomeTitle,
            description: desc,
            image: {
              url: randomGif
            }
          }],
          flags: 64, // Ephemeral so only the admin testing it can see it
        },
      };
    }

    case 'send-rules-panel': {
      const { buildRulesPanel } = await import('../handlers/rules.js');
      const { CHANNELS } = await import('../config.js');

      const channelOption = interaction.data.options?.find(o => o.name === 'channel');
      const channelId = channelOption?.value ?? CHANNELS.RULES;
      const panelPayload = await buildRulesPanel(env);

      await sendDiscordMessage(env, channelId, panelPayload);

      return {
        type: 4,
        data: {
          content: `✅ Đã gửi Bảng Nội Quy vào <#${channelId}>!`,
          flags: 64,
        },
      };
    }

    case 'edit-panel': {
      const typeOption = interaction.data.options?.find(o => o.name === 'type');
      const msgIdOption = interaction.data.options?.find(o => o.name === 'message_id');
      const channelOption = interaction.data.options?.find(o => o.name === 'channel');

      const type = typeOption.value;
      const messageId = msgIdOption.value;
      const channelId = channelOption ? channelOption.value : interaction.channel_id;

      let payload = {};
      if (type === 'rules') {
        const { buildRulesPanel } = await import('../handlers/rules.js');
        payload = await buildRulesPanel(env);
      } else if (type === 'visa') {
        const { buildWelcomePanel } = await import('../handlers/welcome.js');
        payload = await buildWelcomePanel(env);
      } else if (type === 'roles') {
        const { buildRolesPanel } = await import('../handlers/buttonRoles.js');
        payload = await buildRolesPanel(env);
      }

      try {
        await updateDiscordMessage(env, channelId, messageId, payload);
      } catch (error) {
        console.error('Failed to edit panel:', error);
        return {
          type: 4,
          data: {
            content: `❌ Lỗi khi sửa tin nhắn (ID: \`${messageId}\`). Vui lòng kiểm tra lại ID và Kênh!`,
            flags: 64,
          },
        };
      }

      return {
        type: 4,
        data: {
          content: `✅ Đã sửa đè Bảng **${type.toUpperCase()}** tại <#${channelId}>!`,
          flags: 64,
        },
      };
    }

    default:
      return {
        type: 4,
        data: { content: '❓ Command không xác định.', flags: 64 },
      };
  }
}
