require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const GUILD_ID = process.env.GUILD_ID;
const CHANNEL_CHAO_MUNG = '1522664673185628324';
const CHANNEL_GIOI_THIEU = '1522664674850504775';
const CHANNEL_CHON_VAI_TRO = '1522664676729688247';

const newRulesMessage = `**📜 Nội quy Tổ Young Phố – đọc một lần cho đỡ lạc đường**

Đây là nơi tụi mình cùng học, làm và chia sẻ về 3D, design, workflow và những sản phẩm thực tế. Để mọi thứ diễn ra mượt mà, vui nhưng vẫn tử tế, hãy đọc qua vài luật chơi chung của Tổ:

**1. Thái độ & giao tiếp**
- Tôn trọng mọi người trong mọi tình huống, hạn chế drama.
- Góp ý thẳng vào artwork, idea, workflow; tránh công kích cá nhân, mỉa mai, hạ nhục.
- Nếu thấy nội dung gây khó chịu, dùng report hoặc ping mod, đừng gây chiến trong chat.

**2. Nội dung & kênh**
- Đăng bài đúng kênh, đúng chủ đề (showcase, hỏi bài, resources, thảo luận…).
- Hạn chế spam, flood nhiều dòng; đừng tag người khác hoặc @here/@everyone vô tội vạ.
- Không tự ý quảng cáo dịch vụ, khóa học, server khác nếu chưa được mod/admin đồng ý.

**3. Pháp lý & an toàn**
- Không đăng nội dung trái với Discord Community Guidelines (bạo lực, thù hằn, NSFW quá đà, lừa đảo, raiding…).
- Không chia sẻ tài liệu crack, asset không rõ nguồn hoặc nội dung vi phạm bản quyền.
- Không lợi dụng DM để quấy rối, spam hoặc lôi kéo ra ngoài vì mục đích thiếu rõ ràng.

**4. Nội dung nội bộ & dự án**
- Những thảo luận, tài liệu, hoặc ý tưởng liên quan đến test/beta/dự án đang làm chung trong Tổ nên được tôn trọng; hạn chế mang ra ngoài khi chưa được phép.
- Feedback nội bộ dành cho sản phẩm hoặc dự án trong Tổ là để giúp nhau tốt hơn, không dùng lại để công kích ở nơi khác.

**5. Nếu bạn mới vào Tổ, nên làm thêm 3 bước:**
- Qua kênh <#${CHANNEL_CHAO_MUNG}> để xem hướng dẫn dùng server chi tiết.
- Giới thiệu bản thân ở kênh <#${CHANNEL_GIOI_THIEU}> để mọi người biết bạn là ai và đang làm gì.
- Chọn vai trò phù hợp ở kênh <#${CHANNEL_CHON_VAI_TRO}> để mở các kênh đúng thứ bạn quan tâm.

Tóm lại: cứ thoải mái chia sẻ, hỏi, khoe, chém ý tưởng… miễn là tôn trọng nhau, đúng chỗ và không làm khó người khác. Mod sẽ nhắc nhẹ nếu bạn lỡ tay, và xử lý mạnh hơn nếu cố tình phá.`;

client.once('ready', async () => {
  console.log(`✅ Đã đăng nhập với bot: ${client.user.tag}`);
  
  try {
    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) {
      console.error('❌ Không tìm thấy server.');
      process.exit(1);
    }
    
    const officialRulesChannelId = guild.rulesChannelId;
    if (officialRulesChannelId) {
      const channel = guild.channels.cache.get(officialRulesChannelId);
      console.log(`✅ Tìm thấy kênh rules chính thức: ${channel.name}`);
      
      // Lấy các tin nhắn cũ và xóa tin của bot
      const fetched = await channel.messages.fetch({ limit: 10 });
      const botMessages = fetched.filter(m => m.author.id === client.user.id);
      
      console.log(`🗑️ Đang xóa ${botMessages.size} tin nhắn cũ của bot...`);
      for (const [id, msg] of botMessages) {
        await msg.delete();
      }
      
      console.log('📤 Đang gửi thông báo nội quy mới...');
      const sentMessage = await channel.send(newRulesMessage);
      
      console.log('📌 Đang ghim tin nhắn...');
      await sentMessage.pin();
      
      console.log('🎉 Đã cập nhật và ghim nội quy mới thành công!');
    } else {
      console.log('⚠️ Server chưa set kênh Rules chính thức.');
    }
  } catch (error) {
    console.error('❌ Lỗi:', error.message);
  }
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
