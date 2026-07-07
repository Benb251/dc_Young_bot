require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.once('ready', async () => {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    const channels = await guild.channels.fetch();
    
    const updates = [
        { id: '1522664673185628324', newName: '👋 · ▌ chào-mừng' },
        { id: '1522697899945885937', newName: '📢 · ▌ announcements' },
        { id: '1522664690327752854', newName: '🔄 · ▌ workflow' }
    ];

    for (const update of updates) {
        const ch = channels.get(update.id);
        if (ch) {
            console.log(`Renaming ${ch.name} to ${update.newName}`);
            await ch.setName(update.newName);
        }
    }
    
    // Also rules is currently outside category, let's put it back to Onboarding just in case
    const rules = channels.get('1522814924076613813');
    const onboardingCat = channels.find(c => c.type === 4 && c.name === '┌─ | Onboarding');
    if (rules && onboardingCat && rules.parentId !== onboardingCat.id) {
        console.log(`Moving rules back to Onboarding`);
        await rules.setParent(onboardingCat.id);
        await rules.lockPermissions();
    }

    client.destroy();
});

client.login(process.env.DISCORD_TOKEN);
