require('dotenv').config();
const { Client, GatewayIntentBits, ChannelType } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

client.once('ready', async () => {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    
    // Fetch all members to get accurate role counts
    await guild.members.fetch();
    await guild.channels.fetch();
    await guild.roles.fetch();
    
    const channels = guild.channels.cache;
    const roles = guild.roles.cache;
    
    console.log("### A. Danh sách danh mục & kênh\n");
    
    const typeName = {
        [ChannelType.GuildText]: 'Text',
        [ChannelType.GuildVoice]: 'Voice',
        [ChannelType.GuildForum]: 'Forum'
    };

    const categories = channels.filter(c => c.type === ChannelType.GuildCategory);
    
    categories.forEach(cat => {
        let note = "Core (Ai cũng thấy)";
        const catName = cat.name.toLowerCase();
        if (catName.includes('blender') || catName.includes('maya') || catName.includes('zbrush') || catName.includes('substance')) note = "Chuyên môn 3D (Cần Role)";
        else if (catName.includes('2d')) note = "Chuyên môn 2D (Cần Role)";
        else if (catName.includes('beginner')) note = "Beginner (Cần Role)";
        
        console.log(`- **${cat.name}** *(${note})*`);
        
        const children = channels.filter(c => c.parentId === cat.id).sort((a, b) => a.position - b.position);
        children.forEach(ch => {
            const tName = typeName[ch.type] || 'Khác';
            console.log(`  - ${ch.name} – ${tName}`);
        });
    });

    console.log("\n### B. Danh sách role còn đang dùng\n");
    
    const openRoleNames = ['🧱 Blender', '🧊 Maya / Max', '🗿 ZBrush', '🎨 2D Design', '📚 Beginner', '🎨 Substance'];
    
    const rolesArray = [...roles.values()].sort((a, b) => b.position - a.position);
    
    rolesArray.forEach(role => {
        if (role.name === '@everyone') return;
        
        let group = 'Khác';
        if (role.name.toLowerCase().includes('quản đốc') || role.name.toLowerCase().includes('admin') || role.name.includes('Bố già')) {
            group = 'Staff (Quản trị/Mod)';
        } else if (openRoleNames.includes(role.name)) {
            group = 'Mở kênh (Reaction Role)';
        } else if (role.managed) {
            group = 'Bot/Integration';
        }
        
        console.log(`- **${role.name}** | Nhóm: ${group} | Số lượng member: ${role.members.size}`);
    });
    
    client.destroy();
});

client.login(process.env.DISCORD_TOKEN);
