require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const GUILD_ID = process.env.GUILD_ID;

// === ĐỊNH NGHĨA ROLE ===
// Color: mã hex dưới dạng number (Discord.js)
const COLORS = {
  'Đỏ đậm': 0x8B0000,
  'Cam': 0xFF8C00,
  'Xám nhạt': 0xB0B0B0,
  'Xanh nhạt': 0x66BB6A,
  'Xanh dương': 0x4285F4,
  'Tím': 0x9C27B0,
  'Vàng / Cam đậm': 0xFFA000,
};

const ROLES = [
  // ===== STAFF =====
  { name: '👑 Bố già đầu hẻm', color: COLORS['Đỏ đậm'], reason: 'Admin chính - Staff' },
  { name: '🛡️ Ban quản viewport', color: COLORS['Cam'], reason: 'Moderator - Staff' },

  // ===== CẤP BẬC =====
  { name: '🌱 Thực tập xin', color: COLORS['Xám nhạt'], reason: 'Mới tham gia - Cấp bậc' },
  { name: '📖 Học vẹt', color: COLORS['Xanh nhạt'], reason: 'Đang học và thực hành - Cấp bậc' },
  { name: '🏠 Cư dân', color: COLORS['Xanh dương'], reason: 'Đã ổn định, tham gia đều - Cấp bậc' },
  { name: '🔧 Tay có nghề', color: COLORS['Tím'], reason: 'Có kỹ năng khá, hay hỗ trợ - Cấp bậc' },
  { name: '🏆 Ông trùm render', color: COLORS['Vàng / Cam đậm'], reason: 'Kỹ năng cao, có phong cách riêng - Cấp bậc' },

  // ===== CHUYÊN MÔN =====
  { name: '🎭 Nặn mặt', color: 0x99AAB5, reason: 'Làm nhân vật, organic - Chuyên môn' },
  { name: '🧱 Dựng block', color: 0x99AAB5, reason: 'Làm hard surface, props - Chuyên môn' },
  { name: '🎨 Sơn shader', color: 0x99AAB5, reason: 'Làm texture, material - Chuyên môn' },
  { name: '🎮 Bày game', color: 0x99AAB5, reason: 'Làm asset cho game - Chuyên môn' },
  { name: '🐛 Vá bug', color: 0x99AAB5, reason: 'Hỗ trợ kỹ thuật, fix lỗi - Chuyên môn' },

  // ===== MOOD =====
  { name: '🏗️ WIP đầy nhà', color: 0x808080, reason: 'Hay để dở nhiều việc - Mood' },
  { name: '⏳ Render chưa về', color: 0x808080, reason: 'Hay than render lâu / lỗi - Mood' },
  { name: '💀 Deadline dí', color: 0x808080, reason: 'Hay làm gấp, hay than deadline - Mood' },
];

client.once('ready', async () => {
  console.log(`✅ Đã đăng nhập với bot: ${client.user.tag}`);

  try {
    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) {
      console.error(`❌ Không tìm thấy Guild với ID: ${GUILD_ID}`);
      client.guilds.cache.forEach(g => console.log(`   - ${g.name} (ID: ${g.id})`));
      process.exit(1);
    }

    console.log(`📍 Server: ${guild.name}`);
    console.log('---');

    let created = 0;
    let skipped = 0;

    for (const roleDef of ROLES) {
      // Kiểm tra role đã tồn tại chưa
      const existing = guild.roles.cache.find(r => r.name === roleDef.name);
      if (existing) {
        console.log(`⏭️  Role đã tồn tại: ${roleDef.name} (ID: ${existing.id})`);
        skipped++;
        continue;
      }

      const role = await guild.roles.create({
        name: roleDef.name,
        color: roleDef.color,
        reason: roleDef.reason,
      });

      console.log(`✅ Đã tạo: ${roleDef.name}  |  Màu: ${role.color.toString(16).toUpperCase()}  |  ID: ${role.id}`);
      created++;
    }

    console.log('---');
    console.log(`🎉 HOÀN THÀNH!`);
    console.log(`📊 Tổng kết: ${created} role đã tạo, ${skipped} role đã tồn tại (bỏ qua)`);

    // Hiển thị danh sách role theo nhóm
    console.log('');
    console.log('📋 DANH SÁCH ROLE HIỆN TẠI:');
    const allRoles = guild.roles.cache.sort((a, b) => b.position - a.position);
    allRoles.forEach(role => {
      if (role.name === '@everyone') return;
      const colorHex = role.color ? `#${role.color.toString(16).toUpperCase().padStart(6, '0')}` : 'Không màu';
      console.log(`   ${role.name} — ${colorHex} (ID: ${role.id})`);
    });

  } catch (error) {
    console.error('❌ Lỗi:', error.message);
  }

  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
