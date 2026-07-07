require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.once('ready', async () => {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    await guild.channels.fetch();
    
    // Find the rules channel
    const rulesChannel = guild.channels.cache.find(c => c.name.includes('rules'));
    
    if (rulesChannel) {
        console.log(`Found rules channel: ${rulesChannel.name}. Sending embed...`);
        
        const embed = new EmbedBuilder()
            .setColor('#2b2d31') // Discord dark theme color to blend in
            .setDescription('# <a:786449readrules:1523574389583642654> NỘI QUY TỔ YOUNG PHỐ <a:786449readrules:1523574389583642654>\n\nChào mừng anh em đến với **Tổ Young Phố** - Cộng đồng chia sẻ, học hỏi và cháy hết mình với đam mê 3D, Game & 2D Design! Để giữ cho "khu phố" luôn văn minh và ngăn nắp, anh em vui lòng tuân thủ các quy tắc dưới đây nhé:')
            .addFields(
                { name: '<:62797minecraftblue1:1523577779361288223> Tôn trọng lẫn nhau', value: 'Không chửi bới, công kích cá nhân, phân biệt vùng miền hay sử dụng ngôn từ thù ghét. Mọi đóng góp và nhận xét (đặc biệt trong phần khoe tác phẩm) đều phải mang tính chất xây dựng.' },
                { name: '<:43507minecraftblue2:1523577820977303654> Đúng kênh, đúng chỗ', value: 'Server đã được chia theo từng phần mềm (Blender, Maya, ZBrush...). Hãy chat và đặt câu hỏi ở đúng danh mục tương ứng để được hỗ trợ tốt nhất.' },
                { name: '<:74240minecraftblue3:1523577850223923261> Sử dụng Diễn đàn (Forum) hiệu quả', value: 'Với các kênh Hỏi - Đáp hoặc Khoe Work, hãy tạo **Post mới** thay vì chat tràn lan. Nhớ đặt tiêu đề rõ ràng để mọi người dễ dàng tìm kiếm và hỗ trợ.' },
                { name: '<:4352minecraftblue4:1523577873548443648> Không Spam & Quảng cáo', value: 'Cấm spam tin nhắn, gửi link độc hại, nội dung NSFW (18+), hoặc tự ý quảng cáo/mua bán khi chưa có sự cho phép của Ban Quản Đốc.' },
                { name: '<:1341minecraftblue5:1523577896470450176> Tinh thần chia sẻ', value: 'Không giấu nghề! Nếu bạn biết, hãy giúp đỡ những người mới. Cộng đồng phát triển thì mỗi cá nhân mới có thể tiến xa.' }
            )
            .setFooter({ text: 'Cảm ơn bạn đã trở thành một phần của Tổ Young Phố! 🖤' })
            .setTimestamp();

        try {
            // Bulk delete previous messages if any (up to 100) to keep it clean
            await rulesChannel.bulkDelete(100).catch(console.error);
            
            // Create the Visa Button component
            const visaButton = new ButtonBuilder()
                .setCustomId('get_visa')
                .setLabel('Đồng ý & Nhận Visa vào Phố 🏡')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🎟️');

            const row = new ActionRowBuilder().addComponents(visaButton);
            
            // Send new embed with the button component
            await rulesChannel.send({ embeds: [embed], components: [row] });
            console.log('Rules embed and Visa button sent successfully!');
        } catch (error) {
            console.error('Failed to send rules:', error);
        }
    } else {
        console.log('Rules channel not found!');
    }
    
    client.destroy();
});

client.login(process.env.DISCORD_TOKEN);
