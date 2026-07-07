require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    const channels = await guild.channels.fetch();

    const IDEO = '　'; // Ideographic space U+3000, Discord won't convert to dash

    // We will extract the emoji and the text, and reformat it as: [Emoji] + IDEO + '·' + IDEO + '▌' + IDEO + [Text]
    
    const textAndVoice = channels.filter(c => c.type === 0 || c.type === 2);
    
    for (const [id, ch] of textAndVoice) {
        // Find if the channel has the dot or pipe
        if (ch.name.includes('·') || ch.name.includes('▌')) {
            // Usually the format right now is: 👋-·-▌-chào-mừng or similar
            // Let's use regex or split to extract parts
            // Let's just find the first emoji (usually the first character or two)
            // Actually, we can just replace all dashes that are adjacent to · and ▌
            
            let newName = ch.name;
            newName = newName.replace(/-·-▌-/g, `${IDEO}·${IDEO}▌${IDEO}`);
            newName = newName.replace(/-·-/g, `${IDEO}·${IDEO}`);
            newName = newName.replace(/·-▌-/g, `·${IDEO}▌${IDEO}`);
            newName = newName.replace(/-▌-/g, `${IDEO}▌${IDEO}`);
            
            // Also, some channels might not have had dashes if they were just ·▌ (e.g. if the original script didn't put spaces)
            // Wait, my previous script put `👋 · ▌ chào-mừng`. Discord turned this into `👋-·-▌-chào-mừng`.
            
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

    console.log('Finished fixing dashes!');
    client.destroy();
});

client.login(process.env.DISCORD_TOKEN);
