require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.once('ready', async () => {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    const channels = await guild.channels.fetch();
    
    console.log("Categories and Channels:");
    const categories = channels.filter(c => c.type === 4); // Category
    for (const [id, cat] of categories) {
        console.log(`\nCategory: ${cat.name} (${cat.id})`);
        const children = channels.filter(c => c.parentId === cat.id);
        for (const [cid, child] of children) {
            console.log(`  - ${child.name} (${child.id})`);
        }
    }
    
    // Also list channels without category
    console.log(`\nNo Category:`);
    const orphans = channels.filter(c => !c.parentId && c.type !== 4);
    for (const [cid, child] of orphans) {
        console.log(`  - ${child.name} (${child.id})`);
    }

    client.destroy();
});

client.login(process.env.DISCORD_TOKEN);
