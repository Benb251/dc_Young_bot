import { ROLES, GUILD_ID, DISCORD_API, WELCOME_GIFS, CHANNELS } from './config.js';

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
    const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages/${messageId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bot ${env.DISCORD_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Discord API Error (${res.status}): ${errText}`);
    }
  }
}

export async function handleApiRequest(request, env) {
  const url = new URL(request.url);

  // Thêm CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': env.DASHBOARD_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Dashboard-Key',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (data, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  // Xác thực API Key (Secret)
  const authHeader = request.headers.get('X-Dashboard-Key');
  if (authHeader !== env.DASHBOARD_SECRET) {
    return json({ error: 'Unauthorized' }, 401);
  }

  // ── GET /api/channels ────────────────────────────────────────────
  if (request.method === 'GET' && url.pathname === '/api/channels') {
    try {
      const res = await fetch(
        `${DISCORD_API}/guilds/${GUILD_ID}/channels`,
        { headers: { Authorization: `Bot ${env.DISCORD_TOKEN}` } }
      );
      if (!res.ok) {
        throw new Error(`Failed to fetch channels from Discord: ${res.status}`);
      }
      const data = await res.json();
      
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
    const gifsStr = await env.BOT_CONFIG.get('WELCOME_GIFS');
    const gifs = gifsStr ? JSON.parse(gifsStr) : WELCOME_GIFS;
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
    const configStr = await env.BOT_CONFIG.get('BOT_CONFIG');
    const defaults = {
      welcomeTitle: '🎉 Chào mừng đến với Tổ Young Phố!',
      welcomeDescription: `Chào mừng <@{userId}> đến với nơi những đứa trẻ phố phường chia sẻ và phát triển kỹ năng **3D Game Art & Design**.\n\n**Để bắt đầu:**\n• Đọc <#${'{rulesChannel}'}> để hiểu quy tắc\n• Đến <#${'{rolesChannel}'}> để chọn vai trò\n\nChúc bạn có những trải nghiệm vui vẻ! 🔥\nBạn là thành viên thứ **{memberCount}** của Tổ Young Phố!`,
      welcomeColor: '#00B0F4',
      visaTitle: '🏡 Chào mừng đến với Tổ Young Phố!',
      visaDescription: `Bạn đang đứng trước cổng **Tổ Young Phố** — cộng đồng chia sẻ, học hỏi và cháy hết mình với đam mê 3D, Game & 2D Design!\n\n**Trước khi vào Phố, hãy nhận Visa của bạn** ⬇️`,
      visaButtonLabel: 'Nhận Visa vào Phố 🏡',
      rolePanelThumbnail: 'https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExcnJvZ2IzcnhzMjdjcHlxODVkMWZxbDdheWs1cjViMzE1OWluamRlaiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/j91j9wdUh3rm8/giphy.gif',
      rulesTitle: '📜 NỘI QUY TỔ YOUNG PHỐ',
      rulesDescription: 'Chào mừng anh em đến với **Tổ Young Phố** - Cộng đồng chia sẻ, học hỏi và cháy hết mình với đam mê 3D, Game & 2D Design! Để giữ cho "khu phố" luôn văn minh và ngăn nắp, anh em vui lòng tuân thủ các quy tắc dưới đây nhé:\n\n1️⃣ **Tôn trọng lẫn nhau**\nKhông chửi bới, công kích cá nhân, phân biệt vùng miền hay sử dụng ngôn từ thù ghét. Mọi đóng góp và nhận xét (đặc biệt trong phần khoe tác phẩm) đều phải mang tính chất xây dựng.\n\n2️⃣ **Đúng kênh, đúng chỗ**\nServer đã được chia theo từng phần mềm (Blender, Maya, ZBrush...). Hãy chat và đặt câu hỏi ở đúng danh mục tương ứng để được hỗ trợ tốt nhất.\n\n3️⃣ **Sử dụng Diễn đàn (Forum) hiệu quả**\nVới các kênh Hỏi - Đáp hoặc Khoe Work, hãy tạo **Post mới** thay vì chat tràn lan. Nhớ đặt tiêu đề rõ ràng để mọi người dễ dàng tìm kiếm và hỗ trợ.\n\n4️⃣ **Không Spam & Quảng cáo**\nCấm spam tin nhắn, gửi link độc hại, nội dung NSFW (18+), hoặc tự ý quảng cáo/mua bán khi chưa có sự cho phép của Ban Quản Đốc.\n\n5️⃣ **Tinh thần chia sẻ**\nKhông giấu nghề! Nếu bạn biết, hãy giúp đỡ những người mới. Cộng đồng phát triển thì mỗi cá nhân mới có thể tiến xa.\n\n*Cảm ơn bạn đã trở thành một phần của Tổ Young Phố!* 🖤',
      rulesColor: '#2b2d31',
      visaChannelId: '',
      visaMessageId: '',
      rolesChannelId: '',
      rolesMessageId: '',
      rulesChannelId: '',
      rulesMessageId: '',
    };
    const config = configStr ? { ...defaults, ...JSON.parse(configStr) } : defaults;
    return json(config);
  }

  // ── POST /api/bot-config ─────────────────────────────────────────
  if (request.method === 'POST' && url.pathname === '/api/bot-config') {
    try {
      const body = await request.json();
      // Lấy config cũ để merge
      const oldStr = await env.BOT_CONFIG.get('BOT_CONFIG');
      const old = oldStr ? JSON.parse(oldStr) : {};
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
      const guildRes = await fetch(
        `${DISCORD_API}/guilds/${GUILD_ID}?with_counts=true`,
        { headers: { Authorization: `Bot ${env.DISCORD_TOKEN}` } }
      );
      const guildData = await guildRes.json();
      const totalMembers = guildData.approximate_member_count ?? guildData.member_count ?? 0;

      // Lấy danh sách roles từ guild để có member_count của từng role
      const rolesRes = await fetch(
        `${DISCORD_API}/guilds/${GUILD_ID}/roles`,
        { headers: { Authorization: `Bot ${env.DISCORD_TOKEN}` } }
      );
      const rolesData = await rolesRes.json();

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
