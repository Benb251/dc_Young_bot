require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const CHANNEL_CHAO_MUNG = '1522664673185628324';
const newTopic = 'Cửa vào Tổ Young Phố 🏙️. Vào đây trước, hiểu luật chơi, nói bạn là ai, rồi chọn vai trò để mở đúng góc 3D/design/workflow dành cho mình.';

client.once('ready', async () => {
  console.log(`✅ Đã đăng nhập với bot: ${client.user.tag}`);
  
  try {
    const channel = client.channels.cache.get(CHANNEL_CHAO_MUNG);
    if (!channel) {
      console.error('❌ Không tìm thấy kênh #chào-mừng');
      process.exit(1);
    }
    
    console.log('📝 Đang cập nhật topic (chủ đề) cho kênh #chào-mừng...');
    await channel.setTopic(newTopic);
    console.log('🎉 Cập nhật topic thành công!');
    
  } catch (error) {
    console.error('❌ Lỗi:', error.message);
  }
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
