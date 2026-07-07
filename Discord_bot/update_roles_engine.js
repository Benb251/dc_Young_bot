require('dotenv').config();
const { Client, GatewayIntentBits, ChannelType, PermissionsBitField } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    await guild.roles.fetch();
    const roles = guild.roles.cache;
    await guild.channels.fetch();
    const channels = guild.channels.cache;

    // 1. Create Game Engine Category and Channels
    let engineCat = channels.find(c => c.type === ChannelType.GuildCategory && c.name === '┌─ | Game Engine');
    if (!engineCat) {
        console.log('Creating Game Engine Category');
        engineCat = await guild.channels.create({
            name: '┌─ | Game Engine',
            type: ChannelType.GuildCategory
        });
        
        await guild.channels.create({ name: '🎮・▌game・engine・chung', type: ChannelType.GuildText, parent: engineCat.id });
        await guild.channels.create({ name: '❓・▌game・hỏi・đáp', type: ChannelType.GuildText, parent: engineCat.id });
    }

    // 2. Setup New Roles
    const newRolesConfig = [
        { name: '🧱 Blender', color: '#ff7c00' },
        { name: '🧊 Maya / Max', color: '#00e4ff' },
        { name: '🗿 ZBrush', color: '#686868' },
        { name: '🎮 Game Engine', color: '#00ff44' },
        { name: '🎨 2D Design', color: '#ff00d4' },
        { name: '📚 Beginner', color: '#ffe100' }
    ];

    const oldRoleKeywords = ['3D Modeling', 'Sculpt', 'Texturing', 'Game Art', 'Workflow', 'Tools', 'Đang học'];
    
    // Delete old roles
    for (const [id, role] of roles) {
        if (oldRoleKeywords.some(kw => role.name.includes(kw))) {
            console.log(`Deleting old role: ${role.name}`);
            try { await role.delete(); } catch(e) { console.error(`Cannot delete ${role.name}`); }
        }
    }

    const createdRoles = {};
    for (const rc of newRolesConfig) {
        let r = roles.find(r => r.name === rc.name);
        if (!r) {
            console.log(`Creating role: ${rc.name}`);
            r = await guild.roles.create({ name: rc.name, color: rc.color });
        }
        createdRoles[rc.name] = r;
    }

    // 3. Map Permissions
    const map = {
        '┌─ | Blender': '🧱 Blender',
        '┌─ | Maya': '🧊 Maya / Max',
        '┌─ | ZBrush': '🗿 ZBrush',
        '┌─ | Game Engine': '🎮 Game Engine',
        '┌─ | 2D Design': '🎨 2D Design',
        '┌─ | Beginner': '📚 Beginner'
    };

    for (const [catName, roleName] of Object.entries(map)) {
        const cat = channels.find(c => c.type === ChannelType.GuildCategory && c.name === catName);
        const role = createdRoles[roleName] || roles.find(r => r.name === roleName);
        
        if (cat && role) {
            console.log(`Setting permissions for ${catName} -> ${roleName}`);
            await cat.permissionOverwrites.set([
                {
                    id: guild.id, // @everyone
                    deny: [PermissionsBitField.Flags.ViewChannel]
                },
                {
                    id: role.id, // App Role
                    allow: [PermissionsBitField.Flags.ViewChannel]
                }
            ]);
            
            // Sync permissions for children
            const children = channels.filter(c => c.parentId === cat.id);
            for (const [id, ch] of children) {
                await ch.lockPermissions();
            }
        }
    }

    console.log('Roles and Permissions updated successfully!');
    client.destroy();
});

client.login(process.env.DISCORD_TOKEN);
