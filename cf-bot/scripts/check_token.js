/* Safe token diagnostics — never prints the token value */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', 'Discord_bot', '.env') });

async function check(label, raw) {
  let token = String(raw || '').trim();
  if ((token.startsWith('"') && token.endsWith('"')) || (token.startsWith("'") && token.endsWith("'"))) {
    token = token.slice(1, -1).trim();
  }
  token = token.replace(/^Bot\s+/i, '').trim();

  console.log(`\n[${label}]`);
  console.log('  length:', token.length);
  console.log('  parts:', token ? token.split('.').length : 0);
  console.log('  empty:', !token);

  if (!token) {
    console.log('  result: MISSING');
    return;
  }

  try {
    const res = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bot ${token}` },
    });
    const text = await res.text();
    console.log('  http:', res.status);
    if (res.ok) {
      const j = JSON.parse(text);
      console.log('  bot username:', j.username);
      console.log('  bot id:', j.id);
      console.log('  result: OK');
    } else {
      console.log('  body:', text.slice(0, 160));
      console.log('  result: FAIL (token rejected by Discord)');
    }
  } catch (e) {
    console.log('  error:', e.message);
    console.log('  result: ERROR');
  }
}

(async () => {
  // Only from env names we control — dotenv loads last file overwriting if both set
  // Load each file explicitly:
  const fs = require('fs');
  const path = require('path');

  function readEnvFile(filePath) {
    const out = {};
    if (!fs.existsSync(filePath)) return out;
    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      out[m[1]] = v;
    }
    return out;
  }

  const cf = readEnvFile(path.join(__dirname, '..', '.env.local'));
  const gw = readEnvFile(path.join(__dirname, '..', '..', 'Discord_bot', '.env'));

  await check('cf-bot .env.local DISCORD_TOKEN', cf.DISCORD_TOKEN);
  await check('Discord_bot .env DISCORD_TOKEN', gw.DISCORD_TOKEN);
  console.log('\nDone. If both FAIL, reset token in Developer Portal.');
})();
