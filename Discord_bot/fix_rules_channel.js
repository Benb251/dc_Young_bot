require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

const GUILD_ID = process.env.GUILD_ID;
const CHANNEL_CHAO_MUNG = '1522664673185628324';
const CHANNEL_CHON_VAI_TRO = '1522664676729688247';

const rulesMessage = `**📌 Nội quy & hướng dẫn nhanh cho Tổ Young Phố**  
  
Chào mừng bạn đến với Tổ Young Phố – chỗ tụ tập của những người mê 3D, design, workflow và dựng sản phẩm thực tế.  
  
**Tóm tắt luật chơi:**  
- Tôn trọng nhau, góp ý thẳng nhưng không công kích cá nhân.  
- Chém vào artwork, idea, workflow; đừng chém vào con người phía sau.  
- Đăng đúng kênh, đúng chủ đề; hạn chế spam, tag linh tinh và kéo tương tác bừa.  
- Không nội dung bẩn, lừa đảo, vi phạm bản quyền hoặc asset/tài liệu crack.  
- Tôn trọng các thảo luận nội bộ, nhất là những thứ liên quan đến test/beta/dự án đang làm chung.  
  
**Nếu bạn mới vào Tổ, làm 3 bước này trước:**  
1. Đọc hết nội quy trong kênh này để hiểu luật chơi chung.  
2. Qua kênh <#${CHANNEL_CHAO_MUNG}> để xem lời chào và giới thiệu bản thân nhé.  
3. Lấy role / chọn vai trò ở kênh <#${CHANNEL_CHON_VAI_TRO}> để mở các kênh phù hợp với thứ bạn quan tâm.  
  
Nếu có gì chưa rõ, cứ hỏi thẳng ở kênh hỗ trợ hoặc ping mod – tụi mình ở đây để giúp bạn học và làm được nhiều thứ hơn, không phải để làm khó nhau.`;

client.once('ready', async () => {
  console.log(`✅ Đã đăng nhập với bot: ${client.user.tag}`);
  
  try {
    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) {
      console.error('❌ Không tìm thấy server.');
      process.exit(1);
    }
    
    // Tìm kênh rules chính thức của server (guild.rulesChannelId)
    const officialRulesChannelId = guild.rulesChannelId;
    let officialRulesChannel = null;
    
    if (officialRulesChannelId) {
      officialRulesChannel = guild.channels.cache.get(officialRulesChannelId);
      console.log(`✅ Tìm thấy kênh rules chính thức: ${officialRulesChannel.name} (ID: ${officialRulesChannel.id})`);
    }

    // Tìm và xóa kênh rules thừa vừa tạo (nằm trong Onboarding, không phải rulesChannel gốc)
    const allRulesChannels = guild.channels.cache.filter(c => c.name === 'rules');
    
    for (const [id, channel] of allRulesChannels) {
      if (id !== officialRulesChannelId) {
        console.log(`🗑️ Đang xóa kênh rules thừa (ID: ${id})...`);
        await channel.delete('Xóa kênh rules thừa');
        console.log(`✅ Đã xóa!`);
      }
    }

    // Nếu có kênh chính thức, gửi và ghim nội quy vào đó
    if (officialRulesChannel) {
      console.log('📤 Đang gửi thông báo vào kênh rules chính thức...');
      const sentMessage = await officialRulesChannel.send(rulesMessage);
      await sentMessage.pin();
      console.log('🎉 Đã gửi và ghim nội quy thành công vào đúng kênh ☑ rules!');
    } else {
      console.log('⚠️ Server chưa set kênh Rules chính thức trong cài đặt Community.');
    }
    
  } catch (error) {
    console.error('❌ Lỗi:', error.message);
  }
  
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
