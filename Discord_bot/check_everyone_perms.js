require('dotenv').config();
const { Client, GatewayIntentBits, PermissionsBitField, ChannelType } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
    try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        await guild.roles.fetch();
        await guild.channels.fetch();

        const everyoneRole = guild.roles.everyone;
        const globalPerms = new PermissionsBitField(everyoneRole.permissions);
        
        console.log(`==========================================`);
        console.log(`🔍 KIỂM TRA QUYỀN CỦA @everyone HÀN TẠI`);
        console.log(`==========================================`);
        console.log(`\n1. [QUYỀN CHUNG (GLOBAL PERMS) CỦA @everyone]`);
        console.log(`   - Xem kênh (View Channels): ${globalPerms.has(PermissionsBitField.Flags.ViewChannel) ? '✅ CÓ' : '❌ KHÔNG'}`);
        console.log(`   - Gửi tin nhắn (Send Messages): ${globalPerms.has(PermissionsBitField.Flags.SendMessages) ? '✅ CÓ' : '❌ KHÔNG'}`);
        
        console.log(`\n2. [NGOẠI LỆ (OVERWRITES) TRÊN TỪNG KÊNH]`);
        
        // Sắp xếp kênh theo thứ tự để dễ nhìn
        const sortedChannels = [...guild.channels.cache.values()].sort((a, b) => a.position - b.position);
        
        let foundOverwrites = false;
        sortedChannels.forEach(channel => {
            const overwrite = channel.permissionOverwrites.cache.get(everyoneRole.id);
            if (overwrite) {
                const allow = new PermissionsBitField(overwrite.allow);
                const deny = new PermissionsBitField(overwrite.deny);
                
                // Chỉ log nếu có thay đổi về quyền ViewChannel hoặc SendMessages
                if (
                    allow.has(PermissionsBitField.Flags.ViewChannel) || deny.has(PermissionsBitField.Flags.ViewChannel) ||
                    allow.has(PermissionsBitField.Flags.SendMessages) || deny.has(PermissionsBitField.Flags.SendMessages)
                ) {
                    foundOverwrites = true;
                    console.log(`   🔸 Kênh/Danh mục: ${channel.name}`);
                    
                    if (allow.has(PermissionsBitField.Flags.ViewChannel)) console.log(`      ↳ Xem kênh: ✅ ĐƯỢC PHÉP`);
                    if (deny.has(PermissionsBitField.Flags.ViewChannel)) console.log(`      ↳ Xem kênh: ❌ CẤM`);
                    
                    if (allow.has(PermissionsBitField.Flags.SendMessages)) console.log(`      ↳ Gửi tin nhắn: ✅ ĐƯỢC PHÉP`);
                    if (deny.has(PermissionsBitField.Flags.SendMessages)) console.log(`      ↳ Gửi tin nhắn: ❌ CẤM`);
                }
            }
        });
        
        if (!foundOverwrites) {
            console.log(`   (Không có kênh nào bị thiết lập ngoại lệ riêng biệt)`);
        }

    } catch (e) {
        console.error(e);
    } finally {
        client.destroy();
    }
});

client.login(process.env.DISCORD_TOKEN);
