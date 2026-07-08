const { EmbedBuilder } = require('discord.js');

function parseBool(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function fillTemplate(template, member) {
  const guild = member.guild;
  return String(template || '')
    .replaceAll('{user}', `<@${member.id}>`)
    .replaceAll('{username}', member.user?.username || member.displayName || 'member')
    .replaceAll('{server}', guild?.name || 'server')
    .replaceAll('{memberCount}', String(guild?.memberCount ?? 'unknown'));
}

function getOnboardingConfig(env = process.env) {
  return {
    enabled: parseBool(env.ASSISTANT_WELCOME_ENABLED, false),
    channelId: String(env.ASSISTANT_WELCOME_CHANNEL_ID || '').trim(),
    dmEnabled: parseBool(env.ASSISTANT_WELCOME_DM, false),
    autoRoleId: String(env.ASSISTANT_WELCOME_ROLE_ID || '').trim(),
    rulesChannelId: String(env.ASSISTANT_RULES_CHANNEL_ID || '').trim(),
    introduceChannelId: String(env.ASSISTANT_INTRO_CHANNEL_ID || '').trim(),
    helpChannelId: String(env.ASSISTANT_HELP_CHANNEL_ID || '').trim(),
    color: /^#[0-9a-f]{6}$/i.test(String(env.ASSISTANT_WELCOME_COLOR || ''))
      ? env.ASSISTANT_WELCOME_COLOR
      : '#5865F2',
    title: env.ASSISTANT_WELCOME_TITLE || 'Chao mung den voi {server}',
    message: env.ASSISTANT_WELCOME_MESSAGE || [
      'Chao mung {user} den voi {server}.',
      'Hay doc noi quy, gioi thieu ban than va cho moi nguoi biet ban dang dung Blender, Maya, ZBrush, Substance hay 2D workflow nhe.',
    ].join('\n'),
    dmMessage: env.ASSISTANT_WELCOME_DM_MESSAGE || [
      'Chao mung {username} den voi {server}.',
      'Neu can ho tro, hay dat cau hoi trong khu hoi dap hoac mention bot trong server.',
    ].join('\n'),
  };
}

function buildWelcomeEmbed(member, config = getOnboardingConfig()) {
  const descriptionParts = [fillTemplate(config.message, member)];
  const links = [];
  if (config.rulesChannelId) links.push(`Noi quy: <#${config.rulesChannelId}>`);
  if (config.introduceChannelId) links.push(`Gioi thieu: <#${config.introduceChannelId}>`);
  if (config.helpChannelId) links.push(`Hoi dap: <#${config.helpChannelId}>`);
  if (links.length) descriptionParts.push(links.join('\n'));

  return new EmbedBuilder()
    .setColor(config.color)
    .setTitle(fillTemplate(config.title, member).slice(0, 256))
    .setDescription(descriptionParts.join('\n\n').slice(0, 4096))
    .setFooter({ text: `Member #${member.guild?.memberCount ?? '?'}` })
    .setTimestamp();
}

async function assignWelcomeRole(member, config) {
  if (!config.autoRoleId) return null;
  const role = await member.guild.roles.fetch(config.autoRoleId).catch(() => null);
  if (!role) return 'welcome role not found';
  await member.roles.add(role, 'Assistant onboarding auto role');
  return `assigned role ${role.name}`;
}

async function sendWelcomeChannelMessage(member, config) {
  if (!config.channelId) return null;
  const channel = await member.guild.channels.fetch(config.channelId).catch(() => null);
  if (!channel?.isTextBased?.()) return 'welcome channel not found or not text based';
  await channel.send({ embeds: [buildWelcomeEmbed(member, config)] });
  return `sent welcome to #${channel.name}`;
}

async function sendWelcomeDm(member, config) {
  if (!config.dmEnabled) return null;
  await member.send(fillTemplate(config.dmMessage, member).slice(0, 1900));
  return 'sent welcome DM';
}

async function handleGuildMemberAdd(member, env = process.env) {
  const config = getOnboardingConfig(env);
  if (!config.enabled) return [];

  const results = [];
  for (const action of [assignWelcomeRole, sendWelcomeChannelMessage, sendWelcomeDm]) {
    try {
      const result = await action(member, config);
      if (result) results.push(result);
    } catch (error) {
      console.error('[ONBOARDING] Action failed:', error);
      results.push(`failed: ${error.message}`);
    }
  }
  return results;
}

module.exports = {
  buildWelcomeEmbed,
  fillTemplate,
  getOnboardingConfig,
  handleGuildMemberAdd,
  parseBool,
};
