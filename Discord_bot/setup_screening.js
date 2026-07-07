require('dotenv').config();
const { Client, GatewayIntentBits, Routes } = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const GUILD_ID = process.env.GUILD_ID;

const screeningData = {
  enabled: true,
  description: "Đây là chỗ tụ lại của những người mê 3D, design, workflow và dựng sản phẩm thực tế. Vào Tổ thì cứ thoải mái chia sẻ, nhưng để ai cũng học được và làm được, tụi mình có vài luật chơi rất đơn giản.",
  form_fields: [
    {
      field_type: "TERMS",
      label: "Tôi đã đọc và đồng ý chơi theo luật của Tổ Young Phố.",
      values: [
        "Tôn trọng nhau trước đã. Phản hồi thẳng cũng được, nhưng không mỉa mai, không hạ nhục, không phân biệt.",
        "Góp ý vào việc, không vào người. Chém mạnh vào artwork, idea, workflow cho tốt lên; đừng chém vào cá nhân phía sau.",
        "Đúng kênh, đúng chỗ. Showcase, hỏi bài, chia sẻ tài nguyên, bàn dự án… mỗi thứ có một góc riêng, đăng cho đúng để mọi người dễ theo.",
        "Không spam, không kéo tương tác bừa. Hạn chế flood tin, tag linh tinh, reaction câu view; giữ dòng chat gọn để nội dung nổi lên.",
        "Không nội dung bẩn và vi phạm bản quyền. Tránh NSFW, lừa đảo, tài liệu crack, asset không rõ nguồn; tôn trọng công sức người khác.",
        "Tôn trọng không gian nội bộ của Tổ. Những gì liên quan đến test/beta/dự án đang làm chung, hạn chế mang ra ngoài khi chưa được đồng ý."
      ],
      required: true
    }
  ]
};

client.once('ready', async () => {
  console.log(`✅ Đã đăng nhập với bot: ${client.user.tag}`);
  
  try {
    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) {
      console.error('❌ Không tìm thấy server.');
      process.exit(1);
    }

    console.log('🛡️ Đang thiết lập Màn hình duyệt thành viên (Membership Screening)...');
    
    // Gửi request PATCH lên Discord API
    await client.rest.patch(
      Routes.guildMemberVerification(GUILD_ID),
      { body: screeningData }
    );
    
    console.log('✅ Đã thiết lập thành công!');

  } catch (error) {
    console.error('❌ Lỗi khi thiết lập duyệt thành viên:', error.message);
    if (error.rawError) {
      console.error(JSON.stringify(error.rawError, null, 2));
    }
  }
  
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
