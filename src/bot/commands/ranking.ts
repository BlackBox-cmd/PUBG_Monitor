import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import config from '../../config';
import pubgClient from '../../api/pubgClient';
import * as logger from '../../utils/logger';

export async function handleRanking(interaction: ChatInputCommandInteraction) {
  const region = interaction.options.getString('region') || 'global';
  const gameMode = interaction.options.getString('mode') || 'squad';
  const season = interaction.options.getString('season') || 'current';

  await interaction.deferReply();

  try {
    logger.info(`Fetching leaderboard for ${region}/${gameMode}/${season}`);
    const leaderboard = await pubgClient.getLeaderboard('steam', region, gameMode, season);

    if (!leaderboard || leaderboard.entries.length === 0) {
      const embed = new EmbedBuilder()
        .setColor('Orange')
        .setTitle('No Leaderboard Data')
        .setDescription(`Could not fetch leaderboard data for ${region} / ${gameMode}.`)
        .setFooter({ text: config.discord.footerText })
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const topEntries = leaderboard.entries.slice(0, 10);
    const rankingList = topEntries.map((entry) =>
      `**#${entry.rank}** ${entry.playerName}
` +
      `Wins: ${entry.stats.wins.toLocaleString()} • K/D: ${entry.stats.kdRatio.toFixed(2)} • WR: ${(entry.stats.winRate * 100).toFixed(1)}%`
    ).join('\n\n');

    const embed = new EmbedBuilder()
      .setColor('DarkBlue')
      .setTitle(`PUBG Leaderboard — ${gameMode.toUpperCase()} (${region.toUpperCase()})`)
      .setDescription(`Season: **${leaderboard.season}** | Platform: **STEAM**`)
      .addFields(
        { name: 'Top Players', value: rankingList, inline: false }
      )
      .setFooter({ text: config.discord.footerText })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error(`Error in /ranking command: ${error}`);
    const embed = new EmbedBuilder()
      .setColor('Red')
      .setTitle('❌ Ranking Lookup Failed')
      .setDescription('An error occurred while fetching leaderboard data. Please try again later.')
      .setFooter({ text: config.discord.footerText })
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
  }
}
