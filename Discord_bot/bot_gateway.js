require('dotenv').config();
const { Client, GatewayIntentBits, Partials, ChannelType, EmbedBuilder } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction
  ]
});

// Q&A Channels mapping
const QA_CHANNEL_IDS = [
  '1522895534145278012', // ❓・▌hỏi・đáp
  '1522895530223730739', // ❓・▌hỏi・đáp・newbie
  '1522895538272342127', // ❓・▌blender・hỏi・đáp
  '1522895543364223087', // ❓・▌maya・hỏi・đáp
  '1522895547671904296', // ❓・▌zbrush・hỏi・đáp
  '1522902894293028956', // ❓・▌substance・hỏi・đáp
  '1522895551094325339'  // ❓・▌2d・hỏi・đáp
];

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

const MEMBER_COUNT_CHANNEL_ID = '1523606548054802437';
const ONLINE_COUNT_CHANNEL_ID = '1523606551770828820';

async function updateServerStats(client) {
  try {
    const guild = await client.guilds.fetch({ guild: process.env.GUILD_ID, force: true });
    const memberCount = guild.approximateMemberCount || 0;
    const onlineCount = guild.approximatePresenceCount || 0;

    console.log(`[STATS] Updating stats: Member=${memberCount}, Online=${onlineCount}`);

    const memberChannel = await guild.channels.fetch(MEMBER_COUNT_CHANNEL_ID).catch(() => null);
    if (memberChannel) {
      const newName = `👤・Cư dân: ${memberCount}`;
      if (memberChannel.name !== newName) {
        await memberChannel.setName(newName);
        console.log(`   [STATS] Member count updated to: ${memberCount}`);
      }
    }

    const onlineChannel = await guild.channels.fetch(ONLINE_COUNT_CHANNEL_ID).catch(() => null);
    if (onlineChannel) {
      const newName = `🟢・Trực tuyến: ${onlineCount}`;
      if (onlineChannel.name !== newName) {
        await onlineChannel.setName(newName);
        console.log(`   [STATS] Online status updated to: ${onlineCount}`);
      }
    }
  } catch (error) {
    console.error('[STATS ERROR] Failed to update server stats:', error);
  }
}

client.once('ready', () => {
  console.log(`🚀 Bot Gateway is online as ${client.user.tag}!`);
  console.log(`Listening for Q&A automation in ${QA_CHANNEL_IDS.length} channels...`);
  
  // Run once immediately on start
  updateServerStats(client);
  
  // Update stats every 12 minutes
  setInterval(() => {
    updateServerStats(client);
  }, 12 * 60 * 1000);
});

// Import helper AI
const { getAIChatResponse, classifyCrosspostTopic } = require('./ai_helper.js');

// Helper to get status tag IDs from a forum channel
function getStatusTagIds(parentChannel) {
  const unsolvedTag = parentChannel.availableTags.find(t => t.name.includes('Chưa giải quyết'));
  const solvedTag = parentChannel.availableTags.find(t => t.name.includes('Đã giải quyết'));
  return {
    unsolvedId: unsolvedTag ? unsolvedTag.id : null,
    solvedId: solvedTag ? solvedTag.id : null
  };
}

// ── 1. Event: Thread (Post) Created ────────────────────────
client.on('threadCreate', async (thread) => {
  try {
    if (!thread.parentId) return;

    // A. Xử lý liên kết chéo (Crosspost) tích hợp AI cho các kênh Diễn đàn
    if (CROSSPOST_FORUMS[thread.parentId]) {
      const config = CROSSPOST_FORUMS[thread.parentId];
      
      // Chờ 3s để tin nhắn đầu tiên của thread được cập nhật đầy đủ
      setTimeout(async () => {
        try {
          const parentChannel = await thread.guild.channels.fetch(thread.parentId);
          if (!parentChannel || parentChannel.type !== ChannelType.GuildForum) return;

          // Lấy tin nhắn khởi đầu của thread để lấy nội dung mô tả + hình ảnh
          const starterMessage = await thread.fetchStarterMessage().catch(() => null);
          const content = starterMessage ? starterMessage.content : '';
          const imageUrls = starterMessage ? starterMessage.attachments
            .filter(att => att.contentType && att.contentType.startsWith('image/'))
            .map(att => att.url) : [];

          let appliedTagIds = thread.appliedTags || [];
          let targetTagName = '';

          // 1. Kiểm tra xem người dùng đã gắn tag hợp lệ chưa
          for (const tagId of appliedTagIds) {
            const tag = parentChannel.availableTags.find(t => t.id === tagId);
            if (tag && CROSSPOST_MAPPING[tag.name]) {
              targetTagName = tag.name;
              break;
            }
          }

          // 2. Nếu người dùng CHƯA gắn tag nào liên quan tới phần mềm, gọi AI tự động phân loại
          if (!targetTagName) {
            console.log(`🧠 [AI CROSSPOST] Analyzing thread "${thread.name}" for auto-tagging...`);
            const aiTopic = await classifyCrosspostTopic(thread.name, content, imageUrls);
            console.log(`🧠 [AI CROSSPOST] AI classified topic as: "${aiTopic}"`);

            if (aiTopic && aiTopic !== 'Unknown' && CROSSPOST_MAPPING[aiTopic]) {
              targetTagName = aiTopic;
              
              // Tìm ID của tag tương ứng với phần mềm đó trong Forum
              const forumTag = parentChannel.availableTags.find(t => t.name.toLowerCase().includes(aiTopic.toLowerCase()));
              if (forumTag) {
                console.log(`🧠 [AI CROSSPOST] Auto-applying tag "${forumTag.name}" to thread`);
                const newTags = [...new Set([...appliedTagIds, forumTag.id])];
                await thread.setAppliedTags(newTags).catch(console.error);
              }
            }
          }

          // 3. Tiến hành crosspost giới thiệu sang kênh tương ứng
          if (targetTagName && CROSSPOST_MAPPING[targetTagName]) {
            const targetChannelId = CROSSPOST_MAPPING[targetTagName];
            const targetChannel = await thread.guild.channels.fetch(targetChannelId).catch(() => null);
            
            if (targetChannel) {
              console.log(`🔗 [CROSSPOST] Posting thread "${thread.name}" to #${targetChannel.name} (Topic: ${targetTagName})`);
              const crosspostEmbed = new EmbedBuilder()
                .setColor(config.color)
                .setTitle(config.title)
                .setDescription(`📌 **${thread.name}**\n\n👉 Ghé xem và thảo luận cùng anh em tại: <#${thread.id}>`)
                .setFooter({ text: 'Tổ Young Phố 👑 • Được phân loại tự động bởi AI 🧠' })
                .setTimestamp();
              await targetChannel.send({ embeds: [crosspostEmbed] });
            }
          }
        } catch (innerError) {
          console.error('Error in threadCreate processing timeout:', innerError);
        }
      }, 3000);
      return;
    }

    // B. Xử lý tự động gắn thẻ trạng thái cho các kênh Hỏi Đáp (Q&A)
    if (QA_CHANNEL_IDS.includes(thread.parentId)) {
      const parentChannel = await thread.guild.channels.fetch(thread.parentId);
      if (!parentChannel || parentChannel.type !== ChannelType.GuildForum) return;

      const { unsolvedId } = getStatusTagIds(parentChannel);
      if (!unsolvedId) return;

      const currentTags = thread.appliedTags || [];
      if (!currentTags.includes(unsolvedId)) {
        console.log(`🆕 New post "${thread.name}" created. Auto-applying "Chưa giải quyết" tag.`);
        const newTags = [...new Set([...currentTags, unsolvedId])];
        await thread.setAppliedTags(newTags);
      }

      // C. Tự động gọi AI phân tích bài hỏi đáp mới (kèm ảnh nếu có)
      setTimeout(async () => {
        try {
          // Lấy tin nhắn đầu tiên của thread
          const starterMessage = await thread.fetchStarterMessage().catch(() => null);
          if (!starterMessage) return;

          const questionText = starterMessage.content || '';
          const questionTitle = thread.name;

          // Lấy hình ảnh đính kèm
          const imageUrls = starterMessage.attachments
            .filter(att => att.contentType && att.contentType.startsWith('image/'))
            .map(att => att.url);

          console.log(`🤖 AI is analyzing new thread: "${questionTitle}" with ${imageUrls.length} images`);

          const prompt = `Tiêu đề bài đăng: "${questionTitle}"\nNội dung câu hỏi: "${questionText}"\n\nHãy xem xét nội dung câu hỏi và hình ảnh đính kèm (nếu có), phân tích và đưa ra giải pháp gợi ý nhanh nhất cho thành viên.`;
          
          const aiResponse = await getAIChatResponse([{ role: 'user', content: prompt }], imageUrls);

          const responseEmbed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🤖 Gợi ý tự động từ Trợ lý AI')
            .setDescription(aiResponse)
            .setFooter({ text: 'Đây là câu trả lời tham khảo tự động từ Grok-4' })
            .setTimestamp();

          await thread.send({ embeds: [responseEmbed] });
        } catch (err) {
          console.error('Failed to generate AI auto-reply for thread:', err);
        }
      }, 3000); // Delay 3s chờ Discord sync tin nhắn đầu tiên
    }
  } catch (error) {
    console.error('Error in threadCreate handler:', error);
  }
});

// Helper to mark a thread as solved
async function markThreadAsSolved(thread, triggerUser) {
  try {
    const parentChannel = await thread.guild.channels.fetch(thread.parentId);
    if (!parentChannel || parentChannel.type !== ChannelType.GuildForum) return;

    const { unsolvedId, solvedId } = getStatusTagIds(parentChannel);
    if (!unsolvedId || !solvedId) return;

    const currentTags = thread.appliedTags || [];
    
    // Check if solved is already applied or unsolved is already removed
    if (currentTags.includes(solvedId) && !currentTags.includes(unsolvedId)) {
      return; // Already solved
    }

    console.log(`✅ Post "${thread.name}" marked as solved by ${triggerUser.tag}`);

    // Update tags
    const newTags = currentTags
      .filter(id => id !== unsolvedId) // Remove Unsolved
      .concat(solvedId);               // Add Solved
      
    await thread.setAppliedTags([...new Set(newTags)]);

    // Send confirmation message as embed
    const solvedEmbed = new EmbedBuilder()
      .setColor('#57F287') // Discord green
      .setDescription(`✅ Bài đăng này đã được đánh dấu là **Đã giải quyết** bởi **${triggerUser.username}**. Cảm ơn mọi người!`);
    await thread.send({ embeds: [solvedEmbed] });
  } catch (error) {
    console.error(`Failed to mark thread ${thread.id} as solved:`, error);
  }
}

// ── 2. Event: Message Created (Detect triggers like "đã giải quyết" or "/done", or tag bot for AI) ──
client.on('messageCreate', async (message) => {
  try {
    if (message.author.bot) return;

    const channel = message.channel;

    // A. Kiểm tra nếu bot được tag (@mention) thì gọi AI phản hồi (hỗ trợ đọc hình ảnh đính kèm)
    if (client.user && message.mentions.has(client.user.id)) {
      // Bỏ tag bot ra khỏi nội dung text
      let cleanContent = message.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
      if (!cleanContent) {
        cleanContent = "Chào bot!";
      }

      // Lấy hình ảnh đính kèm
      const imageUrls = message.attachments
        .filter(att => att.contentType && att.contentType.startsWith('image/'))
        .map(att => att.url);

      console.log(`💬 User ${message.author.tag} mentioned bot with: "${cleanContent}" (${imageUrls.length} images)`);

      // Show typing indicator
      await message.channel.sendTyping();

      const aiResponse = await getAIChatResponse(
        [{ role: 'user', content: cleanContent }],
        imageUrls
      );

      await message.reply(aiResponse);
      return;
    }

    // B. Check if it is a thread under a Q&A forum channel for solving trigger
    if (!channel.isThread() || !channel.parentId || !QA_CHANNEL_IDS.includes(channel.parentId)) return;

    const contentLower = message.content.toLowerCase().trim();
    const triggers = ['đã giải quyết', 'da giai quyet', '/done', '!done', 'done'];

    if (triggers.includes(contentLower)) {
      // Permission check: check if the message author is the thread starter or a moderator
      const threadOwnerId = channel.ownerId;
      const isOwner = message.author.id === threadOwnerId;
      const isMod = message.member.permissions.has('ManageThreads') || message.member.permissions.has('Administrator');

      if (isOwner || isMod) {
        await markThreadAsSolved(channel, message.author);
      } else {
        await message.reply('⚠️ Chỉ chủ bài viết hoặc ban quản trị mới có thể đánh dấu bài viết đã giải quyết.');
      }
    }
  } catch (error) {
    console.error('Error in messageCreate handler:', error);
  }
});

// ── 3. Event: Reaction Added (Detect ✅ emoji) ────────────────────────
client.on('messageReactionAdd', async (reaction, user) => {
  try {
    if (user.bot) return;

    console.log(`[REACTION DEBUG] User ${user.tag} reacted with ${reaction.emoji.name} on message ${reaction.message.id}`);

    // Fetch partials if needed
    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();

    const message = reaction.message;
    const channel = message.channel;

    // Check if it is a thread under a Q&A forum channel
    if (!channel.isThread() || !channel.parentId || !QA_CHANNEL_IDS.includes(channel.parentId)) return;

    // Detect checkmark reaction
    if (reaction.emoji.name === '✅') {
      const threadOwnerId = channel.ownerId;
      const isOwner = user.id === threadOwnerId;
      
      // Fetch member to check permissions
      const member = await message.guild.members.fetch(user.id);
      const isMod = member.permissions.has('ManageThreads') || member.permissions.has('Administrator');

      if (isOwner || isMod) {
        await markThreadAsSolved(channel, user);
      }
    }
  } catch (error) {
    console.error('Error in messageReactionAdd handler:', error);
  }
});

client.login(process.env.DISCORD_TOKEN);
