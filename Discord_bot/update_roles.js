require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions
    ]
});

const renameMapping = {
    '🎭 Nặn mặt': '🗿 Sculpt / ZBrush',
    '🧱 Dựng block': '🧱 Blender',
    '🎨 Sơn shader': '🖌 Texturing & Shaders',
    '🎮 Bày game': '🎮 Game Engine (Unity/Unreal)',
    '🐛 Vá bug': '🧪 Tools / Scripts / Bboard'
};

const newRoles = [
    '🧊 Game Art / Environment',
    '📐 Workflow & Pipeline',
    '🎨 2D / Concept / Graphic',
    '📚 Đang học 3D'
];

const deprecatedRolesList = [
    '🌱 Thực tập xin',
    '📖 Học vẹt',
    '🏠 Cư dân',
    '🔧 Tay có nghề',
    '🏆 Ông trùm render',
    '🏗️ WIP đầy nhà',
    '⏳ Render chưa về',
    '💀 Deadline dí'
];

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    const guild = await client.guilds.fetch(process.env.GUILD_ID);

    const roles = await guild.roles.fetch();

    // Step 2 & 4: Rename and deprecate
    for (const [id, role] of roles) {
        if (renameMapping[role.name]) {
            console.log(`Renaming role ${role.name} to ${renameMapping[role.name]}`);
            await role.setName(renameMapping[role.name]);
        } else if (deprecatedRolesList.includes(role.name)) {
            console.log(`Marking role ${role.name} as DEPRECATED`);
            await role.setName(role.name + ' [DEPRECATED]');
        }
    }

    // Step 3: Create new roles
    for (const roleName of newRoles) {
        // Check if role already exists
        const exists = roles.find(r => r.name === roleName);
        if (!exists) {
            console.log(`Creating new role: ${roleName}`);
            await guild.roles.create({
                name: roleName,
                reason: 'Yêu cầu tạo role mới từ admin'
            });
        }
    }

    // Step 1: Remove reactions in #chọn-vai-trò
    // Tìm kênh #chọn-vai-trò
    const channels = await guild.channels.fetch();
    const chooseRoleChannel = channels.find(c => c.name === 'chọn-vai-trò');
    if (chooseRoleChannel) {
        try {
            const messages = await chooseRoleChannel.messages.fetch({ limit: 10 });
            for (const [id, message] of messages) {
                console.log(`Clearing reactions from message ${message.id} in #chọn-vai-trò`);
                await message.reactions.removeAll();
            }
        } catch (e) {
            console.error('Failed to clear reactions:', e);
        }
    } else {
        console.log('Channel #chọn-vai-trò not found.');
    }

    console.log('Done!');
    client.destroy();
});

client.login(process.env.DISCORD_TOKEN);
