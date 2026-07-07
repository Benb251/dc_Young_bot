require('dotenv').config();
const { Client, GatewayIntentBits, ChannelType } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.once('ready', async () => {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    await guild.channels.fetch();
    const channels = guild.channels.cache;

    const gioithieuChannel = channels.find(c => c.type === ChannelType.GuildText && c.name.includes('giới・thiệu'));
    
    if (gioithieuChannel) {
        console.log(`Found channel: ${gioithieuChannel.name}, deleting...`);
        try {
            await gioithieuChannel.delete();
            console.log('Successfully deleted channel.');
        } catch (error) {
            console.error('Failed to delete channel:', error);
        }
    } else {
        console.log('Channel giới-thiệu not found. Please check the name.');
        channels.filter(c => c.type === ChannelType.GuildText).forEach(c => console.log(c.name));
    }
    
    client.destroy();
});

client.login(process.env.DISCORD_TOKEN);
