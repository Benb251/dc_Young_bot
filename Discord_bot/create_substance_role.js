require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.once('ready', async () => {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    
    console.log("Creating Substance role...");
    try {
        await guild.roles.create({
            name: '🎨 Substance',
            color: '#a71313' // A color fitting for Substance Painter (Reddish)
        });
        console.log("Created role Substance successfully!");
    } catch(e) {
        console.error("Failed to create role: ", e.message);
    }
    
    client.destroy();
});

client.login(process.env.DISCORD_TOKEN);
