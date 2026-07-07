require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ]
});

const GUILD_ID = process.env.GUILD_ID;
// ID của kênh chọn vai trò
const CHANNEL_ID = '1522664676729688247'; // ID của kênh chọn-vai-trò được tạo ở bước trước

client.once('ready', async () => {
  console.log(`✅ Đã đăng nhập với bot: ${client.user.tag}`);

  try {
    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) {
      console.error('❌ Không tìm thấy server.');
      process.exit(1);
    }

    // Lấy toàn bộ danh sách emoji của server để phân tích ID
    console.log('🔍 Đang lấy danh sách emoji của server...');
    const emojis = await guild.emojis.fetch();
    
    const emojiMap = {};
    emojis.forEach(e => {
      // Lưu lại map từ tên emoji sang định dạng chuẩn <:name:id> hoặc <a:name:id> nếu là ảnh động
      const prefix = e.animated ? 'a' : '';
      emojiMap[e.name] = `<${prefix}:${e.name}:${e.id}>`;
      console.log(`   - Tìm thấy emoji: ${e.name} -> ID: ${e.id}`);
    });

    // Tạo nội dung tin nhắn mới với các emoji đã map đúng ID
    const contentTemplate = `🎨 **Chọn vai trò phù hợp với bạn nhé!**

Bạn có thể chọn **nhiều vai trò** cùng lúc.

**Chuyên môn:**
[845509meowcode] → Dựng block
[928002meowparty] → Nặn mặt
[440591catwave] → Sơn shader
[416019walterjam] → Bày game
[660827abopdo] → Vá bug

**Tâm trạng:**
[115310happyjumpingcat] → WIP đầy nhà
[3516scubbacat] → Render chưa về
[57130demoncat] → Deadline dí

_Chọn xong thì role sẽ tự động được gán._`;

    let finalContent = contentTemplate;
    // Thay thế các placeholder bằng tag emoji thực tế
    for (const [name, tag] of Object.entries(emojiMap)) {
      finalContent = finalContent.split(`[${name}]`).join(tag);
      // Thay thế cả trường hợp viết dạng :name:
      finalContent = finalContent.split(`:${name}:`).join(tag);
    }

    console.log('\n📝 NỘI DUNG SAU KHI DỊCH MÃ EMOJI:');
    console.log(finalContent);
    console.log('\n👉 Hãy copy đoạn nội dung trên dán vào Carl-bot Dashboard để hiển thị tuyệt đẹp!');

  } catch (error) {
    console.error('❌ Lỗi:', error);
  }
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
