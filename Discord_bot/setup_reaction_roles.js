require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions
    ]
});

const messageContent = `**🎭 Chọn vai trò để mở đúng góc dành cho bạn**

Đây là nơi bạn chọn **mảng mình quan tâm** để mở thêm kênh phù hợp.
Bạn có thể chọn **nhiều vai trò** cùng lúc, tuỳ theo tool và hướng đi của bạn.

**🧱 3D & Game Art**
- 🧱 **Blender** – cho người dùng Blender, mở thêm các kênh về chat, hỏi đáp và chia sẻ workflow Blender.
- 🗿 **Sculpt / ZBrush** – cho ai thích nặn khối, sculpt nhân vật/props (ZBrush, Blender Sculpt, v.v.).
- 🖌️ **Texturing & Shaders** – cho dân texture, material, lookdev (Substance, shader, node đủ loại).
- 🎮 **Game Engine (Unity/Unreal)** – cho người mang asset vào engine, lighting, level design, build scene.
- 🧊 **Game Art / Environment** – cho người focus environment, prop, scene trong bối cảnh game.
- 📐 **Workflow & Pipeline** – cho người quan tâm quy trình làm việc, pipeline, tối ưu file, teamwork.
- 🧪 **Tools / Scripts / Bboard** – cho dân mê tool, script, automation và những ai muốn theo dõi Bboard/webapp.

**🎨 2D / Design (gọn)**
- 🎨 **2D / Concept / Graphic** – cho ai vẽ concept, minh hoạ, graphic design, poster, key visual…

**📚 Beginner**
- 📚 **Đang học 3D** – nếu bạn mới bắt đầu, chưa rõ mình thuộc track nào, chọn role này để nhận thêm kênh và nội dung thân thiện với người mới.

👉 Hãy bấm vào **reaction tương ứng dưới tin nhắn này** để chọn vai trò.
Sau khi bấm, role sẽ được gán **tự động** và bạn sẽ thấy thêm các kênh phù hợp với lựa chọn của mình.`;

const roleEmojis = [
    { emoji: '🧱', roleName: '🧱 Blender' },
    { emoji: '🗿', roleName: '🗿 Sculpt / ZBrush' },
    { emoji: '🖌️', roleName: '🖌 Texturing & Shaders' },
    { emoji: '🎮', roleName: '🎮 Game Engine (Unity/Unreal)' },
    { emoji: '🧊', roleName: '🧊 Game Art / Environment' },
    { emoji: '📐', roleName: '📐 Workflow & Pipeline' },
    { emoji: '🧪', roleName: '🧪 Tools / Scripts / Bboard' },
    { emoji: '🎨', roleName: '🎨 2D / Concept / Graphic' },
    { emoji: '📚', roleName: '📚 Đang học 3D' }
];

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    
    // Find channel
    const chooseRoleChannel = await guild.channels.fetch('1522664676729688247');
    
    if (!chooseRoleChannel) {
        console.error('Channel #chọn-vai-trò not found!');
        client.destroy();
        return;
    }

    // Step 2: Delete old reaction messages in this channel to avoid confusion
    try {
        const messages = await chooseRoleChannel.messages.fetch({ limit: 10 });
        for (const [id, msg] of messages) {
            if (msg.author.id === client.user.id) {
                console.log(`Deleting old message ${msg.id}...`);
                await msg.delete();
            }
        }
    } catch (e) {
        console.error('Error fetching/deleting old messages:', e);
    }

    // Step 3: Send new message
    console.log('Sending new reaction role message...');
    const newMessage = await chooseRoleChannel.send(messageContent);
    
    // Step 4: Add reactions
    console.log('Adding reactions...');
    for (const item of roleEmojis) {
        try {
            await newMessage.react(item.emoji);
            console.log(`Reacted with ${item.emoji} for role ${item.roleName}`);
        } catch (e) {
            console.error(`Failed to react with ${item.emoji}:`, e);
            // In case of invisible variation selector issue, try without variation selector
            if (item.emoji.length > 1) {
                try {
                    await newMessage.react(item.emoji[0]);
                    console.log(`Reacted with fallback ${item.emoji[0]} for role ${item.roleName}`);
                } catch (e2) {
                    console.error(`Fallback react failed for ${item.emoji[0]}:`, e2);
                }
            }
        }
    }

    console.log(`\nDONE! Message ID: ${newMessage.id}`);
    console.log(`Use this Message ID to configure Carl-bot!`);
    client.destroy();
});

client.login(process.env.DISCORD_TOKEN);
