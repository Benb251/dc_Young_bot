require('dotenv').config();
const { Client, GatewayIntentBits, PermissionsBitField, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
    ]
});

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    await guild.members.fetch(); // Fetch all members to get accurate counts

    const roles = guild.roles.cache;
    const channels = guild.channels.cache;

    let roleData = {};
    let channelData = [];

    // Initialize role data
    roles.forEach(role => {
        const isAdmin = role.permissions.has(PermissionsBitField.Flags.Administrator);
        const manageServer = role.permissions.has(PermissionsBitField.Flags.ManageGuild);
        const manageRoles = role.permissions.has(PermissionsBitField.Flags.ManageRoles);
        const manageChannels = role.permissions.has(PermissionsBitField.Flags.ManageChannels);
        
        const isStaff = isAdmin || manageServer || manageRoles || manageChannels || role.managed;

        roleData[role.id] = {
            id: role.id,
            name: role.name,
            color: role.hexColor,
            position: role.position,
            memberCount: role.members.size,
            isStaff: isStaff,
            usedInPerms: false,
            important: false // if used in important channel perms
        };
    });

    // Process channels and check role usage
    channels.forEach(channel => {
        let overwrites = [];
        channel.permissionOverwrites.cache.forEach(overwrite => {
            if (overwrite.type === 0) { // Role overwrite
                overwrites.push(overwrite.id);
                if (roleData[overwrite.id]) {
                    roleData[overwrite.id].usedInPerms = true;
                    // Mark important if the channel is like a config, staff, log channel
                    const lowerName = channel.name.toLowerCase();
                    if (lowerName.includes('staff') || lowerName.includes('log') || lowerName.includes('config') || lowerName.includes('admin') || lowerName.includes('mod') || lowerName.includes('bot')) {
                        roleData[overwrite.id].important = true;
                    }
                }
            }
        });

        channelData.push({
            id: channel.id,
            name: channel.name,
            type: channel.type,
            parent: channel.parentId,
            position: channel.position,
            overwrites: overwrites
        });
    });

    // Grouping
    let groupA = [];
    let groupB = [];
    let groupC = [];

    for (const [id, data] of Object.entries(roleData)) {
        if (data.name === '@everyone') continue;

        if (data.isStaff || data.important) {
            groupA.push(data);
        } else if (!data.usedInPerms && data.memberCount <= 5) {
            groupC.push(data);
        } else {
            groupB.push(data);
        }
    }

    // Sort by position descending
    const sortByPosition = (a, b) => b.position - a.position;
    groupA.sort(sortByPosition);
    groupB.sort(sortByPosition);
    groupC.sort(sortByPosition);

    let report = `# Báo Cáo Audit Role & Channel - Server Tổ Young Phố\n\n`;

    report += `## 1. Role Audit\n\n`;
    report += `| Role ID | Tên | Staff | Used in Perms | Member Count |\n`;
    report += `|---|---|---|---|---|\n`;
    Object.values(roleData).sort(sortByPosition).forEach(r => {
        if (r.name === '@everyone') return;
        report += `| ${r.id} | ${r.name} | ${r.isStaff ? 'Y' : 'N'} | ${r.usedInPerms ? 'Y' : 'N'} | ${r.memberCount} |\n`;
    });

    report += `\n## 2. Channel & Permission Audit\n\n`;
    const categories = channelData.filter(c => c.type === ChannelType.GuildCategory).sort((a,b) => a.position - b.position);
    const nonCategories = channelData.filter(c => c.type !== ChannelType.GuildCategory).sort((a,b) => a.position - b.position);

    categories.forEach(cat => {
        report += `### 📁 [Category] ${cat.name} (${cat.id})\n`;
        const catRoles = cat.overwrites.map(id => roleData[id]?.name || id).join(', ');
        report += `- Overwrites: ${catRoles || 'None'}\n\n`;

        const children = nonCategories.filter(c => c.parent === cat.id);
        children.forEach(child => {
            const typeStr = child.type === ChannelType.GuildText ? 'Text' : (child.type === ChannelType.GuildVoice ? 'Voice' : (child.type === ChannelType.GuildForum ? 'Forum' : 'Other'));
            report += `  - 📝 [${typeStr}] ${child.name} (${child.id})\n`;
            const childRoles = child.overwrites.map(id => roleData[id]?.name || id).join(', ');
            report += `    - Overwrites: ${childRoles || 'None'}\n`;
        });
        report += `\n`;
    });

    const orphans = nonCategories.filter(c => !c.parent);
    if (orphans.length > 0) {
        report += `### 📁 [No Category]\n`;
        orphans.forEach(child => {
            const typeStr = child.type === ChannelType.GuildText ? 'Text' : (child.type === ChannelType.GuildVoice ? 'Voice' : (child.type === ChannelType.GuildForum ? 'Forum' : 'Other'));
            report += `  - 📝 [${typeStr}] ${child.name} (${child.id})\n`;
            const childRoles = child.overwrites.map(id => roleData[id]?.name || id).join(', ');
            report += `    - Overwrites: ${childRoles || 'None'}\n`;
        });
    }

    report += `\n## 3. Phân Nhóm Role\n\n`;

    report += `### 🔴 Group A – Staff / Hệ thống (Quyền quản lý / Kênh quan trọng)\n`;
    groupA.forEach(r => report += `- **${r.name}** (Member: ${r.memberCount})\n`);

    report += `\n### 🔵 Group B – Role cho member tự chọn (Thường dùng cho reaction-roles/onboarding)\n`;
    groupB.forEach(r => report += `- **${r.name}** (Member: ${r.memberCount})\n`);

    report += `\n### 🟡 Group C – Cần xem xét bỏ / merge (Ít user, ko dùng permission)\n`;
    groupC.forEach(r => report += `- **${r.name}** (Member: ${r.memberCount})\n`);

    const reportPath = path.join(__dirname, 'audit_report.md');
    fs.writeFileSync(reportPath, report);
    console.log('Report generated at ' + reportPath);

    client.destroy();
});

client.login(process.env.DISCORD_TOKEN);
