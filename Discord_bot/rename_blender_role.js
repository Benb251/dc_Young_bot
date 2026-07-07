require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
    ]
});

client.once('ready', async () => {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    const roles = await guild.roles.fetch();
    
    // Find the '🧱 Blender' role
    const blenderRole = roles.find(r => r.name === '🧱 Blender');
    
    if (blenderRole) {
        console.log(`Renaming role ${blenderRole.name} to 🧱 3D Modeling (Blender/Maya)...`);
        await blenderRole.setName('🧱 3D Modeling (Blender/Maya)');
        console.log('Done!');
    } else {
        console.log('Could not find role 🧱 Blender');
    }
    
    client.destroy();
});

client.login(process.env.DISCORD_TOKEN);
