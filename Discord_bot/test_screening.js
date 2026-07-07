require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once('ready', async () => {
  const guild = client.guilds.cache.get(process.env.GUILD_ID);
  if (!guild) {
    console.error('Guild not found');
    process.exit(1);
  }
  
  try {
    // Check if membership screening manager exists
    console.log('Features:', guild.features);
    
    // In discord.js v14, we can use guild.edit() or guild.features
    // Actually, Discord doesn't have a direct wrapper for membership screening in the stable DJS v14.
    // Let's check the API direct call
    const screening = await guild.client.rest.get(`/guilds/${guild.id}/member-verification`);
    console.log('Current screening:', screening);
  } catch (e) {
    console.error('Error fetching screening (it might not be enabled yet or requires Community enabled):', e.message);
  }
  
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
