require('dotenv').config();
const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.once('ready', async () => {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    const channels = await guild.channels.fetch();
    const everyoneRole = guild.roles.everyone;
    
    const idsToDelete = [
        '1522877282631291023', // new chào-mừng
        '1522877292836290560', // new chọn-vai-trò
        '1522877298108530778', // new giới-thiệu
        '1522877303338569768', // new bắt-đầu
        '1522877309017915492'  // new announcements
    ];
    
    for (const id of idsToDelete) {
        const ch = channels.get(id);
        if (ch) {
            console.log(`Deleting duplicate channel: ${ch.name} (${ch.id})`);
            await ch.delete();
        }
    }
    
    const categoryOnboarding = channels.find(c => c.type === 4 && c.name === '📋 Onboarding');
    
    // Move original announcements to Onboarding
    const origAnnouncements = channels.get('1522697899945885937');
    if (origAnnouncements && categoryOnboarding) {
        console.log(`Moving original announcements to Onboarding`);
        await origAnnouncements.setParent(categoryOnboarding.id);
        await origAnnouncements.lockPermissions();
        await origAnnouncements.permissionOverwrites.edit(everyoneRole.id, { SendMessages: false });
    }
    
    // Fix permissions for original channels
    const origChaoMung = channels.get('1522664673185628324');
    if (origChaoMung) {
        await origChaoMung.lockPermissions();
        await origChaoMung.permissionOverwrites.edit(everyoneRole.id, { SendMessages: false });
    }
    
    const origChonVaiTro = channels.get('1522664676729688247');
    if (origChonVaiTro) {
        await origChonVaiTro.lockPermissions();
        await origChonVaiTro.permissionOverwrites.edit(everyoneRole.id, { SendMessages: false, AddReactions: true });
    }
    
    const origBatDau = channels.get('1522664679510642818');
    if (origBatDau) {
        await origBatDau.lockPermissions();
        await origBatDau.permissionOverwrites.edit(everyoneRole.id, { SendMessages: false });
    }
    
    const origGioiThieu = channels.get('1522664674850504775');
    if (origGioiThieu) {
        await origGioiThieu.lockPermissions();
        await origGioiThieu.permissionOverwrites.edit(everyoneRole.id, { SendMessages: true });
    }
    
    console.log('Fixed duplicates and permissions!');
    client.destroy();
});

client.login(process.env.DISCORD_TOKEN);
