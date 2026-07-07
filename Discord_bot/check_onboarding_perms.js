require('dotenv').config();
const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
    try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        await guild.roles.fetch();
        await guild.channels.fetch();

        const onboardingChannels = [
            '1522664673185628324', // #chào-mừng
            '1522664674850504775', // #giới-thiệu
            '1522664676729688247', // #chọn-vai-trò
            '1522664679510642818', // #bắt-đầu
        ];

        console.log('=== KỂM TRA QUYỀN TRÊN CÁC KÊNH ONBOARDING ===');
        for (const cid of onboardingChannels) {
            const channel = guild.channels.cache.get(cid);
            if (!channel) {
                console.log(`❌ Không tìm thấy kênh ID: ${cid}`);
                continue;
            }
            console.log(`\nKênh: #${channel.name} (ID: ${channel.id})`);
            console.log(`Category: ${channel.parent ? channel.parent.name : 'Không có'}`);

            channel.permissionOverwrites.cache.forEach(overwrite => {
                let targetName = '';
                if (overwrite.type === 0) { // Role
                    const role = guild.roles.cache.get(overwrite.id);
                    targetName = role ? `Role: ${role.name}` : `Role ID: ${overwrite.id}`;
                } else { // Member
                    targetName = `Member ID: ${overwrite.id}`;
                }

                const allow = new PermissionsBitField(overwrite.allow).toArray();
                const deny = new PermissionsBitField(overwrite.deny).toArray();

                console.log(`  - ${targetName}:`);
                if (allow.length > 0) console.log(`    Allow: ${allow.join(', ')}`);
                if (deny.length > 0) console.log(`    Deny: ${deny.join(', ')}`);
            });
        }

    } catch (e) {
        console.error(e);
    } finally {
        client.destroy();
    }
});

client.login(process.env.DISCORD_TOKEN);
