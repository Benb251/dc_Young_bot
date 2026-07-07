require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.once('ready', async () => {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    const channel = await guild.channels.fetch('1522664673185628324', { force: true });
    
    if (channel) {
        console.log("Channel Name: " + channel.name);
        for (let i = 0; i < channel.name.length; i++) {
            console.log(`Char ${i}: ${channel.name[i]} (U+${channel.name.charCodeAt(i).toString(16).padStart(4, '0')})`);
        }
    } else {
        console.log("Channel not found");
    }

    client.destroy();
});

client.login(process.env.DISCORD_TOKEN);
