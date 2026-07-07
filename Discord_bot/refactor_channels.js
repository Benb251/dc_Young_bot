require('dotenv').config();
const { Client, GatewayIntentBits, ChannelType, PermissionsBitField } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
    ]
});

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    await guild.roles.fetch();
    await guild.channels.fetch();

    const roles = guild.roles.cache;
    const channels = guild.channels.cache;

    // Helper function to get role by name
    const getRole = (name) => roles.find(r => r.name === name);

    const everyoneRole = guild.roles.everyone;

    // Role mappings
    const role3DNames = [
        '🧱 3D Modeling (Blender/Maya)',
        '🗿 Sculpt / ZBrush',
        '🖌 Texturing & Shaders',
        '🎮 Game Engine (Unity/Unreal)',
        '🧊 Game Art / Environment',
        '📐 Workflow & Pipeline'
    ];
    const role2DName = '🎨 2D / Concept / Graphic';
    const roleTechName = '🧪 Tools / Scripts / Bboard';
    const roleBeginnerName = '📚 Đang học 3D';

    // Categories config
    const categoriesConfig = [
        {
            name: '📋 Onboarding',
            channels: ['chào-mừng', 'rules', 'chọn-vai-trò', 'giới-thiệu', 'bắt-đầu', 'announcements'],
            perms: [
                { id: everyoneRole.id, allow: [PermissionsBitField.Flags.ViewChannel] }
            ]
        },
        {
            name: '💬 Chung',
            channels: ['chung', 'khoe-work', 'hỏi-đáp', 'tài-nguyên'],
            perms: [
                { id: everyoneRole.id, allow: [PermissionsBitField.Flags.ViewChannel] }
            ]
        },
        {
            name: '🖥️ Chuyên Môn 3D & Game',
            channels: ['3d-modeling', 'sculpting', 'texturing', 'game-engine', 'environment-prop', 'pipeline-teamwork'],
            perms: [
                { id: everyoneRole.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                ...role3DNames.map(rName => {
                    const r = getRole(rName);
                    return r ? { id: r.id, allow: [PermissionsBitField.Flags.ViewChannel] } : null;
                }).filter(Boolean)
            ]
        },
        {
            name: '🎨 2D Design',
            channels: ['2d-concept'],
            perms: [
                { id: everyoneRole.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                getRole(role2DName) ? { id: getRole(role2DName).id, allow: [PermissionsBitField.Flags.ViewChannel] } : null
            ].filter(Boolean)
        },
        {
            name: '🧪 Tech & Code',
            channels: ['tools-bboard'],
            perms: [
                { id: everyoneRole.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                getRole(roleTechName) ? { id: getRole(roleTechName).id, allow: [PermissionsBitField.Flags.ViewChannel] } : null
            ].filter(Boolean)
        },
        {
            name: '📚 Beginner',
            channels: ['beginner-zone'],
            perms: [
                { id: everyoneRole.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                getRole(roleBeginnerName) ? { id: getRole(roleBeginnerName).id, allow: [PermissionsBitField.Flags.ViewChannel] } : null
            ].filter(Boolean)
        }
    ];

    for (const catConfig of categoriesConfig) {
        // Find or create category
        let category = channels.find(c => c.type === ChannelType.GuildCategory && c.name === catConfig.name);
        if (!category) {
            console.log(`Creating category: ${catConfig.name}`);
            category = await guild.channels.create({
                name: catConfig.name,
                type: ChannelType.GuildCategory,
                permissionOverwrites: catConfig.perms
            });
        } else {
            console.log(`Updating category: ${catConfig.name}`);
            await category.permissionOverwrites.set(catConfig.perms);
        }

        // Process channels in category
        for (const chName of catConfig.channels) {
            let channel = channels.find(c => c.type === ChannelType.GuildText && c.name === chName);
            if (!channel) {
                console.log(`Creating channel: ${chName} under ${catConfig.name}`);
                channel = await guild.channels.create({
                    name: chName,
                    type: ChannelType.GuildText,
                    parent: category.id
                });
            } else {
                console.log(`Moving channel: ${chName} to ${catConfig.name}`);
                await channel.setParent(category.id);
            }

            // Sync with category initially
            await channel.lockPermissions();

            // Override specific permissions if needed
            if (catConfig.name === '📋 Onboarding') {
                if (['chào-mừng', 'rules', 'bắt-đầu', 'announcements'].includes(chName)) {
                    await channel.permissionOverwrites.edit(everyoneRole.id, { SendMessages: false });
                } else if (chName === 'chọn-vai-trò') {
                    await channel.permissionOverwrites.edit(everyoneRole.id, { SendMessages: false, AddReactions: true });
                } else if (chName === 'giới-thiệu') {
                    await channel.permissionOverwrites.edit(everyoneRole.id, { SendMessages: true });
                }
            }
        }
    }

    console.log('Finished refactoring channels and permissions.');
    client.destroy();
});

client.login(process.env.DISCORD_TOKEN);
