import { parseEmbedColor } from '../defaults.js';
import { getBotConfig } from '../storage.js';

export async function buildRulesPanel(env) {
  const finalConfig = await getBotConfig(env);
  const colorInt = parseEmbedColor(finalConfig.rulesColor, 0x2b2d31);

  return {
    embeds: [{
      color: colorInt,
      title: finalConfig.rulesTitle,
      description: finalConfig.rulesDescription,
    }]
  };
}
