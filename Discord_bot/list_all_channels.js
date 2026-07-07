require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
    try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        await guild.channels.fetch();
        
        console.log("=== ALL CHANNELS ===");
        guild.channels.cache.forEach(c => {
            console.log(`${c.id} | ${c.name} | Type: ${c.type} | Parent: ${c.parentId}`);
        });
    } catch (e) {
        console.error(e);
    } finally {
        client.destroy();
    }
});

client.login(process.env.DISCORD_TOKEN);
