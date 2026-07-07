require('dotenv').config();
const { Client, GatewayIntentBits, ChannelType, PermissionsBitField } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.once('ready', async () => {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    await guild.roles.fetch();
    const roles = guild.roles.cache;
    
    // Find the Substance role
    const subRole = roles.find(r => r.name === '🎨 Substance');
    
    if (!subRole) {
        console.error("Substance role not found!");
        client.destroy();
        return;
    }

    console.log("Creating Substance Category...");
    try {
        const cat = await guild.channels.create({
            name: '┌─ | Substance',
            type: ChannelType.GuildCategory,
            permissionOverwrites: [
                {
                    id: guild.id, // @everyone
                    deny: [PermissionsBitField.Flags.ViewChannel]
                },
                {
                    id: subRole.id, // 🎨 Substance
                    allow: [PermissionsBitField.Flags.ViewChannel]
                }
            ]
        });
        
        console.log("Creating Text Channel...");
        await guild.channels.create({
            name: '🖌️・▌substance・chung',
            type: ChannelType.GuildText,
            parent: cat.id
        });

        console.log("Creating Hỏi Đáp Forum...");
        await guild.channels.create({
            name: '❓・▌substance・hỏi・đáp',
            type: ChannelType.GuildForum,
            parent: cat.id,
            defaultForumLayout: 0 // NotSet/ListView
        });

        console.log("Creating Tips Forum...");
        await guild.channels.create({
            name: '💡・▌substance・tips',
            type: ChannelType.GuildForum,
            parent: cat.id,
            defaultForumLayout: 0
        });
        
        console.log("Substance structure created successfully!");
    } catch(e) {
        console.error("Failed to create structure: ", e.message);
    }
    
    client.destroy();
});

client.login(process.env.DISCORD_TOKEN);
