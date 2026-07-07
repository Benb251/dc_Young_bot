require('dotenv').config();
const { Client, GatewayIntentBits, ChannelType, PermissionsBitField } = require('discord.js');

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
    
    // Tìm category Onboarding (thường tên chứa 'Onboarding' hoặc lấy kênh chào mừng làm gốc để dò id category)
    const welcomeChannel = guild.channels.cache.get(CHANNEL_CHAO_MUNG);
    const categoryId = welcomeChannel ? welcomeChannel.parentId : null;
    
    console.log('📁 Đang tạo kênh #rules...');
    const rulesChannel = await guild.channels.create({
      name: 'rules',
      type: ChannelType.GuildText,
      parent: categoryId,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionsBitField.Flags.SendMessages],
          allow: [PermissionsBitField.Flags.ViewChannel],
        },
        {
          id: '1522665136953884864', // Bố già đầu hẻm
          allow: [PermissionsBitField.Flags.SendMessages],
        },
        {
          id: '1522665139625791600', // Ban quản viewport
          allow: [PermissionsBitField.Flags.SendMessages],
        }
      ],
      position: 0 // Đưa lên đầu tiên
    });
    console.log(`✅ Kênh #${rulesChannel.name} đã được tạo!`);

    console.log('📤 Đang gửi thông báo nội quy...');
    const sentMessage = await rulesChannel.send(rulesMessage);
    await sentMessage.pin();
    console.log('🎉 Đã gửi và ghim nội quy thành công vào đúng kênh #rules!');
    
  } catch (error) {
    console.error('❌ Lỗi:', error.message);
  }
  
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
