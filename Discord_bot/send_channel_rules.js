require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ]
});

const MESSAGES = [
  {
    channelId: '1522664685370081472', // khoe-work
    content: `# 📌 Quy tắc & Hướng dẫn kênh #khoe-work\n\nĐây là nơi mọi người **khoe work** và nhận feedback từ cộng đồng.\n\n**Khi đăng work, nên kèm theo:**\n- Mô tả ngắn gọn bạn đang làm gì\n- Phần mềm / công cụ đang dùng\n- Vấn đề bạn đang gặp (nếu cần feedback)\n- Ảnh hoặc video minh họa\n\n**Lưu ý:**\n- Chỉ đăng work có chất lượng hoặc WIP có ý nghĩa.\n- Khuyến khích mọi người cho feedback **xây dựng** và **cụ thể**.\n- Không spam work đã đăng nhiều lần.\n\nChúc mọi người có nhiều feedback chất lượng! 🎨`
  },
  {
    channelId: '1522664687815229460', // hoi-dap
    content: `# 📌 Quy tắc & Hướng dẫn kênh #hỏi-đáp\n\nĐây là nơi bạn có thể **hỏi bài** và nhận hỗ trợ từ mọi người.\n\n**Khi đặt câu hỏi, hãy:**\n- Mô tả rõ bạn đang làm gì\n- Đang gặp vấn đề gì cụ thể\n- Đã thử những cách nào rồi (nếu có)\n- Kèm hình ảnh hoặc video minh họa nếu có thể\n\n**Khi trả lời:**\n- Hãy kiên nhẫn và giải thích rõ ràng.\n- Nếu câu hỏi đã được giải quyết, hãy react ✅ hoặc comment “Đã giải quyết”.\n\n**Lưu ý:** Tránh hỏi lại những câu hỏi đã có câu trả lời rõ ràng trong kênh.`
  },
  {
    channelId: '1522664690327752854', // workflow
    content: `# 📌 Quy tắc & Hướng dẫn kênh #workflow\n\nĐây là nơi **thảo luận về quy trình làm việc**, cách tối ưu pipeline, công cụ hỗ trợ và kinh nghiệm thực tế.\n\n**Bạn có thể chia sẻ:**\n- Workflow cá nhân của bạn\n- Cách bạn tối ưu quy trình làm việc\n- Công cụ, addon, script đang dùng\n- So sánh các phương pháp làm việc khác nhau\n- Bài học kinh nghiệm từ dự án thực tế\n\n**Lưu ý:**\n- Đây không phải kênh hỏi bài kỹ thuật đơn lẻ (hãy dùng \`#hỏi-đáp\`).\n- Khuyến khích chia sẻ kinh nghiệm thực tế thay vì lý thuyết suông.`
  },
  {
    channelId: '1522664692215185611', // tai-nguyen
    content: `# 📌 Quy tắc & Hướng dẫn kênh #tài-nguyên\n\nĐây là nơi **chia sẻ tài nguyên** có giá trị cho cộng đồng.\n\n**Bạn có thể chia sẻ:**\n- Addon, plugin, script hữu ích\n- Material, HDRI, texture pack\n- Tutorial hay, khóa học chất lượng\n- Project file (nếu được phép chia sẻ)\n\n**Khi chia sẻ, hãy:**\n- Mô tả ngắn gọn tài nguyên\n- Ghi rõ nguồn gốc hoặc tác giả (nếu biết)\n- Chỉ chia sẻ tài nguyên **hợp pháp**\n\nAdmin sẽ ghim những tài nguyên thực sự chất lượng và hữu ích.`
  }
];

client.once('ready', async () => {
  console.log(`✅ Đã đăng nhập với bot: ${client.user.tag}`);

  for (const item of MESSAGES) {
    try {
      const channel = client.channels.cache.get(item.channelId);
      if (!channel) {
        console.error(`❌ Không tìm thấy kênh với ID: ${item.channelId}`);
        continue;
      }
      console.log(`📤 Đang gửi tin nhắn vào kênh #${channel.name}...`);
      const sentMessage = await channel.send(item.content);
      console.log(`📌 Đang ghim tin nhắn ở kênh #${channel.name}...`);
      await sentMessage.pin();
      console.log(`✅ Hoàn tất cho kênh #${channel.name}\n`);
    } catch (error) {
      console.error(`❌ Lỗi tại kênh ID ${item.channelId}:`, error.message);
    }
  }

  console.log('🎉 Xong tất cả!');
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
