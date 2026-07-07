require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.once('ready', async () => {
    try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        await guild.channels.fetch();
        const everyoneRole = guild.roles.everyone;

        console.log(`Global @everyone permissions ViewChannel: ${everyoneRole.permissions.has('ViewChannel')}`);

        console.log('--- Channels allowing @everyone to View ---');
        guild.channels.cache.forEach(channel => {
            const perms = channel.permissionOverwrites.cache.get(everyoneRole.id);
            if (perms) {
                if (perms.allow.has('ViewChannel')) {
                    console.log(`[ALLOW] ${channel.name} (${channel.type})`);
                } else if (perms.deny.has('ViewChannel')) {
                    // console.log(`[DENY] ${channel.name} (${channel.type})`);
                }
            } else {
                // If it inherits, check the category
                if (channel.parentId) {
                    const category = guild.channels.cache.get(channel.parentId);
                    const catPerms = category?.permissionOverwrites.cache.get(everyoneRole.id);
                    if (catPerms && catPerms.allow.has('ViewChannel')) {
                        console.log(`[ALLOW VIA CATEGORY] ${channel.name} (${channel.type})`);
                    }
                }
            }
        });
        
    } catch (error) {
        console.error(error);
    } finally {
        client.destroy();
    }
});

client.login(process.env.DISCORD_TOKEN);
