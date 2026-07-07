require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once('ready', async () => {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    const chooseRoleChannel = await guild.channels.fetch('1522664676729688247');
    
    if (chooseRoleChannel) {
        try {
            const messages = await chooseRoleChannel.messages.fetch({ limit: 10 });
            for (const [id, msg] of messages) {
                if (msg.author.id === client.user.id) {
                    await msg.delete();
                }
            }
        } catch (e) {
            console.error('Error fetching/deleting old messages:', e);
        }
    }
    client.destroy();
});

client.login(process.env.DISCORD_TOKEN);
