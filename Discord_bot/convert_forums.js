require('dotenv').config();
const { Client, GatewayIntentBits, ChannelType } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.once('ready', async () => {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    await guild.channels.fetch();
    const channels = guild.channels.cache;

    // Retry khoe-work and tài-nguyên which failed
    const namesToRetry = ['✨・▌khoe-work', '💎・▌tài-nguyên'];
    
    for (const name of namesToRetry) {
        const ch = channels.find(c => c.type === ChannelType.GuildText && c.name === name);
        if (ch) {
            console.log(`Converting ${name}...`);
            const parentId = ch.parentId;
            try {
                await ch.delete();
                let layout = 0; // NotSet
                if (name.includes('khoe-work')) layout = 2; // GalleryView
                
                await guild.channels.create({
                    name: name,
                    type: ChannelType.GuildForum,
                    parent: parentId,
                    defaultForumLayout: layout
                });
                console.log(`Created forum: ${name}`);
            } catch (e) {
                console.error(`Failed: ${e.message}`);
            }
        }
    }
    
    client.destroy();
});

client.login(process.env.DISCORD_TOKEN);
