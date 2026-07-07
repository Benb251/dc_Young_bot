require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.once('ready', async () => {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    await guild.roles.fetch();
    const roles = ['🧱 Blender', '🧊 Maya / Max', '🗿 ZBrush', '🎮 Game Engine', '🎨 2D Design', '📚 Beginner'];
    roles.forEach(name => {
        const r = guild.roles.cache.find(role => role.name === name);
        console.log(`${name}: ${r ? r.id : 'NOT FOUND'}`);
    });
    client.destroy();
});
client.login(process.env.DISCORD_TOKEN);
