require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    await guild.channels.fetch();
    const channels = guild.channels.cache;

    // Categories mapping
    // We match by checking if the category name contains these keywords to handle existing names.
    const catMappings = {
        'Onboarding': '┌─ | Onboarding',
        'Chung': '┌─ | Chung',
        '3D Modeling': '┌─ | 3D Modeling',
        'Sculpting': '┌─ | Sculpting',
        'Texturing & Shaders': '┌─ | Texturing & Shaders',
        'Game Engine': '┌─ | Game Engine',
        'Game Art & Env': '┌─ | Game Art & Env',
        'Workflow & Pipeline': '┌─ | Workflow & Pipeline',
        '2D Design': '┌─ | 2D Design',
        'Tech & Code': '┌─ | Tech & Code',
        'Beginner': '┌─ | Beginner',
        'Voice': '┌─ | Voice'
    };

    // Channels mapping
    // We'll strip the existing emojis and prefixes, then match based on base names.
    const chanMappings = {
        // Onboarding
        'chào-mừng': '👋 · ▌ chào-mừng',
        'rules': '📜 · ▌ rules',
        'chọn-vai-trò': '🎭 · ▌ chọn-vai-trò',
        'giới-thiệu': '🤝 · ▌ giới-thiệu',
        'bắt-đầu': '🚀 · ▌ bắt-đầu',
        'announcements': '📢 · ▌ announcements',
        
        // Chung
        'chung': '💬 · ▌ chit✦chat',
        'khoe-work': '✨ · ▌ khoe✦work',
        'hỏi-đáp': '❓ · ▌ hỏi✦đáp',
        'tài-nguyên': '💎 · ▌ tài✦nguyên',

        // 3D & Chuyên Môn
        '3d-modeling': '🧱 · ▌ 3d✦modeling',
        'sculpting': '🗿 · ▌ sculpting',
        'texturing': '🖌️ · ▌ texturing',
        'game-engine': '🎮 · ▌ game✦engine',
        'environment-prop': '🧊 · ▌ environment✦prop',
        'pipeline-teamwork': '📐 · ▌ pipeline✦teamwork',
        
        // Others
        '2d-concept': '🎨 · ▌ 2d✦concept',
        'tools-bboard': '🧪 · ▌ tools✦bboard',
        'beginner-zone': '📚 · ▌ beginner✦zone',

        // Voice
        'học-cùng-nhau': '🎧 · ▌ học-cùng-nhau',
        'voice-chat': '🎙️ · ▌ voice-chat',
        'ban-quản-đốc': '👑 · ▌ ban-quản-đốc'
    };

    // Update categories
    const categories = channels.filter(c => c.type === 4); // Category
    for (const [id, cat] of categories) {
        let match = Object.keys(catMappings).find(k => cat.name.includes(k));
        if (match) {
            const newName = catMappings[match];
            if (cat.name !== newName) {
                console.log(`Renaming category: ${cat.name} -> ${newName}`);
                await cat.setName(newName);
            }
        }
    }

    // Update channels
    const textAndVoice = channels.filter(c => c.type === 0 || c.type === 2); // Text and Voice
    for (const [id, ch] of textAndVoice) {
        // Create a normalized name without emojis and special prefixes for matching
        const baseName = ch.name.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase(); 
        // e.g. "👋┆chào-mừng" -> "chomng" (Wait, Vietnamese has accents!)
        
        // Better: let's match by checking if the channel name includes the key.
        let match = Object.keys(chanMappings).find(k => {
            const cleanK = k.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();
            const cleanCh = ch.name.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();
            // Since we know the previous names are mostly exact:
            return ch.name.includes(k) || cleanCh.includes(cleanK);
        });

        // Special handling for voice channels which might have spaces
        if (ch.name === 'Học cùng nhau') match = 'học-cùng-nhau';
        if (ch.name === 'Voice Chat') match = 'voice-chat';
        if (ch.name === 'Ban Quản Đốc') match = 'ban-quản-đốc';

        if (match) {
            const newName = chanMappings[match];
            if (ch.name !== newName) {
                console.log(`Renaming channel: ${ch.name} -> ${newName}`);
                await ch.setName(newName);
            }
        }
    }

    console.log('Finished decorating channels!');
    client.destroy();
});

client.login(process.env.DISCORD_TOKEN);
