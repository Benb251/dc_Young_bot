require('dotenv').config();
const { Client, GatewayIntentBits, ChannelType } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.once('ready', async () => {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    
    // Fetch channels and roles
    await guild.channels.fetch();
    const channels = guild.channels.cache;
    await guild.roles.fetch();
    const roles = guild.roles.cache;

    // Delete role
    const engineRole = roles.find(r => r.name === '🎮 Game Engine');
    if (engineRole) {
        console.log(`Deleting role: ${engineRole.name}`);
        try {
            await engineRole.delete();
        } catch(e) {
            console.error(`Failed to delete role: ${e.message}`);
        }
    }

    // Delete category and its channels
    const engineCat = channels.find(c => c.type === ChannelType.GuildCategory && c.name === '┌─ | Game Engine');
    if (engineCat) {
        // Find and delete children
        const children = channels.filter(c => c.parentId === engineCat.id);
        for (const [id, ch] of children) {
            console.log(`Deleting channel: ${ch.name}`);
            try {
                await ch.delete();
            } catch(e) {
                console.error(`Failed to delete channel ${ch.name}: ${e.message}`);
            }
        }
        
        console.log(`Deleting category: ${engineCat.name}`);
        try {
            await engineCat.delete();
        } catch(e) {
            console.error(`Failed to delete category: ${e.message}`);
        }
    }

    console.log('Game Engine cleanup complete!');
    client.destroy();
});

client.login(process.env.DISCORD_TOKEN);
