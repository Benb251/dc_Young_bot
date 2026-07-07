require('dotenv').config();
const { Client, GatewayIntentBits, ChannelFlags } = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const QA_CHANNELS_CONFIG = {
  // General Q&A
  '1522895534145278012': {
    topic: `🙋 Chào mừng bạn đến với kênh Hỏi Đáp Chung!\nĐể nhận được sự hỗ trợ nhanh nhất và chính xác nhất từ mọi người, vui lòng:\n1. Mô tả chi tiết vấn đề bạn đang gặp phải.\n2. Nêu rõ phần mềm & phiên bản đang sử dụng.\n3. Đính kèm hình ảnh hoặc video quay màn hình lỗi (nếu có).\n4. Sau khi câu hỏi ĐÃ ĐƯỢC GIẢI QUYẾT, hãy đổi tag thành [✅ Đã giải quyết] và react ✅ vào câu trả lời đúng nhất.`,
    tags: [
      { name: '⏳ Chưa giải quyết', emoji: { name: '⏳' } },
      { name: '✅ Đã giải quyết', emoji: { name: '✅' } },
      { name: '🧱 Blender', emoji: { name: '🧱' } },
      { name: '🧊 Maya', emoji: { name: '🧊' } },
      { name: '🗿 ZBrush', emoji: { name: '🗿' } },
      { name: '🖌️ Substance', emoji: { name: '🖌️' } },
      { name: '🎨 2D Design', emoji: { name: '🎨' } },
      { name: '💬 Khác', emoji: { name: '💬' } }
    ],
    defaultReaction: '✅'
  },
  // Newbie Q&A
  '1522895530223730739': {
    topic: `🙋 Chào mừng bạn đến với kênh Hỏi Đáp Newbie!\nNơi dành riêng cho các câu hỏi cơ bản, không sợ bị đánh giá. Vui lòng:\n1. Hỏi bất kỳ điều gì bạn chưa rõ về 3D, 2D hoặc cài đặt công cụ.\n2. Đính kèm hình ảnh lỗi để mọi người dễ hướng dẫn.\n3. Khi đã có câu trả lời vừa ý, hãy đổi tag sang [✅ Đã giải quyết].`,
    tags: [
      { name: '⏳ Chưa giải quyết', emoji: { name: '⏳' } },
      { name: '✅ Đã giải quyết', emoji: { name: '✅' } },
      { name: '📚 Cơ bản', emoji: { name: '📚' } },
      { name: '🔧 Cài đặt', emoji: { name: '🔧' } },
      { name: '💬 Khác', emoji: { name: '💬' } }
    ],
    defaultReaction: '✅'
  },
  // Blender Q&A
  '1522895538272342127': {
    topic: `🧱 Chào mừng bạn đến với kênh Hỏi Đáp Blender!\nVui lòng:\n1. Mô tả rõ lỗi hoặc kỹ thuật Blender bạn cần hỗ trợ.\n2. Đính kèm hình ảnh/video minh họa.\n3. Đổi tag sang [✅ Đã giải quyết] khi hoàn thành.`,
    tags: [
      { name: '⏳ Chưa giải quyết', emoji: { name: '⏳' } },
      { name: '✅ Đã giải quyết', emoji: { name: '✅' } },
      { name: '🧱 Modeling', emoji: { name: '🧱' } },
      { name: '🗿 Sculpting', emoji: { name: '🗿' } },
      { name: '🖌️ Texturing', emoji: { name: '🖌️' } },
      { name: '💡 Lighting/Render', emoji: { name: '💡' } },
      { name: '⚙️ Addons/Python', emoji: { name: '⚙️' } },
      { name: '👶 Newbie', emoji: { name: '👶' } }
    ],
    defaultReaction: '✅'
  },
  // Maya Q&A
  '1522895543364223087': {
    topic: `🧊 Chào mừng bạn đến với kênh Hỏi Đáp Maya!\nVui lòng:\n1. Mô tả rõ lỗi hoặc kỹ thuật Maya bạn cần hỗ trợ.\n2. Đính kèm hình ảnh/video minh họa.\n3. Đổi tag sang [✅ Đã giải quyết] khi hoàn thành.`,
    tags: [
      { name: '⏳ Chưa giải quyết', emoji: { name: '⏳' } },
      { name: '✅ Đã giải quyết', emoji: { name: '✅' } },
      { name: '🧊 Modeling', emoji: { name: '🧊' } },
      { name: '🦴 Rigging', emoji: { name: '🦴' } },
      { name: '🏃 Animation', emoji: { name: '🏃' } },
      { name: '💡 Lighting/Render', emoji: { name: '💡' } },
      { name: '👶 Newbie', emoji: { name: '👶' } }
    ],
    defaultReaction: '✅'
  },
  // ZBrush Q&A
  '1522895547671904296': {
    topic: `🗿 Chào mừng bạn đến với kênh Hỏi Đáp ZBrush!\nVui lòng:\n1. Mô tả rõ lỗi hoặc kỹ thuật ZBrush bạn cần hỗ trợ.\n2. Đính kèm hình ảnh/video minh họa.\n3. Đổi tag sang [✅ Đã giải quyết] khi hoàn thành.`,
    tags: [
      { name: '⏳ Chưa giải quyết', emoji: { name: '⏳' } },
      { name: '✅ Đã giải quyết', emoji: { name: '✅' } },
      { name: '🗿 Sculpting', emoji: { name: '🗿' } },
      { name: '🖌️ Polypaint', emoji: { name: '🖌️' } },
      { name: '🧱 Dynamesh/ZRemesh', emoji: { name: '🧱' } },
      { name: '👶 Newbie', emoji: { name: '👶' } }
    ],
    defaultReaction: '✅'
  },
  // Substance Q&A
  '1522902894293028956': {
    topic: `🖌️ Chào mừng bạn đến với kênh Hỏi Đáp Substance!\nVui lòng:\n1. Mô tả rõ lỗi hoặc kỹ thuật Substance Painter/Designer bạn cần hỗ trợ.\n2. Đính kèm hình ảnh/video minh họa.\n3. Đổi tag sang [✅ Đã giải quyết] khi hoàn thành.`,
    tags: [
      { name: '⏳ Chưa giải quyết', emoji: { name: '⏳' } },
      { name: '✅ Đã giải quyết', emoji: { name: '✅' } },
      { name: '🖌️ Texturing', emoji: { name: '🖌️' } },
      { name: '💎 Materials', emoji: { name: '💎' } },
      { name: '🔄 Workflow/Bake', emoji: { name: '🔄' } },
      { name: '👶 Newbie', emoji: { name: '👶' } }
    ],
    defaultReaction: '✅'
  },
  // 2D Q&A
  '1522895551094325339': {
    topic: `🎨 Chào mừng bạn đến với kênh Hỏi Đáp 2D Design!\nVui lòng:\n1. Mô tả rõ lỗi hoặc kỹ thuật 2D bạn cần hỗ trợ.\n2. Đính kèm hình ảnh/video minh họa.\n3. Đổi tag sang [✅ Đã giải quyết] khi hoàn thành.`,
    tags: [
      { name: '⏳ Chưa giải quyết', emoji: { name: '⏳' } },
      { name: '✅ Đã giải quyết', emoji: { name: '✅' } },
      { name: '🎨 Photoshop', emoji: { name: '🎨' } },
      { name: '🖌️ Digital Painting', emoji: { name: '🖌️' } },
      { name: '📐 Vector/Illustrator', emoji: { name: '📐' } },
      { name: '👶 Newbie', emoji: { name: '👶' } }
    ],
    defaultReaction: '✅'
  }
};

client.once('ready', async () => {
  console.log(`✅ Đăng nhập bot: ${client.user.tag}`);
  try {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    
    for (const [channelId, config] of Object.entries(QA_CHANNELS_CONFIG)) {
      const channel = await guild.channels.fetch(channelId).catch(() => null);
      if (!channel) {
        console.error(`❌ Không tìm thấy kênh với ID: ${channelId}`);
        continue;
      }
      
      console.log(`⚙️ Đang cấu hình kênh: ${channel.name}...`);
      
      // Update channel forum configuration
      await channel.edit({
        topic: config.topic,
        availableTags: config.tags,
        defaultReactionEmoji: config.defaultReaction ? { name: config.defaultReaction } : null,
        defaultSortOrder: 0, // 0 = Latest Activity, 1 = Creation Time
        defaultForumLayout: 1, // 1 = ListView, 2 = GalleryView
        flags: [ChannelFlags.RequireTag]
      });
      
      console.log(`   ✅ Thành công cho kênh: ${channel.name}`);
    }
    
    console.log('🎉 Hoàn thành thiết lập toàn bộ các kênh Hỏi Đáp!');
  } catch (error) {
    console.error('❌ Lỗi thiết lập:', error);
  } finally {
    client.destroy();
  }
});

client.login(process.env.DISCORD_TOKEN);
