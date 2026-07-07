// register-commands.js
// Run once: node register-commands.js
// This registers slash commands globally (or guild-only for instant updates)

require('dotenv').config({ path: '.env.local' });
const { commands } = require('./src/commands/index.js');

const APPLICATION_ID = process.env.DISCORD_APPLICATION_ID;
const DISCORD_TOKEN   = process.env.DISCORD_TOKEN;
const GUILD_ID        = process.env.GUILD_ID; // set this to register guild-only (instant)

if (!APPLICATION_ID || !DISCORD_TOKEN) {
  console.error('❌ Missing DISCORD_APPLICATION_ID or DISCORD_TOKEN in .env.local');
  process.exit(1);
}

async function registerCommands() {
  // Guild-scoped (instant, takes effect within seconds)
  const url = GUILD_ID
    ? `https://discord.com/api/v10/applications/${APPLICATION_ID}/guilds/${GUILD_ID}/commands`
    : `https://discord.com/api/v10/applications/${APPLICATION_ID}/commands`;

  console.log(`📡 Registering ${commands.length} commands to ${GUILD_ID ? `guild ${GUILD_ID}` : 'global'}...`);

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bot ${DISCORD_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('❌ Failed to register commands:', err);
    process.exit(1);
  }

  const data = await res.json();
  console.log('✅ Commands registered successfully!');
  data.forEach(cmd => console.log(` - /${cmd.name} (ID: ${cmd.id})`));
}

registerCommands();
