/**
 * Sync DISCORD_TOKEN from .env.local -> Cloudflare Worker secret (UTF-8 safe).
 * Also verifies the token against Discord API before upload.
 *
 * Usage: node scripts/sync_discord_token.js
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const envPath = path.join(__dirname, '..', '.env.local');

function readToken() {
  const raw = fs.readFileSync(envPath, 'utf8');
  const match = raw.match(/^\s*DISCORD_TOKEN\s*=\s*(.*)\s*$/m);
  if (!match) throw new Error('DISCORD_TOKEN not found in .env.local');
  let token = match[1].trim();
  if (
    (token.startsWith('"') && token.endsWith('"'))
    || (token.startsWith("'") && token.endsWith("'"))
  ) {
    token = token.slice(1, -1).trim();
  }
  token = token.replace(/^Bot\s+/i, '').trim();
  // strip accidental CR
  token = token.replace(/\r/g, '');
  if (!token) throw new Error('DISCORD_TOKEN empty');
  return token;
}

async function verifyToken(token) {
  const res = await fetch('https://discord.com/api/v10/users/@me', {
    headers: { Authorization: `Bot ${token}` },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Token verify failed HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = JSON.parse(text);
  return data;
}

function putSecret(token) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'npx',
      ['wrangler', 'secret', 'put', 'DISCORD_TOKEN'],
      {
        cwd: path.join(__dirname, '..'),
        shell: true,
        stdio: ['pipe', 'inherit', 'inherit'],
        env: process.env,
      }
    );
    child.stdin.setDefaultEncoding('utf8');
    child.stdin.write(token, 'utf8');
    child.stdin.end();
    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`wrangler secret put exited ${code}`));
    });
  });
}

(async () => {
  console.log('Reading .env.local ...');
  const token = readToken();
  console.log('Token length:', token.length, '| parts:', token.split('.').length);

  console.log('Verifying with Discord API ...');
  const me = await verifyToken(token);
  console.log('OK bot:', me.username, '| id:', me.id);

  console.log('Uploading DISCORD_TOKEN secret (utf8) ...');
  await putSecret(token);
  console.log('Done. Run: npm run deploy');
  console.log('Then test Visa button again.');
})().catch(err => {
  console.error('FAILED:', err.message || err);
  process.exit(1);
});
