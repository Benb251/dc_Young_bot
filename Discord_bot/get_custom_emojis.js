require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildEmojisAndStickers]
});

client.once('ready', async () => {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    await guild.emojis.fetch();
    
    console.log("Here are your custom emojis in format for Carl-bot:");
    guild.emojis.cache.forEach(emoji => {
        // We only care about the ones requested or similar
        const name = emoji.name.toLowerCase();
        if (name.includes('blender') || 
            name.includes('substance') || 
            name.includes('zbrush') || 
            name.includes('maya') || 
            name.includes('958995designpalette')) {
            console.log(`${emoji.name}: <${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>`);
        }
    });
    
    client.destroy();
});

client.login(process.env.DISCORD_TOKEN);
