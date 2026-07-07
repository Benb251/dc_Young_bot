require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
    try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        
        // ID kênh chào-mừng
        const welcomeChannel = guild.channels.cache.get('1522664673185628324');
        const everyoneRole = guild.roles.everyone;
        
        if (welcomeChannel) {
            console.log(`⚙️ Đang cấu hình kênh: #${welcomeChannel.name}...`);
            
            // Ép quyền ViewChannel = false đối với @everyone trên kênh này
            await welcomeChannel.permissionOverwrites.edit(everyoneRole.id, {
                ViewChannel: false,
                SendMessages: false
            });
            console.log(`✅ Đã CẤM @everyone xem kênh #${welcomeChannel.name}`);
            
            console.log(`🎉 HOÀN TẤT! Cổng An Ninh đã được thiết lập. Người mới sẽ chỉ thấy kênh #rules.`);
        } else {
            console.log(`❌ Không tìm thấy kênh chào mừng!`);
        }
    } catch (e) {
        console.error(e);
    } finally {
        client.destroy();
    }
});

client.login(process.env.DISCORD_TOKEN);
