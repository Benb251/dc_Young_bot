require('dotenv').config();
const { Client, GatewayIntentBits, ChannelType, PermissionsBitField } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ]
});

const GUILD_ID = process.env.GUILD_ID;
const CATEGORY_ID = '1522664681536229527'; // ID Danh mục "💬 Chung"
const CHANNEL_KHOE_WORK = '1522664685370081472';

const msg1 = `# 📢 Kênh Thông Báo - Tổ Young Phố

Đây là kênh **chính thức** để admin đăng các thông báo quan trọng.

**Bạn sẽ nhận được thông báo về:**
- 🗓️ **Weekly Challenge** hàng tuần
- 🎤 **AMA / Q&A** với người có kinh nghiệm
- 🚀 **Beta Test** của Bboard
- 📌 Các thay đổi quy tắc hoặc cập nhật cộng đồng
- 🎉 Sự kiện đặc biệt (nếu có)

**Lưu ý:**
- Chỉ **Bố già đầu hẻm** và **Ban quản viewport** được phép đăng tin ở kênh này.
- Hãy **bật thông báo** cho kênh này để không bỏ lỡ các hoạt động quan trọng.

Chúc mọi người theo dõi và tham gia tích cực! 🔥`;

const msg2 = `# 📅 Lịch Hoạt Động Hàng Tuần

- **Thứ 2**: Đăng đề bài **Weekly Challenge**
- **Thứ 4**: Mở **Feedback Thread**
- **Chủ Nhật**: **Member Spotlight** + AMA (nếu có)

Hãy theo dõi kênh này để không bỏ lỡ nhé!`;

const msg3 = `# 🏆 Cách Tham Gia Weekly Challenge

1. Đọc đề bài được đăng vào Thứ 2 hàng tuần.
2. Làm trong thời gian quy định (thường 5–7 ngày).
3. Đăng kết quả vào kênh <#${CHANNEL_KHOE_WORK}>.
4. Nhận feedback và có cơ hội được nổi bật!

Ai hoàn thành liên tục sẽ nhận được **badge đặc biệt**.`;

client.once('ready', async () => {
  console.log(`✅ Đã đăng nhập với bot: ${client.user.tag}`);

  try {
    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) {
      console.error('❌ Không tìm thấy server.');
      process.exit(1);
    }

    console.log('📁 Đang tạo kênh #announcements...');
    const channel = await guild.channels.create({
      name: 'announcements',
      type: ChannelType.GuildText,
      parent: CATEGORY_ID,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionsBitField.Flags.SendMessages], // Khóa chat
          allow: [PermissionsBitField.Flags.ViewChannel], // Cho xem
        },
        {
          id: '1522665136953884864', // ID Role: Bố già đầu hẻm
          allow: [PermissionsBitField.Flags.SendMessages],
        },
        {
          id: '1522665139625791600', // ID Role: Ban quản viewport
          allow: [PermissionsBitField.Flags.SendMessages],
        }
      ],
      position: 0, // Đặt kênh ở đầu danh mục
    });

    console.log(`✅ Kênh #${channel.name} đã được tạo!`);

    // Gửi và ghim 3 tin nhắn
    console.log('📤 Đang gửi tin nhắn 1...');
    const m1 = await channel.send(msg1);
    await m1.pin();
    
    console.log('📤 Đang gửi tin nhắn 2...');
    const m2 = await channel.send(msg2);
    await m2.pin();
    
    console.log('📤 Đang gửi tin nhắn 3...');
    const m3 = await channel.send(msg3);
    await m3.pin();

    console.log('🎉 Hoàn tất đăng và ghim 3 thông báo cho #announcements!');

  } catch (error) {
    console.error('❌ Lỗi:', error.message);
  }

  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
