import { ROLES, GUILD_ID, CHANNELS } from './config.js';
import { discordRequest, normalizeBotToken, updateDiscordMessage } from './discord.js';
import { getBotConfig, getWelcomeGifs } from './storage.js';

async function updateDiscordPanel(type, env, mergedConfig) {
  let channelId = '';
  let messageId = '';
  let payload = null;

  if (type === 'visa') {
    channelId = mergedConfig.visaChannelId || CHANNELS.START;
    messageId = mergedConfig.visaMessageId;
    if (messageId) {
      const { buildWelcomePanel } = await import('./handlers/welcome.js');
      payload = await buildWelcomePanel(env);
    }
  } else if (type === 'roles') {
    channelId = mergedConfig.rolesChannelId || CHANNELS.ROLES;
    messageId = mergedConfig.rolesMessageId;
    if (messageId) {
      const { buildRolesPanel } = await import('./handlers/buttonRoles.js');
      payload = await buildRolesPanel(env);
    }
  } else if (type === 'rules') {
    channelId = mergedConfig.rulesChannelId || CHANNELS.RULES;
    messageId = mergedConfig.rulesMessageId;
    if (messageId) {
      const { buildRulesPanel } = await import('./handlers/rules.js');
      payload = await buildRulesPanel(env);
    }
  }

  if (payload && channelId && messageId) {
    await updateDiscordMessage(env, channelId, messageId, payload);
  }
}

export async function handleApiRequest(request, env) {
  const url = new URL(request.url);
  const requestOrigin = request.headers.get('Origin');
  const allowedOrigin = env.DASHBOARD_ORIGIN || requestOrigin || '*';

  // Thêm CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Dashboard-Key',
    'Vary': 'Origin',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (data, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  // Public health: does Worker DISCORD_TOKEN work? (no secret values returned)
  if (request.method === 'GET' && url.pathname === '/api/discord-health') {
    const token = normalizeBotToken(env.DISCORD_TOKEN);
    if (!token) {
      return json({ ok: false, reason: 'DISCORD_TOKEN missing on Worker' }, 200);
    }
    try {
      const res = await fetch('https://discord.com/api/v10/users/@me', {
        headers: { Authorization: `Bot ${token}` },
      });
      if (!res.ok) {
        const body = await res.text();
        return json({
          ok: false,
          reason: 'token_rejected',
          http: res.status,
          hint: 'Re-run: node scripts/sync_discord_token.js && npm run deploy',
          detail: body.slice(0, 120),
        }, 200);
      }
      const me = await res.json();
      return json({
        ok: true,
        botUsername: me.username,
        botId: me.id,
        visaRoleId: ROLES.VISA,
        guildId: GUILD_ID,
      }, 200);
    } catch (e) {
      return json({ ok: false, reason: e.message || String(e) }, 200);
    }
  }

  // Xác thực API Key (Secret)
  const authHeader = request.headers.get('X-Dashboard-Key');
  if (!env.DASHBOARD_SECRET || authHeader !== env.DASHBOARD_SECRET) {
    return json({ error: 'Unauthorized' }, 401);
  }

  // ── GET /api/channels ────────────────────────────────────────────
  if (request.method === 'GET' && url.pathname === '/api/channels') {
    try {
      const data = await discordRequest(env, `/guilds/${GUILD_ID}/channels`);
      
      const channels = data.map(c => ({
        id: c.id,
        name: c.name,
        type: c.type,
        position: c.position,
        parentId: c.parent_id
      }));
      return json(channels);
    } catch (e) {
      console.error('Channels error:', e);
      return json({ error: 'Failed to fetch channels' }, 500);
    }
  }

  // ── GET /api/config ─────────────────────────────────────────────
  if (request.method === 'GET' && url.pathname === '/api/config') {
    const gifs = await getWelcomeGifs(env);
    return json({ gifs });
  }

  // ── POST /api/config ─────────────────────────────────────────────
  if (request.method === 'POST' && url.pathname === '/api/config') {
    try {
      const body = await request.json();
      if (body.gifs && Array.isArray(body.gifs)) {
        await env.BOT_CONFIG.put('WELCOME_GIFS', JSON.stringify(body.gifs));
        return json({ success: true });
      }
    } catch (e) {
      return json({ error: 'Invalid body' }, 400);
    }
  }

  // ── GET /api/bot-config ──────────────────────────────────────────
  if (request.method === 'GET' && url.pathname === '/api/bot-config') {
    return json(await getBotConfig(env));
  }

  // ── POST /api/bot-config ─────────────────────────────────────────
  if (request.method === 'POST' && url.pathname === '/api/bot-config') {
    try {
      const body = await request.json();
      // Lấy config cũ để merge
      const old = await getBotConfig(env);
      const merged = { ...old, ...body };
      await env.BOT_CONFIG.put('BOT_CONFIG', JSON.stringify(merged));

      // Tự động đồng bộ lên Discord nếu có MessageID
      let syncError = null;
      try {
        if ('rulesTitle' in body || 'rulesDescription' in body || 'rulesColor' in body || 'rulesChannelId' in body || 'rulesMessageId' in body) {
          await updateDiscordPanel('rules', env, merged);
        }
        if ('visaTitle' in body || 'visaDescription' in body || 'visaButtonLabel' in body || 'visaChannelId' in body || 'visaMessageId' in body) {
          await updateDiscordPanel('visa', env, merged);
        }
        if ('rolePanelThumbnail' in body || 'rolesChannelId' in body || 'rolesMessageId' in body) {
          await updateDiscordPanel('roles', env, merged);
        }
      } catch (err) {
        console.error('Failed to sync to Discord:', err);
        syncError = err.message;
      }

      return json({ success: true, syncError });
    } catch (e) {
      return json({ error: 'Invalid body' }, 400);
    }
  }

  // ── GET /api/stats ───────────────────────────────────────────────
  if (request.method === 'GET' && url.pathname === '/api/stats') {
    try {
      // Lấy thông tin guild (membercount tổng)
      const guildData = await discordRequest(env, `/guilds/${GUILD_ID}?with_counts=true`);
      const totalMembers = guildData.approximate_member_count ?? guildData.member_count ?? 0;

      // Lấy danh sách roles từ guild để có member_count của từng role
      const rolesData = await discordRequest(env, `/guilds/${GUILD_ID}/roles`);

      // Map role ID → member_count
      const roleCountMap = {};
      if (Array.isArray(rolesData)) {
        for (const r of rolesData) {
          roleCountMap[r.id] = r.member_count ?? null;
        }
      }

      const stats = {
        totalMembers,
        roles: {
          blender:   roleCountMap[ROLES.BLENDER]   ?? 0,
          maya:      roleCountMap[ROLES.MAYA]       ?? 0,
          zbrush:    roleCountMap[ROLES.ZBRUSH]     ?? 0,
          substance: roleCountMap[ROLES.SUBSTANCE]  ?? 0,
          twoD:      roleCountMap[ROLES.TWO_D]      ?? 0,
          beginner:  roleCountMap[ROLES.BEGINNER]   ?? 0,
          visa:      roleCountMap[ROLES.VISA]        ?? 0,
        },
      };

      return json(stats);
    } catch (e) {
      console.error('Stats error:', e);
      return json({ error: 'Failed to fetch stats' }, 500);
    }
  }

  return new Response('Not found', { status: 404, headers: corsHeaders });
}
