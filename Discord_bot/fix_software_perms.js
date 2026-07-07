require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

const GUILD_ID = process.env.GUILD_ID;
const VISA_ROLE_ID = '1522665145103548538';

const MAPPINGS = [
    { categoryRegex: /Blender/i, roleId: '1522890537516929135' },
    { categoryRegex: /Maya/i, roleId: '1522890539752624248' },
    { categoryRegex: /ZBrush/i, roleId: '1522890542218739863' },
    { categoryRegex: /Substance/i, roleId: '1522902597881827399' },
    { categoryRegex: /2D Design/i, roleId: '1522890546262048818' },
    { categoryRegex: /Beginner/i, roleId: '1522890548275445772' },
];

client.once('ready', async () => {
    try {
        const guild = await client.guilds.fetch(GUILD_ID);
        await guild.channels.fetch();

        console.log('🔄 Đang cấu hình lại quyền cho các khu vực chuyên môn...');

        for (const mapping of MAPPINGS) {
            // Find category
            const category = guild.channels.cache.find(c => c.type === 4 && mapping.categoryRegex.test(c.name));
            if (category) {
                console.log(`⚙️  Đang xử lý danh mục: ${category.name}`);
                
                // 1. Chặn @everyone
                await category.permissionOverwrites.edit(guild.id, {
                    ViewChannel: false
                });

                // 2. Chặn role Visa (để họ không tự động thấy toàn bộ)
                await category.permissionOverwrites.edit(VISA_ROLE_ID, {
                    ViewChannel: false
                });

                // 3. Mở khóa cho Role chuyên môn tương ứng
                await category.permissionOverwrites.edit(mapping.roleId, {
                    ViewChannel: true
                });

                // 4. Đồng bộ hóa (Sync) tất cả các kênh con bên trong với danh mục này
                const children = guild.channels.cache.filter(c => c.parentId === category.id);
                for (const child of children.values()) {
                    await child.lockPermissions();
                }

                console.log(`   ✅ Xong! (${children.size} kênh con đã đồng bộ)`);
            }
        }

        console.log('🎉 Đã cô lập hoàn toàn các kênh chuyên môn!');
    } catch (e) {
        console.error(e);
    } finally {
        client.destroy();
    }
});

client.login(process.env.DISCORD_TOKEN);
