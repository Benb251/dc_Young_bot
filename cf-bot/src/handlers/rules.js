export async function buildRulesPanel(env) {
  let config = {};
  try {
    const configStr = await env.BOT_CONFIG.get('BOT_CONFIG');
    if (configStr) config = JSON.parse(configStr);
  } catch (e) {}

  const defaults = {
    rulesTitle: '📜 NỘI QUY TỔ YOUNG PHỐ',
    rulesDescription: 'Chào mừng anh em đến với **Tổ Young Phố** - Cộng đồng chia sẻ, học hỏi và cháy hết mình với đam mê 3D, Game & 2D Design! Để giữ cho "khu phố" luôn văn minh và ngăn nắp, anh em vui lòng tuân thủ các quy tắc dưới đây nhé:\n\n1️⃣ **Tôn trọng lẫn nhau**\nKhông chửi bới, công kích cá nhân, phân biệt vùng miền hay sử dụng ngôn từ thù ghét. Mọi đóng góp và nhận xét (đặc biệt trong phần khoe tác phẩm) đều phải mang tính chất xây dựng.\n\n2️⃣ **Đúng kênh, đúng chỗ**\nServer đã được chia theo từng phần mềm (Blender, Maya, ZBrush...). Hãy chat và đặt câu hỏi ở đúng danh mục tương ứng để được hỗ trợ tốt nhất.\n\n3️⃣ **Sử dụng Diễn đàn (Forum) hiệu quả**\nVới các kênh Hỏi - Đáp hoặc Khoe Work, hãy tạo **Post mới** thay vì chat tràn lan. Nhớ đặt tiêu đề rõ ràng để mọi người dễ dàng tìm kiếm và hỗ trợ.\n\n4️⃣ **Không Spam & Quảng cáo**\nCấm spam tin nhắn, gửi link độc hại, nội dung NSFW (18+), hoặc tự ý quảng cáo/mua bán khi chưa có sự cho phép của Ban Quản Đốc.\n\n5️⃣ **Tinh thần chia sẻ**\nKhông giấu nghề! Nếu bạn biết, hãy giúp đỡ những người mới. Cộng đồng phát triển thì mỗi cá nhân mới có thể tiến xa.\n\n*Cảm ơn bạn đã trở thành một phần của Tổ Young Phố!* 🖤',
    rulesColor: '#2b2d31',
  };

  const finalConfig = { ...defaults, ...config };

  let colorInt = 0x2b2d31;
  try {
    if (finalConfig.rulesColor) {
       colorInt = parseInt(finalConfig.rulesColor.replace('#', ''), 16);
    }
  } catch(e){}

  return {
    embeds: [{
      color: colorInt,
      title: finalConfig.rulesTitle,
      description: finalConfig.rulesDescription,
    }]
  };
}
