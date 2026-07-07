require('dotenv').config();
const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.once('ready', async () => {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    await guild.roles.fetch();
    
    // Check Bố già đầu hẻm role
    const boGiaRole = guild.roles.cache.find(r => r.name.toLowerCase().includes('bố già đầu hẻm') || r.name.toLowerCase().includes('ban quản đốc') || r.name.includes('Admin'));
    if (boGiaRole) {
        const isAdmin = boGiaRole.permissions.has(PermissionsBitField.Flags.Administrator);
        console.log(`Role ${boGiaRole.name} has Administrator flag: ${isAdmin}`);
    } else {
        console.log('Role not found. Listing all roles:');
        guild.roles.cache.forEach(r => console.log(r.name));
    }
    
    client.destroy();
});

client.login(process.env.DISCORD_TOKEN);
