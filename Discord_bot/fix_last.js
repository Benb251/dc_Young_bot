require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.once('ready', async () => {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    const channels = await guild.channels.fetch();

    const c1 = channels.get('1522664673185628324'); // chào mừng
    const c2 = channels.get('1522697899945885937'); // announcements
    
    if (c1) await c1.setName(`👋·▌chào-mừng`);
    if (c2) await c2.setName(`📢·▌announcements`);
    
    console.log('Fixed remaining dashes');
    client.destroy();
});

client.login(process.env.DISCORD_TOKEN);
