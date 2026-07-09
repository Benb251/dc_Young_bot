const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require('discord.js');

/**
 * Panel builders mirror cf-bot custom_ids so the same interaction handlers
 * can process clicks when the gateway bot is the application that sent them.
 * If interactions are handled by a separate Workers bot, buttons only work
 * when that bot also receives the component interaction (same application).
 */

const BUTTON_IDS = {
  ROLE_BLENDER: 'role_blender',
  ROLE_MAYA: 'role_maya',
  ROLE_ZBRUSH: 'role_zbrush',
  ROLE_SUBSTANCE: 'role_substance',
  ROLE_2D: 'role_2d',
  ROLE_BEGINNER: 'role_beginner',
  VISA_BTN: 'get_visa',
};

const ROLE_BUTTONS = [
  { id: BUTTON_IDS.ROLE_BLENDER, label: 'Blender', emoji: { id: '1522897564255654000', name: 'Blender_logo_no_textsvg' } },
  { id: BUTTON_IDS.ROLE_MAYA, label: 'Maya / Max', emoji: { id: '1522898226557091840', name: 'autodeskmayalogopng_seeklogo4824' } },
  { id: BUTTON_IDS.ROLE_ZBRUSH, label: 'ZBrush', emoji: { id: '1522898595311779840', name: 'NicePng_zbrushlogopng_2091028' } },
  { id: BUTTON_IDS.ROLE_SUBSTANCE, label: 'Substance', emoji: { id: '1522900833098928138', name: '71288substancepainter' } },
  { id: BUTTON_IDS.ROLE_2D, label: '2D Design', emoji: { id: '1522900876245602324', name: '958995designpalette' } },
  { id: BUTTON_IDS.ROLE_BEGINNER, label: 'Beginner', emoji: { name: '📚' } },
];

const DEFAULT_ROLE_MAP = {
  [BUTTON_IDS.ROLE_BLENDER]: process.env.ROLE_BLENDER_ID || '1522890537516929135',
  [BUTTON_IDS.ROLE_MAYA]: process.env.ROLE_MAYA_ID || '1522890539752624248',
  [BUTTON_IDS.ROLE_ZBRUSH]: process.env.ROLE_ZBRUSH_ID || '1522890542218739863',
  [BUTTON_IDS.ROLE_SUBSTANCE]: process.env.ROLE_SUBSTANCE_ID || '1522902597881827399',
  [BUTTON_IDS.ROLE_2D]: process.env.ROLE_2D_ID || '1522890546262048818',
  [BUTTON_IDS.ROLE_BEGINNER]: process.env.ROLE_BEGINNER_ID || '1522890548275445772',
};

const VISA_ROLE_ID = process.env.ASSISTANT_WELCOME_ROLE_ID || process.env.ROLE_VISA_ID || '1522665145103548538';

function buildRolesPanelPayload() {
  const embed = new EmbedBuilder()
    .setColor(0x2b2d31)
    .setTitle('BẠN ĐANG SỬ DỤNG PHẦN MỀM NÀO?')
    .setDescription(
      'Chào mừng đến với **Tổ Young Phố**! 🏡\n\n'
      + 'Hãy chọn phần mềm/chuyên môn bạn đang dùng. Bấm nút để nhận role, bấm lại để gỡ.'
    );

  const rows = [];
  for (let i = 0; i < ROLE_BUTTONS.length; i += 3) {
    const row = new ActionRowBuilder();
    for (const btn of ROLE_BUTTONS.slice(i, i + 3)) {
      const builder = new ButtonBuilder()
        .setCustomId(btn.id)
        .setLabel(btn.label)
        .setStyle(ButtonStyle.Secondary);
      if (btn.emoji) builder.setEmoji(btn.emoji);
      row.addComponents(builder);
    }
    rows.push(row);
  }

  return { embeds: [embed], components: rows };
}

function buildVisaPanelPayload() {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('Nhận Visa vào Phố')
    .setDescription(
      'Bấm nút bên dưới để nhận role **Cư dân** và mở các kênh cộng đồng.\n'
      + 'Đọc rules trước khi tham gia nhé.'
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(BUTTON_IDS.VISA_BTN)
      .setLabel('Lấy Visa')
      .setStyle(ButtonStyle.Success)
      .setEmoji('🚀')
  );

  return { embeds: [embed], components: [row] };
}

function buildRulesPanelPayload(args = {}) {
  const title = String(args.title || 'Nội quy Tổ Young Phố').slice(0, 256);
  const description = String(
    args.description
    || args.content
    || [
      '1. Tôn trọng mọi thành viên.',
      '2. Không spam, scam, NSFL.',
      '3. Đúng kênh đúng việc.',
      '4. Chia sẻ kiến thức xây dựng cộng đồng.',
      '5. Ban quản trị có quyền xử lý vi phạm.',
    ].join('\n')
  ).slice(0, 4096);

  const embed = new EmbedBuilder()
    .setColor(0x2b2d31)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: 'Tổ Young Phố' })
    .setTimestamp();

  // Rules panel is embed-only (no button dependency on cf-bot).
  return { embeds: [embed] };
}

async function handlePanelButtonInteraction(interaction) {
  if (!interaction.isButton?.()) return false;

  const customId = interaction.customId;
  if (customId === BUTTON_IDS.VISA_BTN) {
    const roleId = VISA_ROLE_ID;
    const member = interaction.member;
    if (!member?.roles) {
      await interaction.reply({ content: 'Không đọc được member.', ephemeral: true });
      return true;
    }
    if (member.roles.cache?.has(roleId) || member.roles?.includes?.(roleId)) {
      await interaction.reply({ content: 'Bạn đã có Visa rồi.', ephemeral: true });
      return true;
    }
    try {
      if (member.roles.add) await member.roles.add(roleId, 'Visa panel button');
      else return false;
      await interaction.reply({ content: 'Đã cấp Visa — chào mừng Cư dân!', ephemeral: true });
    } catch (error) {
      await interaction.reply({
        content: `Không gán được role Visa: ${error.message}`,
        ephemeral: true,
      });
    }
    return true;
  }

  const roleId = DEFAULT_ROLE_MAP[customId];
  if (!roleId) return false;

  const member = interaction.member;
  if (!member?.roles?.add) {
    await interaction.reply({
      content: 'Bot gateway chưa handle được interaction kiểu này (cần guild member cache).',
      ephemeral: true,
    });
    return true;
  }

  const hasRole = member.roles.cache.has(roleId);
  try {
    if (hasRole) {
      await member.roles.remove(roleId, 'Role panel toggle');
      await interaction.reply({ content: 'Đã gỡ role.', ephemeral: true });
    } else {
      await member.roles.add(roleId, 'Role panel toggle');
      await interaction.reply({ content: 'Đã gán role.', ephemeral: true });
    }
  } catch (error) {
    await interaction.reply({ content: `Lỗi role: ${error.message}`, ephemeral: true });
  }
  return true;
}

module.exports = {
  BUTTON_IDS,
  DEFAULT_ROLE_MAP,
  buildRolesPanelPayload,
  buildVisaPanelPayload,
  buildRulesPanelPayload,
  handlePanelButtonInteraction,
};
