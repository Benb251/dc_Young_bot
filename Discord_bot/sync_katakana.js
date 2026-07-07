require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.once('ready', async () => {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    const channels = await guild.channels.fetch();
    
    // Process ALL channels except categories
    const targetChannels = channels.filter(c => c.type !== 4);
    const KATA = '・'; // U+30FB
    
    for (const [id, ch] of targetChannels) {
        let newName = ch.name;
        
        // Remove surrounding dashes from dot and pipe
        newName = newName.replace(/-·-/g, '·').replace(/·-/g, '·').replace(/-·/g, '·');
        newName = newName.replace(/-▌-/g, '▌').replace(/▌-/g, '▌').replace(/-▌/g, '▌');
        
        // Replace middle dot with katakana dot
        newName = newName.replace(/·/g, KATA);
        newName = newName.replace(/✦/g, KATA);
        
        // Replace hyphens with katakana dot
        newName = newName.replace(/-/g, KATA);
        
        if (ch.name !== newName) {
            console.log(`Renaming ${ch.name} to ${newName}`);
            try {
                await ch.setName(newName);
            } catch(e) {
                console.log(`Failed for ${ch.name}: ${e.message}`);
            }
        }
    }
    
    console.log("Finished syncing Katakana middle dot.");
    client.destroy();
});

client.login(process.env.DISCORD_TOKEN);
