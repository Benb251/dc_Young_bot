import { CHANNELS, WELCOME_GIFS } from './config.js';

export const DEFAULT_ROLE_PANEL_THUMBNAIL =
  'https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExcnJvZ2IzcnhzMjdjcHlxODVkMWZxbDdheWs1cjViMzE1OWluamRlaiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/j91j9wdUh3rm8/giphy.gif';

export const DEFAULT_BOT_CONFIG = {
  welcomeTitle: '🎉 Chào mừng đến với Tổ Young Phố!',
  welcomeDescription: `Chào mừng <@{userId}> đến với nơi những đứa trẻ phố phường chia sẻ và phát triển kỹ năng **3D Game Art & Design**.\n\n**Để bắt đầu:**\n• Đọc <#{rulesChannel}> để hiểu quy tắc\n• Đến <#{rolesChannel}> để chọn vai trò\n\nChúc bạn có những trải nghiệm vui vẻ và học hỏi được nhiều thứ tại đây! 🔥\nBạn là thành viên thứ **{memberCount}** của Tổ Young Phố!`,
  welcomeColor: '#00B0F4',
  visaTitle: '🏡 Chào mừng đến với Tổ Young Phố!',
  visaDescription: `Bạn đang đứng trước cổng **Tổ Young Phố** - cộng đồng chia sẻ, học hỏi và cháy hết mình với đam mê 3D, Game & 2D Design!\n\n**Trước khi vào Phố, hãy nhận Visa của bạn** ⬇️`,
  visaButtonLabel: 'Nhận Visa vào Phố 🏡',
  rolePanelThumbnail: DEFAULT_ROLE_PANEL_THUMBNAIL,
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

export const DEFAULT_WELCOME_GIFS = WELCOME_GIFS;

export function formatWelcomeDescription(template, { userId, memberCount }) {
  return template
    .replace(/{userId}/g, userId)
    .replace(/{memberCount}/g, memberCount)
    .replace(/{rulesChannel}/g, CHANNELS.RULES)
    .replace(/{rolesChannel}/g, CHANNELS.ROLES);
}

export function parseEmbedColor(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().replace(/^#/, '');
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return fallback;
  return parseInt(normalized, 16);
}
