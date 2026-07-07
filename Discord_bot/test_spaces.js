require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.once('ready', async () => {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    const channels = await guild.channels.fetch();

    const IDEO = '　'; // U+3000
    const KATA = '・'; // U+30FB
    
    const c1 = channels.get('1522664673185628324'); // chào mừng
    const c2 = channels.get('1522664674850504775'); // giới thiệu
    
    if (c1) {
        console.log(`Setting c1 to KATA...`);
        await c1.setName(`👋${KATA}▌${KATA}chào-mừng`);
    }
    
    if (c2) {
        console.log(`Setting c2 to IDEO...`);
        await c2.setName(`🤝${IDEO}·${IDEO}▌${IDEO}giới-thiệu`);
    }
    
    console.log('Testing done. Wait a moment to fetch and check names.');
    
    setTimeout(async () => {
        const c1Fetch = await guild.channels.fetch('1522664673185628324', { force: true });
        const c2Fetch = await guild.channels.fetch('1522664674850504775', { force: true });
        console.log(`c1 actual: ${c1Fetch.name}`);
        console.log(`c2 actual: ${c2Fetch.name}`);
        client.destroy();
    }, 2000);
});

client.login(process.env.DISCORD_TOKEN);
