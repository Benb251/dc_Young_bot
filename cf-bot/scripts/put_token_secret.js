/**
 * Pipe DISCORD_TOKEN from .env.local into wrangler secret put.
 * Usage: node scripts/put_token_secret.js | npx wrangler secret put DISCORD_TOKEN
 */
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const raw = fs.readFileSync(envPath, 'utf8');
const match = raw.match(/^\s*DISCORD_TOKEN\s*=\s*(.*)\s*$/m);
if (!match) {
  console.error('DISCORD_TOKEN not found in .env.local');
  process.exit(1);
}
let token = match[1].trim();
if (
  (token.startsWith('"') && token.endsWith('"'))
  || (token.startsWith("'") && token.endsWith("'"))
) {
  token = token.slice(1, -1).trim();
}
token = token.replace(/^Bot\s+/i, '').trim();
if (!token) {
  console.error('DISCORD_TOKEN empty');
  process.exit(1);
}
process.stdout.write(token);
