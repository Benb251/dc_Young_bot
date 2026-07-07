require('dotenv').config();
const { Client, GatewayIntentBits, ChannelType, PermissionsBitField } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

const GUILD_ID = process.env.GUILD_ID;

// === CẤU TRÚC KÊNH ===
const CATEGORIES = [
  {
    name: '📋 Onboarding',
    channels: [
      { name: 'chào-mừng', type: ChannelType.GuildText, topic: '🎉 Chào mừng bạn đến với Tổ Young Phố! Hãy đọc kỹ nội quy trước khi tham gia.' },
      { name: 'giới-thiệu', type: ChannelType.GuildText, topic: '📝 Thành viên mới hãy giới thiệu bản thân tại đây nhé!' },
      { name: 'chọn-vai-trò', type: ChannelType.GuildText, topic: '🎭 Chọn role cho mình bằng cách bấm vào reaction bên dưới.' },
      { name: 'bắt-đầu', type: ChannelType.GuildText, topic: '📌 Hướng dẫn nhanh dành cho người mới. Đọc để biết cách bắt đầu!' },
    ]
  },
  {
    name: '💬 Chung',
    channels: [
      { name: 'chung', type: ChannelType.GuildText, topic: '🗣️ Trò chuyện tự do, làm quen với mọi người nào!' },
      { name: 'khoe-work', type: ChannelType.GuildText, topic: '🔥 Đăng work của bạn lên đây, nhận feedback từ mọi người!' },
      { name: 'hỏi-đáp', type: ChannelType.GuildText, topic: '❓ Hỏi bài và hỗ trợ kỹ thuật. Ai biết thì giúp đỡ nhé!' },
      { name: 'workflow', type: ChannelType.GuildText, topic: '🔄 Thảo luận về quy trình làm việc, công cụ, mẹo hay.' },
      { name: 'tài-nguyên', type: ChannelType.GuildText, topic: '📦 Chia sẻ addon, material, tutorial và các tài nguyên hữu ích khác.' },
    ]
  },
  {
    name: '🎤 Voice',
    channels: [
      { name: 'Học cùng nhau', type: ChannelType.GuildVoice },
      { name: 'Voice Chat', type: ChannelType.GuildVoice },
    ]
  }
];

client.once('ready', async () => {
  console.log(`✅ Đã đăng nhập với bot: ${client.user.tag}`);

  try {
    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) {
      console.error(`❌ Không tìm thấy Guild với ID: ${GUILD_ID}`);
      console.log('🔍 Các guild có sẵn:');
      client.guilds.cache.forEach(g => console.log(`   - ${g.name} (ID: ${g.id})`));
      process.exit(1);
    }

    console.log(`📍 Đang thao tác trên server: ${guild.name}`);
    console.log('---');

    for (const categoryDef of CATEGORIES) {
      // Tạo category
      console.log(`📁 Đang tạo category: ${categoryDef.name}`);
      const category = await guild.channels.create({
        name: categoryDef.name,
        type: ChannelType.GuildCategory,
      });
      console.log(`   ✅ Đã tạo category: ${categoryDef.name} (ID: ${category.id})`);

      // Tạo các kênh trong category
      for (const channelDef of categoryDef.channels) {
        const channelOptions = {
          name: channelDef.name,
          type: channelDef.type,
          parent: category.id,
        };

        // Nếu là text channel thì thêm topic
        if (channelDef.type === ChannelType.GuildText && channelDef.topic) {
          channelOptions.topic = channelDef.topic;
        }

        const channel = await guild.channels.create(channelOptions);
        const typeLabel = channelDef.type === ChannelType.GuildText ? '📝 Text' : '🎤 Voice';
        console.log(`   ${typeLabel}: #${channelDef.name} (ID: ${channel.id})`);
      }
      console.log('---');
    }

    console.log('🎉 HOÀN THÀNH! Tất cả kênh đã được tạo thành công.');
    console.log(`📊 Tổng kết: ${CATEGORIES.length} categories, ${CATEGORIES.reduce((acc, c) => acc + c.channels.length, 0)} channels`);

  } catch (error) {
    console.error('❌ Lỗi:', error.message);
  }

  process.exit(0);
});

// Đăng nhập bot
client.login(process.env.DISCORD_TOKEN);
