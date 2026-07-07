require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

client.once('ready', async () => {
    try {
        console.log('🧹 Đang dọn dẹp kênh chào mừng...');
        const channelId = '1522664673185628324'; // #chào-mừng
        const channel = await client.channels.fetch(channelId);
        
        let deleted;
        let total = 0;
        do {
            deleted = await channel.bulkDelete(100, true);
            total += deleted.size;
        } while (deleted.size !== 0);

        console.log(`✅ Đã xóa tổng cộng ${total} tin nhắn trong kênh chào mừng!`);
    } catch (error) {
        console.error('Lỗi khi xóa tin nhắn:', error);
    } finally {
        client.destroy();
    }
});

client.login(process.env.DISCORD_TOKEN);
