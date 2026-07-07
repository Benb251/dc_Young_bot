require('dotenv').config();
const { Client, GatewayIntentBits, ChannelType } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.once('ready', async () => {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    await guild.channels.fetch();
    const channels = guild.channels.cache;

    const chungCat = channels.find(c => c.type === ChannelType.GuildCategory && c.name === '┌─ | Chung');
    
    if (chungCat) {
        console.log("Recreating khoe-work...");
        try {
            await guild.channels.create({
                name: '✨・▌khoe-work',
                type: ChannelType.GuildForum,
                parent: chungCat.id,
                defaultForumLayout: 2 // GalleryView
            });
            console.log("Created khoe-work");
        } catch (e) {
            console.error(`Failed to create khoe-work: ${e.message}`);
        }
    }
    
    client.destroy();
});

client.login(process.env.DISCORD_TOKEN);
