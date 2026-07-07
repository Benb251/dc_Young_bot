import { DISCORD_API } from './config.js';

export async function discordRequest(env, path, init = {}) {
  const headers = {
    Authorization: `Bot ${env.DISCORD_TOKEN}`,
    'Content-Type': 'application/json',
    ...init.headers,
  };

  const response = await fetch(`${DISCORD_API}${path}`, { ...init, headers });
  if (!response.ok) {
    const body = await response.text();
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
