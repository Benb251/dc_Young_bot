require('dotenv').config();
const { Client, GatewayIntentBits, ChannelType } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    await guild.channels.fetch();
    const channels = guild.channels.cache;

    // Helper to find category by name
    const findCat = (name) => channels.find(c => c.type === ChannelType.GuildCategory && c.name === name);

    // Categories to delete
    const catsToDelete = [
        '┌─ | 3D Modeling',
        '┌─ | Sculpting',
        '┌─ | Texturing & Shaders',
        '┌─ | Game Art & Env',
        '┌─ | Workflow & Pipeline',
        '┌─ | Tech & Code'
    ];

    // Channels to delete
    const channelsToDelete = [
        '🧱・▌3d・modeling',
        '🗿・▌sculpting',
        '🖌️・▌texturing',
        '🧊・▌environment・prop',
        '📐・▌pipeline・teamwork',
        '🧪・▌tools・bboard'
    ];

    for (const name of channelsToDelete) {
        const ch = channels.find(c => c.name === name);
        if (ch) {
            console.log(`Deleting channel: ${ch.name}`);
            await ch.delete();
        }
    }

    for (const name of catsToDelete) {
        const cat = findCat(name);
        if (cat) {
            console.log(`Deleting category: ${cat.name}`);
            await cat.delete();
        }
    }

    // Create new categories and channels
    const newStructure = {
        '┌─ | Blender': [
            '🧱・▌blender・chung',
            '❓・▌blender・hỏi・đáp',
            '💡・▌blender・tips'
        ],
        '┌─ | Maya': [
            '🧊・▌maya・chung',
            '❓・▌maya・hỏi・đáp',
            '💡・▌maya・tips'
        ],
        '┌─ | ZBrush': [
            '🗿・▌zbrush・chung',
            '❓・▌zbrush・hỏi・đáp',
            '💡・▌zbrush・tips'
        ]
    };

    for (const [catName, chanNames] of Object.entries(newStructure)) {
        let cat = findCat(catName);
        if (!cat) {
            console.log(`Creating category: ${catName}`);
            cat = await guild.channels.create({
                name: catName,
                type: ChannelType.GuildCategory
            });
        }
        
        for (const chanName of chanNames) {
            const exists = channels.find(c => c.name === chanName && c.parentId === cat.id);
            if (!exists) {
                console.log(`Creating channel: ${chanName}`);
                await guild.channels.create({
                    name: chanName,
                    type: ChannelType.GuildText,
                    parent: cat.id
                });
            }
        }
    }

    // Add channels to existing categories
    const existingAdditions = {
        '┌─ | 2D Design': [
            '❓・▌2d・hỏi・đáp'
        ],
        '┌─ | Beginner': [
            '❓・▌hỏi・đáp・newbie'
        ]
    };

    for (const [catName, chanNames] of Object.entries(existingAdditions)) {
        const cat = findCat(catName);
        if (cat) {
            for (const chanName of chanNames) {
                const exists = channels.find(c => c.name === chanName && c.parentId === cat.id);
                if (!exists) {
                    console.log(`Creating channel: ${chanName}`);
                    await guild.channels.create({
                        name: chanName,
                        type: ChannelType.GuildText,
                        parent: cat.id
                    });
                }
            }
        }
    }

    console.log('Restructure complete!');
    client.destroy();
});

client.login(process.env.DISCORD_TOKEN);
