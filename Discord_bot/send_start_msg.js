require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ]
});

// Các ID kênh đã lưu
const CHANNELS = {
  bat_dau: '1522664679510642818',
  gioi_thieu: '1522664674850504775',
  chon_vai_tro: '1522664676729688247',
  khoe_work: '1522664685370081472',
  hoi_dap: '1522664687815229460',
  workflow: '1522664690327752854',
  tai_nguyen: '1522664692215185611',
};

const messageContent = `# 👋 Chào mừng bạn đến với Tổ Young Phố!

Đây là nơi bạn có thể **học hỏi, chia sẻ và phát triển** kỹ năng **3D Game Art & Design** cùng mọi người.

---

## 📌 Những việc bạn nên làm ngay:

**1. Giới thiệu bản thân**
- Vào kênh <#${CHANNELS.gioi_thieu}> và viết vài dòng về mình nhé!

**2. Chọn vai trò**
- Vào kênh <#${CHANNELS.chon_vai_tro}> và thả reaction để nhận role phù hợp với bạn.

**3. Khám phá cộng đồng**
- <#${CHANNELS.khoe_work}> → Nơi mọi người đăng work và nhận feedback
- <#${CHANNELS.hoi_dap}> → Hỏi bài, nhờ hỗ trợ kỹ thuật
- <#${CHANNELS.workflow}> → Thảo luận về quy trình làm việc
- <#${CHANNELS.tai_nguyen}> → Chia sẻ addon, material, tutorial hay

---

## 💡 Một số lưu ý:

- Hãy **tự do tương tác** và đừng ngại hỏi. Mọi người ở đây đều sẵn sàng hỗ trợ.
- Muốn tham gia **Weekly Challenge** mỗi tuần? Theo dõi kênh #announcements (nếu có).
- Nếu cần hỗ trợ nhanh, bạn có thể tag \`@Ban quản viewport\`.

---

Chúc bạn có những trải nghiệm vui vẻ tại **Tổ Young Phố**! 🔥`;

client.once('ready', async () => {
  console.log(`✅ Đã đăng nhập với bot: ${client.user.tag}`);

  try {
    const channel = client.channels.cache.get(CHANNELS.bat_dau);
    if (!channel) {
      console.error('❌ Không tìm thấy kênh #bắt-đầu');
      process.exit(1);
    }

    // Gửi tin nhắn
    console.log('📤 Đang gửi tin nhắn...');
    const sentMessage = await channel.send(messageContent);
    console.log('✅ Đã gửi thành công!');

    // Ghim (Pin) tin nhắn
    console.log('📌 Đang ghim tin nhắn...');
    await sentMessage.pin();
    console.log('✅ Đã ghim thành công!');

  } catch (error) {
    console.error('❌ Lỗi:', error.message);
  }

  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
