require('dotenv').config();
const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.once('ready', async () => {
    try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        await guild.roles.fetch();
        await guild.channels.fetch();

        console.log(`🔐 Bắt đầu khóa Server ${guild.name}...`);

        // 1. Rename Cư dân role
        const visaRoleId = '1522665145103548538';
        const visaRole = guild.roles.cache.get(visaRoleId);
        if (visaRole) {
            await visaRole.edit({
                name: '🏠 Cư Dân (Có Visa)',
                permissions: [PermissionsBitField.Flags.ViewChannel] // Give View Channels globally
            });
            console.log(`✅ Đã hồi sinh Role "🏠 Cư Dân (Có Visa)"`);
        } else {
            console.log(`❌ Không tìm thấy role Visa!`);
        }

        // 2. Lock down @everyone globally
        const everyoneRole = guild.roles.everyone;
        // Turn off ViewChannels for @everyone globally
        const currentEveryonePerms = new PermissionsBitField(everyoneRole.permissions);
        currentEveryonePerms.remove(PermissionsBitField.Flags.ViewChannel);
        await everyoneRole.setPermissions(currentEveryonePerms);
        console.log(`✅ Đã khóa quyền View Channels đối với @everyone toàn Server.`);

        // 3. Exempt specific channels for @everyone
        const channelsToExempt = [
            '1522664673185628324', // #👋・▌chào・mừng
            '1522664679510642818', // #🚀・▌bắt・đầu
            '1522814924076613813'  // #📜・▌rules
        ];

        for (const channelId of channelsToExempt) {
            const channel = guild.channels.cache.get(channelId);
            if (channel) {
                await channel.permissionOverwrites.create(everyoneRole, {
                    ViewChannel: true,
                    SendMessages: false // Read only
                });
                console.log(`✅ Đã mở khóa cho @everyone nhìn thấy kênh: ${channel.name}`);
            }
        }

        console.log(`🎉 HOÀN TẤT! Server đã chuyển sang chế độ Verified Gate.`);
    } catch (error) {
        console.error('Lỗi:', error);
    } finally {
        client.destroy();
    }
});

client.login(process.env.DISCORD_TOKEN);
