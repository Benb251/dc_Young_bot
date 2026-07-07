import { verifyKey } from 'discord-interactions';
import { BUTTON_IDS } from './config.js';
import { handleButtonRole } from './handlers/buttonRoles.js';
import { handleVisa } from './handlers/welcome.js';
import { handleSlashCommand } from './commands/index.js';
import { handleApiRequest } from './api.js';

// Discord Interaction Types
const InteractionType = {
  PING: 1,
  APPLICATION_COMMAND: 2,
  MESSAGE_COMPONENT: 3,
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Route for Dashboard API
    if (url.pathname.startsWith('/api/') || request.method === 'OPTIONS') {
      return handleApiRequest(request, env);
    }

    // Only handle POST requests for Discord Interactions
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }


    // Verify Discord signature (security requirement)
    const signature = request.headers.get('x-signature-ed25519');
    const timestamp  = request.headers.get('x-signature-timestamp');
    const body = await request.text();

    const isValid = await verifyKey(body, signature, timestamp, env.DISCORD_PUBLIC_KEY);
    if (!isValid) {
      return new Response('Bad request signature', { status: 401 });
    }

    const interaction = JSON.parse(body);

    // ── 1. Discord PING (endpoint verification) ──────────────
    if (interaction.type === InteractionType.PING) {
      return jsonResponse({ type: 1 });
    }

    // ── 2. Slash Commands ────────────────────────────────────
    if (interaction.type === InteractionType.APPLICATION_COMMAND) {
      const result = await handleSlashCommand(interaction, env);
      return jsonResponse(result);
    }

    // ── 3. Button Interactions ───────────────────────────────
    if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
      const buttonId = interaction.data.custom_id;

      // Welcome / Visa button
      if (buttonId === BUTTON_IDS.VISA_BTN) {
        const result = await handleVisa(interaction, env, ctx);
        return jsonResponse(result);
      }

      // Role buttons (blender, maya, zbrush, substance, 2d, beginner)
      const roleButtonIds = Object.values(BUTTON_IDS).filter(id => id !== BUTTON_IDS.VISA_BTN);
      if (roleButtonIds.includes(buttonId)) {
        const result = await handleButtonRole(interaction, env);
        if (result) return jsonResponse(result);
      }
    }

    return new Response('Unknown interaction', { status: 400 });
  },
};

function jsonResponse(data) {
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
}
