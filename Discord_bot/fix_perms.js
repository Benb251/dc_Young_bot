require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.once('ready', async () => {
    try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        await guild.channels.fetch();
        const everyoneRole = guild.roles.everyone;

        console.log('🧹 Bắt đầu dọn dẹp quyền xem kênh thừa của @everyone...');

        const allowedIds = [
            '1522664673185628324', // #👋・▌chào・mừng
            '1522814924076613813', // #📜・▌rules
            '1522814923166580798'  // Category Onboarding
        ];

        let count = 0;
        for (const channel of guild.channels.cache.values()) {
            // Skip the channels we want to be public
            if (allowedIds.includes(channel.id)) continue;

            const overwrite = channel.permissionOverwrites.cache.get(everyoneRole.id);
            if (overwrite) {
                // Remove the explicit ViewChannel allow if it exists
                if (overwrite.allow.has('ViewChannel') || overwrite.deny.has('ViewChannel')) {
                    await channel.permissionOverwrites.delete(everyoneRole.id);
                    console.log(`✅ Đã xóa quyền ghi đè của @everyone trên kênh: ${channel.name}`);
                    count++;
                }
            }
        }
        
        console.log(`🎉 Đã dọn dẹp xong ${count} kênh/danh mục! Mem mới bây giờ sẽ bị "mù" chuẩn 100%.`);
    } catch (error) {
        console.error(error);
    } finally {
        client.destroy();
    }
});

client.login(process.env.DISCORD_TOKEN);
