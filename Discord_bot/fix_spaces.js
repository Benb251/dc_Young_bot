require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.once('ready', async () => {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    const channels = await guild.channels.fetch();

    const BRAILLE = '\u2800'; // Braille pattern blank - acts as a space and Discord ignores it
    
    const textChannels = channels.filter(c => c.type === 0);
    
    for (const [id, ch] of textChannels) {
        if (ch.name.includes('·') || ch.name.includes('▌')) {
            let newName = ch.name;
            // Replace all "-·-▌-" with " BRAILLE · BRAILLE ▌ BRAILLE "
            newName = newName.replace(/-·-▌-/g, `${BRAILLE}·${BRAILLE}▌${BRAILLE}`);
            newName = newName.replace(/-·-/g, `${BRAILLE}·${BRAILLE}`);
            newName = newName.replace(/·-▌-/g, `·${BRAILLE}▌${BRAILLE}`);
            newName = newName.replace(/-▌-/g, `${BRAILLE}▌${BRAILLE}`);
            
            if (ch.name !== newName) {
                console.log(`Fixing ${ch.name} -> ${newName}`);
                try {
                    await ch.setName(newName);
                } catch (e) {
                    console.error(`Failed to rename ${ch.name}`, e);
                }
            }
        }
    }

    console.log('Finished fixing with Braille spaces!');
    client.destroy();
});

client.login(process.env.DISCORD_TOKEN);
