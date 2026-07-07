require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.once('ready', async () => {
    try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        const channelId = '1522664679510642818'; // #🚀・▌bắt・đầu
        const channel = guild.channels.cache.get(channelId);
        
        if (channel) {
            await channel.delete('Gộp chung với kênh rules');
            console.log(`✅ Đã xóa kênh "${channel.name}" thành công!`);
        } else {
            console.log(`❌ Không tìm thấy kênh bắt đầu (có thể đã bị xóa trước đó).`);
        }
    } catch (error) {
        console.error('Lỗi khi xóa kênh:', error);
    } finally {
        client.destroy();
    }
});

client.login(process.env.DISCORD_TOKEN);
