# dc_Young_bot

**Discord Bot cho Tổ Young Phố** – Hệ thống quản lý server tự động với Cloudflare Workers + Dashboard React hiện đại.

> Repo: `dc_Young_bot` | Tên package bot: `quan-hem-bot`

---

## 🚀 Giới thiệu

`dc_Young_bot` là hệ thống Discord Bot chuyên biệt dành cho server **Tổ Young Phố**. 

Dự án kết hợp:
- Bot chạy trên **Cloudflare Workers** (serverless, nhanh, miễn phí)
- Bộ script quản trị server Discord mạnh mẽ
- Dashboard web React để quản lý dễ dàng

Mục tiêu: Tự động hóa việc phân quyền, onboarding thành viên và quản lý server cho cộng đồng sáng tạo / 3D / Thiết kế.

---

## ✨ Tính năng chính

### 1. Bot Discord (cf-bot)
- **Tự gán vai trò** qua button (Blender, Maya, ZBrush, Substance Painter, 2D, Beginner)
- **Hệ thống Visa / Onboarding** (nút "Lấy Visa" → role Cư dân)
- Welcome message + GIF động ngẫu nhiên
- Slash commands và Button Interactions
- Xử lý Rules, Reaction Roles
- API riêng cho Dashboard

### 2. Bộ công cụ quản trị (Discord_bot/)
- Hàng chục script tiện ích:
  - `setup_roles.js`, `setup_channels.js`, `setup_reaction_roles.js`
  - `fix_perms.js`, `fix_duplicates.js`, `audit.js`
  - `convert_forums.js`, `restructure.js`, `scan_old_threads.js`...
- Dùng để setup và bảo trì server nhanh chóng

### 3. Dashboard Web (dashboard/)
- Giao diện React + Vite hiện đại
- Quản lý cài đặt bot
- Quản lý GIF chào mừng
- Thống kê (Stats Panel)
- Dễ dàng triển khai và theo dõi

---

## 📡 Công nghệ sử dụng

| Phần          | Công nghệ                          |
|----------------|-----------------------------------------|
| Bot chính     | Cloudflare Workers + discord-interactions |
| Dashboard      | React 18 + Vite + Tailwind              |
| Script quản trị | Node.js                                 |
| Triển khai    | Wrangler (CF)                           |

---

## 📁 Cấu trúc dự án

```
dc_Young_bot/
├── cf-bot/                 # Bot chính (Cloudflare Workers)
│   ├── src/
│   │   ├── index.js          # Entry point
│   │   ├── config.js         # Roles, Channels, Emojis, GIFs
│   │   ├── commands/         # Slash commands
│   │   └── handlers/         # buttonRoles, welcome, rules
│   ├── package.json
│   └── wrangler.toml
├── Discord_bot/            # Bộ script quản trị server
│   ├── bot_gateway.js
│   ├── setup_*.js, fix_*.js, check_*.js...
│   ├── ai_helper.js, audit.js...
│   └── package.json
├── dashboard/              # Giao diện web quản trị
│   ├── src/components/     # BotSettings, GifManager, StatsPanel...
│   └── package.json
├── Run_Dashboard.bat
├── run_all_services.bat
└── README.md
```

---

## 🚀 Cách triển khai

### 1. Triển khai Bot (cf-bot)

```bash
cd cf-bot
npm install

# Chạy local
wrangler dev

# Deploy lên Cloudflare
wrangler deploy

# Đăng ký slash commands
npm run register
```

> **Lưu ý**: Cần cấu hình `DISCORD_PUBLIC_KEY`, `DISCORD_TOKEN`, và các ID trong `src/config.js` (hoặc dùng `.env`).

### 2. Chạy Dashboard

```bash
cd dashboard
npm install
npm run dev
```

Mở trình duyệt tại `http://localhost:5173`

### 3. Chạy các script quản trị

Sử dụng các file `.bat` hoặc chạy trực tiếp Node.js:

```bash
node Discord_bot/setup_roles.js
node Discord_bot/audit.js
```

---

## 🔧 Cấu hình

- Tất cả ID server, role, channel được hardcode trong `cf-bot/src/config.js`
- Nên di chuyển sang `.env` khi triển khai production
- GIF chào mừng có thể quản lý qua Dashboard

---

## 📈 Trạng thái dự án
- **Phiên bản**: 1.0.0
- **Trạng thái**: Đang phát triển tích cực
- **Cập nhật cuối**: 08/07/2026

---

## 👋 Đóng góp

Mọi đóng góp đều được chào đón! 
Hãy tạo Issue hoặc Pull Request nếu bạn muốn thêm tính năng mới hoặc cải thiện code.

---

## © License

Dự án này được phát triển cho cộng đồng Tổ Young Phố. 
Bạn có thể tự do sử dụng và phát triển tiếp.

---

**Made with ❤️ by Benb251**