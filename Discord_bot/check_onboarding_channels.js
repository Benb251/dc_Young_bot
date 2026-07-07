require('dotenv').config();
const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
    try {
        const guild = await client.guilds.fetch(process.env.GUILD_ID);
        await guild.roles.fetch();
        await guild.channels.fetch();

        const visaRoleId = '1522665145103548538';
        const everyoneRole = guild.roles.everyone;

        console.log(`Global @everyone ViewChannel: ${everyoneRole.permissions.has(PermissionsBitField.Flags.ViewChannel)}`);
        
        const onboardingCat = guild.channels.cache.get('1522664670442422414');
        if (onboardingCat) {
            console.log(`\nCategory: ${onboardingCat.name} (${onboardingCat.id})`);
            printOverwrites(onboardingCat);
        }

        const children = guild.channels.cache.filter(c => c.parentId === '1522664670442422414');
        children.forEach(c => {
            console.log(`\nChannel: #${c.name} (${c.id})`);
            printOverwrites(c);
        });

        function printOverwrites(channel) {
            channel.permissionOverwrites.cache.forEach(ow => {
                const role = guild.roles.cache.get(ow.id);
                const name = role ? role.name : `ID: ${ow.id}`;
                const type = ow.type === 0 ? 'Role' : 'Member';
                const allow = new PermissionsBitField(ow.allow).toArray();
                const deny = new PermissionsBitField(ow.deny).toArray();
                console.log(`  - [${type}] ${name}:`);
                if (allow.length > 0) console.log(`    Allow: ${allow.join(', ')}`);
                if (deny.length > 0) console.log(`    Deny: ${deny.join(', ')}`);
            });
        }

    } catch (e) {
        console.error(e);
    } finally {
        client.destroy();
    }
});

client.login(process.env.DISCORD_TOKEN);
