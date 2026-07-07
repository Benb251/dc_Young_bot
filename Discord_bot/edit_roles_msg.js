require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.once('ready', async () => {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    await guild.channels.fetch();
    
    // Find the channel
    const channel = guild.channels.cache.find(c => c.name.includes('chọn・vai・trò') || c.name.includes('chọn-vai-trò'));
    
    if (channel) {
        try {
            const messageId = '1522907061682307214';
            const msg = await channel.messages.fetch(messageId);
            
            if (msg) {
                // Modify embed to use Thumbnail instead of Image
                const oldEmbed = msg.embeds[0];
                const newEmbed = EmbedBuilder.from(oldEmbed)
                    .setImage(null) // Remove large image
                    .setThumbnail('https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExcnJvZ2IzcnhzMjdjcHlxODVkMWZxbDdheWs1cjViMzE1OWluamRlaiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/j91j9wdUh3rm8/giphy.gif'); // Set as small thumbnail

                await msg.edit({ embeds: [newEmbed] });
                console.log(`Embed updated back to thumbnail successfully!`);
            }
        } catch (error) {
            console.error('Failed to edit message:', error);
        }
    }
    
    client.destroy();
});

client.login(process.env.DISCORD_TOKEN);
