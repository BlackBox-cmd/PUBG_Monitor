import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import config from '../../config';
import pubgClient from '../../api/pubgClient';
import { getUserFromDb } from '../../lib/userHelper';
import * as logger from '../../utils/logger';

async function resolvePlayer(playerName: string | null, discordUserId: string) {
  if (playerName) {
    const player = await pubgClient.getPlayerByName('steam', playerName);
    if (!player) return null;
    return { id: player.id, name: player.attributes?.name || playerName, platform: 'steam' };
  }

  const registered = await getUserFromDb(discordUserId);
  if (!registered) return null;
  return { id: registered.pubgPlayerId, name: registered.pubgPlayerName, platform: registered.platform };
}

export async function handleStats(interaction: ChatInputCommandInteraction) {
  const playerParam = interaction.options.getString('player');
  const discordUser = interaction.user;
  await interaction.deferReply();

  try {
    const player = await resolvePlayer(playerParam, discordUser.id);
    if (!player) {
      const embed = new EmbedBuilder()
        .setColor('Yellow')
        .setTitle('Not Registered')
        .setDescription(
          `You're not registered with any PUBG account.\n\n` +
          `Use \`/register\` to link your account, or specify a player name: \`/stats player:PlayerName\``
        )
        .setFooter({ text: config.discord.footerText })
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    logger.info(`Fetching stats for ${player.name}`);
    const stats = await pubgClient.getPlayerStats(player.platform, player.id);
    const seasonInfo = await pubgClient.getSeasonInfo(player.platform);
    const matches = await pubgClient.getPlayerMatches(player.platform, player.id, 20);

    if (!stats) {
      const embed = new EmbedBuilder()
        .setColor('Orange')
        .setTitle('No Stats Available')
        .setDescription(`Player **${player.name}** has no recorded PUBG stats yet.`)
        .setFooter({ text: config.discord.footerText })
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const modeCounts = matches.reduce((acc: Record<string, number>, match) => {
      const mode = match.attributes?.gameMode || 'Unknown';
      acc[mode] = (acc[mode] || 0) + 1;
      return acc;
    }, {});

    const modeLines = Object.entries(modeCounts)
      .map(([mode, count]) => `**${mode}**: ${count} matches`)
      .join('\n') || 'No recent match data available.';

    const embed = new EmbedBuilder()
      .setColor('DarkGreen')
      .setTitle(`${player.name} — PUBG Detailed Stats`)
      .setDescription(
        `Platform: **${player.platform.toUpperCase()}** | Stats: **${stats.season === 'lifetime' ? 'Lifetime' : stats.season || 'Current'}**` +
        `${seasonInfo ? ` | Current Season: **${seasonInfo.id}**` : ''}`
      )
      .addFields(
        {
          name: 'Overall Stats',
          value:
            `🎮 **Matches**: ${stats.matches.toLocaleString()}\n` +
            `🔫 **Kills**: ${stats.kills.toLocaleString()}\n` +
            `🏆 **Wins**: ${stats.wins.toLocaleString()}\n` +
            `🎯 **K/D Ratio**: ${stats.kdRatio.toFixed(2)}\n` +
            `📈 **Win Rate**: ${(stats.winRate * 100).toFixed(1)}%\n` +
            `💥 **Avg Damage**: ${stats.avgDamage.toFixed(1)}`,
          inline: false,
        },
        {
          name: 'Recent Mode Breakdown',
          value: modeLines,
          inline: false,
        }
      )
      .setFooter({ text: config.discord.footerText })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error(`Error in /stats command: ${error}`);
    const embed = new EmbedBuilder()
      .setColor('Red')
      .setTitle('❌ Stats Lookup Failed')
      .setDescription('An error occurred while fetching stats. Please try again later.')
      .setFooter({ text: config.discord.footerText })
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
  }
}
