import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import config from '../../config';
import * as logger from '../../utils/logger';

export async function handleUpdates(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  try {
    const embed = new EmbedBuilder()
      .setColor('Purple')
      .setTitle('PUBG Monitor Bot — Latest Updates')
      .setDescription('Stay up to date with the newest features and improvements.')
      .addFields(
        {
          name: 'Phase 8 Complete',
          value: 'Added `/coins` and `/updates` commands plus BattleCoins rewards system support.',
        },
        {
          name: 'BattleCoins Rewards',
          value: 'Earn coins for match completions, wins, top 10s, and activity. Track your balance with `/coins`.',
        },
        {
          name: 'Leaderboard & Comparison',
          value: 'Compare players with `/compare` and view leaderboards with `/ranking`.',
        },
        {
          name: 'Map Rotation & Events',
          value: 'Use `/maps` and `/events` to view current PUBG rotation and ongoing events.',
        }
      )
      .setFooter({ text: config.discord.footerText })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error(`Error in /updates command: ${error}`);
    const embed = new EmbedBuilder()
      .setColor('Red')
      .setTitle('❌ Updates Lookup Failed')
      .setDescription('Unable to fetch the latest update summary. Please try again later.')
      .setFooter({ text: config.discord.footerText })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}
