require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.once('ready', async () => {
    try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        await guild.channels.fetch();

        const channelsToLock = [
            '1522664673185628324', // #chào-mừng
            '1522664676729688247', // #chọn-vai-trò
            '1522814924076613813', // #rules
        ];

        // Tìm thêm kênh announcements nếu có
        const announcements = guild.channels.cache.find(c => c.name.includes('announcements'));
        if (announcements) channelsToLock.push(announcements.id);

        for (const channelId of channelsToLock) {
            const channel = guild.channels.cache.get(channelId);
            if (channel) {
                console.log(`🔒 Đang khóa chat kênh: ${channel.name}`);
                await channel.permissionOverwrites.edit(guild.id, {
                    SendMessages: false,
                    SendMessagesInThreads: false,
                    CreatePublicThreads: false,
                    CreatePrivateThreads: false,
                    AddReactions: false // Có thể cho phép tùy chọn, nhưng mặc định chặn để đỡ phá
                });
                
                // Nếu có role Visa, chặn luôn (đề phòng role Visa ghi đè)
                const VISA_ROLE_ID = '1522665145103548538';
                const overwriteOptions = {
                    SendMessages: false,
                    AddReactions: false
                };
                if (channelId === '1522664673185628324') { // #chào-mừng
                    overwriteOptions.ViewChannel = true;
                }
                await channel.permissionOverwrites.edit(VISA_ROLE_ID, overwriteOptions);
            }
        }

        // Nếu cả category Onboarding cần khóa
        const onboardingCat = guild.channels.cache.find(c => c.type === 4 && c.name.includes('Onboarding'));
        if (onboardingCat) {
            console.log(`🔒 Đang khóa category: ${onboardingCat.name}`);
            await onboardingCat.permissionOverwrites.edit(guild.id, { SendMessages: false });
        }

        console.log('✅ Đã khóa chat thành công các kênh quan trọng!');
    } catch (error) {
        console.error(error);
    } finally {
        client.destroy();
    }
});

client.login(process.env.DISCORD_TOKEN);
