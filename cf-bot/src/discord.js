import { DISCORD_API } from './config.js';

/**
 * Normalize bot token from env/secrets.
 * - trim whitespace/newlines (common when pasting into wrangler secret)
 * - strip accidental "Bot " prefix so we never send "Bot Bot xxx"
 */
export function normalizeBotToken(raw) {
  let token = String(raw || '').trim();
  // Remove wrapping quotes from secret paste
  if (
    (token.startsWith('"') && token.endsWith('"'))
    || (token.startsWith("'") && token.endsWith("'"))
  ) {
    token = token.slice(1, -1).trim();
  }
  token = token.replace(/^Bot\s+/i, '').trim();
  return token;
}

export async function discordRequest(env, path, init = {}) {
  const token = normalizeBotToken(env.DISCORD_TOKEN);
  if (!token) {
    throw new Error(
      'DISCORD_TOKEN missing/empty on Worker. Run: npx wrangler secret put DISCORD_TOKEN'
    );
  }

  const headers = {
    Authorization: `Bot ${token}`,
    'Content-Type': 'application/json',
    ...init.headers,
  };

  const response = await fetch(`${DISCORD_API}${path}`, { ...init, headers });
  if (!response.ok) {
    const body = await response.text();
    if (response.status === 401) {
      throw new Error(
        `Discord API 401 Unauthorized — token Worker sai/hết hạn/không thuộc bot này. `
        + `Sửa: cd cf-bot && npx wrangler secret put DISCORD_TOKEN (dán Bot Token mới từ Developer Portal), rồi npm run deploy. `
        + `Chi tiết API: ${body}`
      );
    }
    throw new Error(`Discord API Error (${response.status}): ${body}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

export async function sendDiscordMessage(env, channelId, payload) {
  return discordRequest(env, `/channels/${channelId}/messages`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateDiscordMessage(env, channelId, messageId, payload) {
  return discordRequest(env, `/channels/${channelId}/messages/${messageId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}
