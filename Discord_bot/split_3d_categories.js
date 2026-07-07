require('dotenv').config();
const { Client, GatewayIntentBits, ChannelType, PermissionsBitField } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    await guild.roles.fetch();
    await guild.channels.fetch();

    const roles = guild.roles.cache;
    const channels = guild.channels.cache;
    const everyoneRole = guild.roles.everyone;

    // Helper to get role
    const getRole = (name) => roles.find(r => r.name === name);

    const configs = [
        { catName: '🧱 3D Modeling', role: '🧱 3D Modeling (Blender/Maya)', channel: '3d-modeling' },
        { catName: '🗿 Sculpting', role: '🗿 Sculpt / ZBrush', channel: 'sculpting' }, // Not allowed / in name easily, using Sculpting
        { catName: '🖌️ Texturing & Shaders', role: '🖌 Texturing & Shaders', channel: 'texturing' },
        { catName: '🎮 Game Engine', role: '🎮 Game Engine (Unity/Unreal)', channel: 'game-engine' },
        { catName: '🧊 Game Art & Env', role: '🧊 Game Art / Environment', channel: 'environment-prop' },
        { catName: '📐 Workflow & Pipeline', role: '📐 Workflow & Pipeline', channel: 'pipeline-teamwork' }
    ];

    for (const conf of configs) {
        const role = getRole(conf.role);
        if (!role) {
            console.log(`Role not found: ${conf.role}`);
            continue;
        }

        // Create Category
        let cat = channels.find(c => c.type === ChannelType.GuildCategory && c.name === conf.catName);
        if (!cat) {
            console.log(`Creating category: ${conf.catName}`);
            cat = await guild.channels.create({
                name: conf.catName,
                type: ChannelType.GuildCategory,
                permissionOverwrites: [
                    { id: everyoneRole.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                    { id: role.id, allow: [PermissionsBitField.Flags.ViewChannel] }
                ]
            });
        } else {
            // Update permissions
            await cat.permissionOverwrites.set([
                { id: everyoneRole.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: role.id, allow: [PermissionsBitField.Flags.ViewChannel] }
            ]);
        }

        // Find the channel
        const channel = channels.find(c => c.type === ChannelType.GuildText && c.name === conf.channel);
        if (channel) {
            console.log(`Moving channel ${conf.channel} to ${conf.catName}`);
            await channel.setParent(cat.id);
            await channel.lockPermissions();
        }
    }

    // Delete old category
    const oldCat = channels.find(c => c.type === ChannelType.GuildCategory && c.name === '🖥️ Chuyên Môn 3D & Game');
    if (oldCat) {
        console.log(`Deleting old category...`);
        // Note: category can only be deleted if it has no children, but we moved them all!
        await oldCat.delete();
    }

    console.log('Finished splitting 3D categories!');
    client.destroy();
});

client.login(process.env.DISCORD_TOKEN);
