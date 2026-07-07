require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.once('ready', async () => {
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    await guild.channels.fetch();
    
    // Find the channel
    const channel = guild.channels.cache.find(c => c.name.includes('chọn・vai・trò') || c.name.includes('chọn-vai-trò'));
    
    if (channel) {
        console.log(`Found channel: ${channel.name}. Sending embed...`);
        
        const embed = new EmbedBuilder()
            .setColor('#2b2d31')
            .setTitle('BẠN ĐANG SỬ DỤNG PHẦN MỀM NÀO?')
            .setDescription('Chào mừng đến với **Tổ Young Phố**! 🏡\n\nĐể giúp server luôn gọn gàng và phù hợp nhất với nhu cầu của bạn, hãy chọn các phần mềm/chuyên môn mà bạn đang sử dụng.\n\n👉 Bấm vào các **Reaction tương ứng** ở dưới tin nhắn này. Bạn có thể chọn bao nhiêu tùy thích.\nNgay sau khi chọn, một góc riêng chuyên sâu dành cho phần mềm đó sẽ tự động mở ra ở thanh danh mục bên trái!\n\n<:Blender_logo_no_textsvg:1522897564255654000> **Blender**\n<:autodeskmayalogopng_seeklogo4824:1522898226557091840> **Maya / 3ds Max**\n<:NicePng_zbrushlogopng_2091028:1522898595311779840> **ZBrush**\n<:71288substancepainter:1522900833098928138> **Substance Painter**\n<:958995designpalette:1522900876245602324> **2D Design** (Concept/Graphic)\n📚 **Beginner** (Góc dành cho người mới)');

        try {
            await channel.bulkDelete(50).catch(() => {}); // cleanup
            const msg = await channel.send({ embeds: [embed] });
            console.log(`Embed sent! Message ID: ${msg.id}`);
        } catch (error) {
            console.error('Failed to send:', error);
        }
    } else {
        console.log('Channel not found!');
    }
    
    client.destroy();
});

client.login(process.env.DISCORD_TOKEN);
