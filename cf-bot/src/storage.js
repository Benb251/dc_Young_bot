import { DEFAULT_BOT_CONFIG, DEFAULT_WELCOME_GIFS } from './defaults.js';

async function getJson(env, key, fallback) {
  try {
    const value = await env.BOT_CONFIG?.get(key);
    if (!value) return fallback;
    return JSON.parse(value);
  } catch (error) {
    console.error(`Failed to read ${key} from KV:`, error);
    return fallback;
  }
}

export async function getBotConfig(env) {
  const config = await getJson(env, 'BOT_CONFIG', {});
  return { ...DEFAULT_BOT_CONFIG, ...config };
}

export async function getWelcomeGifs(env) {
  const gifs = await getJson(env, 'WELCOME_GIFS', DEFAULT_WELCOME_GIFS);
  return Array.isArray(gifs) && gifs.length > 0 ? gifs : DEFAULT_WELCOME_GIFS;
}
