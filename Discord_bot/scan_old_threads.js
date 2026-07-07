require('dotenv').config();
const { Client, GatewayIntentBits, ChannelType, EmbedBuilder } = require('discord.js');
const { classifyCrosspostTopic } = require('./ai_helper.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
});

const CROSSPOST_MAPPING = {
  'Blender': '1522889828553855016',    // 🧱・▌blender・chung
  'Maya': '1522889839345926205',       // 🧊・▌maya・chung
  'ZBrush': '1522889847893655772',     // 🗿・▌zbrush・chung
  'Substance': '1522902892401393725',  // 🖌️・▌substance・chung
  '2D Design': '1522877356635717743'   // 🎨・▌2d・concept
};

const CROSSPOST_FORUMS = {
  '1522895554735112332': { // 💎・▌tài・nguyên
    title: '💎 Tài Nguyên Mới Được Chia Sẻ',
    color: '#2b2d31'
  },
  '1522895810159841370': { // ✨・▌khoe・work
    title: '✨ Tác Phẩm Khoe Work Mới',
    color: '#2b2d31'
  },
  '1523567955877695488': { // 🔄・▌workflow
    title: '🔄 Bài Thảo Luận Workflow Mới',
    color: '#2b2d31'
  }
};

client.once('ready', async () => {
  console.log(`🧹 Script quét dọn bài viết cũ bắt đầu chạy dưới quyền ${client.user.tag}...`);
  
  try {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    
    for (const forumId of Object.keys(CROSSPOST_FORUMS)) {
      const config = CROSSPOST_FORUMS[forumId];
      const forumChannel = await guild.channels.fetch(forumId).catch(() => null);
      
      if (!forumChannel || forumChannel.type !== ChannelType.GuildForum) {
        console.log(`⚠️ Không tìm thấy hoặc kênh không phải Forum: ${forumId}`);
        continue;
      }
      
      console.log(`\n📂 Bắt đầu quét kênh diễn đàn: #${forumChannel.name}`);
      
      // Lấy toàn bộ các thread đang active/archived trong diễn đàn
      const activeThreads = await forumChannel.threads.fetchActive();
      const archivedThreads = await forumChannel.threads.fetchArchived({ limit: 100 });
      const allThreads = [...activeThreads.threads.values(), ...archivedThreads.threads.values()];
      
      console.log(`   Tìm thấy ${allThreads.length} bài viết.`);
      
      for (const thread of allThreads) {
        let appliedTagIds = thread.appliedTags || [];
        let hasValidTag = false;
        
        // Kiểm tra xem bài viết đã có tag phần mềm nào chưa
        for (const tagId of appliedTagIds) {
          const tag = forumChannel.availableTags.find(t => t.id === tagId);
          if (tag && CROSSPOST_MAPPING[tag.name]) {
            hasValidTag = true;
            break;
          }
        }
        
        if (hasValidTag) {
          console.log(`   [SKIP] Bài viết "${thread.name}" đã có tag hợp lệ.`);
          continue;
        }
        
        console.log(`   [AI DECTECT] Đang quét bài viết: "${thread.name}"...`);
        
        // Lấy tin nhắn khởi đầu của thread
        const starterMessage = await thread.fetchStarterMessage().catch(() => null);
        const content = starterMessage ? starterMessage.content : '';
        const imageUrls = starterMessage ? starterMessage.attachments
          .filter(att => att.contentType && att.contentType.startsWith('image/'))
          .map(att => att.url) : [];
          
        // Gọi AI phân loại
        const aiTopic = await classifyCrosspostTopic(thread.name, content, imageUrls);
        console.log(`      AI phân loại chủ đề: "${aiTopic}"`);
        
        if (aiTopic && aiTopic !== 'Unknown' && CROSSPOST_MAPPING[aiTopic]) {
          // 1. Tự động gán tag
          const forumTag = forumChannel.availableTags.find(t => t.name.toLowerCase().includes(aiTopic.toLowerCase()));
          if (forumTag) {
            console.log(`      -> Gán tag "${forumTag.name}"`);
            const newTags = [...new Set([...appliedTagIds, forumTag.id])];
            await thread.setAppliedTags(newTags).catch(console.error);
          }
          
          // 2. Crosspost bù sang kênh chung
          const targetChannelId = CROSSPOST_MAPPING[aiTopic];
          const targetChannel = await guild.channels.fetch(targetChannelId).catch(() => null);
          
          if (targetChannel) {
            console.log(`      -> Crosspost sang kênh #${targetChannel.name}`);
            const crosspostEmbed = new EmbedBuilder()
              .setColor(config.color)
              .setTitle(config.title)
              .setDescription(`📌 **${thread.name}**\n\n👉 Ghé xem và thảo luận cùng anh em tại: <#${thread.id}>`)
              .setFooter({ text: 'Tổ Young Phố 👑 • Được phân loại tự động bởi AI 🧠 (Quét dọn)' })
              .setTimestamp();
            await targetChannel.send({ embeds: [crosspostEmbed] });
          }
        } else {
          console.log(`      -> AI không thể phân loại bài viết này.`);
        }
        
        // Giảm tải tránh rate limit API Discord & AI
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    console.log('\n🎉 Hoàn tất quá trình quét dọn và xử lý bài viết cũ!');
  } catch (error) {
    console.error('Lỗi trong lúc chạy script quét dọn:', error);
  } finally {
    client.destroy();
    process.exit(0);
  }
});

client.login(process.env.DISCORD_TOKEN);
