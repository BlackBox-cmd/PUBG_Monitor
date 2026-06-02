import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import config from '../../config';
import pubgClient from '../../api/pubgClient';
import { getUserFromDb } from '../../lib/userHelper';
import * as logger from '../../utils/logger';

export async function handleHistory(interaction: ChatInputCommandInteraction) {
  const playerParam = interaction.options.getString('player');
  const discordUser = interaction.user;
  await interaction.deferReply();

  try {
    let playerId: string;
    let playerName: string;
    let platform: string;

    // If player parameter provided, look up their ID; otherwise use registered user
    if (playerParam) {
      const player = await pubgClient.getPlayerByName('steam', playerParam);
      if (!player) {
        const embed = new EmbedBuilder()
          .setColor('Red')
          .setTitle('Player Not Found')
          .setDescription(`Could not find player **${playerParam}** on **steam**.`)
          .setFooter({ text: config.discord.footerText })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        return;
      }
      playerId = player.id;
      playerName = player.attributes?.name || playerParam;
      platform = 'steam';
    } else {
      const registered = await getUserFromDb(discordUser.id);
      if (!registered) {
        const embed = new EmbedBuilder()
          .setColor('Yellow')
          .setTitle('Not Registered')
          .setDescription(
            `You're not registered with any PUBG account.\n\n` +
            `Use \`/register\` to link your account, or specify a player name: \`/history player:PlayerName\``
          )
          .setFooter({ text: config.discord.footerText })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        return;
      }
      playerId = registered.pubgPlayerId;
      playerName = registered.pubgPlayerName;
      platform = registered.platform;
    }

    // Fetch last 5 matches
    logger.info(`Fetching match history for ${playerName} (${playerId}) on ${platform}`);
    const matches = await pubgClient.getPlayerMatches(platform, playerId, 5);

    if (!matches || matches.length === 0) {
      const embed = new EmbedBuilder()
        .setColor('Orange')
        .setTitle('No Match History')
        .setDescription(`Player **${playerName}** has no recent matches.`)
        .setFooter({ text: config.discord.footerText })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Build match history embed
    const matchFields = matches.map((match, index) => {
      const matchAttrs = match.attributes || {};
      const matchStats: any = matchAttrs.stats || {};
      const createdAt = new Date(matchAttrs.createdAt || Date.now());
      const durationMinutes = Math.floor((matchAttrs.duration || 0) / 60);

      return {
        name: `Match ${index + 1} — ${matchAttrs.gameMode || 'Unknown'} on ${matchAttrs.mapName || 'Unknown'}`,
        value:
          `🗓️ ${createdAt.toLocaleDateString()} ${createdAt.toLocaleTimeString()}\n` +
          `🎯 **Position**: #${matchAttrs.isCustomMatch ? 'Custom' : matchStats.rank || 'N/A'} | ⏱️ **Duration**: ${durationMinutes}m\n` +
          `🔫 **Kills**: ${matchStats.kills || 0} | 💥 **Damage**: ${matchStats.damageDealt || 0}`,
        inline: false,
      };
    });

    const embed = new EmbedBuilder()
      .setColor('Green')
      .setTitle(`${playerName} — Last 5 Matches`)
      .setDescription(`Platform: **${platform.toUpperCase()}**`)
      .addFields(...matchFields)
      .setFooter({ text: config.discord.footerText })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error(`Error in /history command: ${error}`);

    const embed = new EmbedBuilder()
      .setColor('Red')
      .setTitle('❌ History Lookup Failed')
      .setDescription(`An error occurred. Please try again later.`)
      .setFooter({ text: config.discord.footerText })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}
