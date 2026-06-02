import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import config from '../../config';
import pubgClient from '../../api/pubgClient';
import { getUserFromDb } from '../../lib/userHelper';
import * as logger from '../../utils/logger';

export async function handleProfile(interaction: ChatInputCommandInteraction) {
  const playerParam = interaction.options.getString('player');
  const discordUser = interaction.user;
  await interaction.deferReply();

  try {
    let playerName: string;
    let platform: string;

    // If player parameter provided, use it; otherwise use registered user
    if (playerParam) {
      playerName = playerParam;
      platform = 'steam'; // default to steam for optional player lookup
    } else {
      const registered = await getUserFromDb(discordUser.id);
      if (!registered) {
        const embed = new EmbedBuilder()
          .setColor('Yellow')
          .setTitle('Not Registered')
          .setDescription(
            `You're not registered with any PUBG account.\n\n` +
            `Use \`/register\` to link your account, or specify a player name: \`/profile player:PlayerName\``
          )
          .setFooter({ text: config.discord.footerText })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        return;
      }
      playerName = registered.pubgPlayerName;
      platform = registered.platform;
    }

    // Fetch player
    logger.info(`Fetching profile for ${playerName} on ${platform}`);
    const player = await pubgClient.getPlayerByName(platform, playerName);

    if (!player) {
      const embed = new EmbedBuilder()
        .setColor('Red')
        .setTitle('Player Not Found')
        .setDescription(`Could not find player **${playerName}** on **${platform}**.`)
        .setFooter({ text: config.discord.footerText })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Fetch stats
    const stats = await pubgClient.getPlayerStats(platform, player.id);

    if (!stats) {
      const embed = new EmbedBuilder()
        .setColor('Orange')
        .setTitle('No Stats Available')
        .setDescription(`Player **${playerName}** has no recorded stats yet.`)
        .setFooter({ text: config.discord.footerText })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Build profile embed
    const embed = new EmbedBuilder()
      .setColor('Blue')
      .setTitle(`${playerName} — PUBG Profile`)
      .setDescription(`Platform: **${platform.toUpperCase()}** | Player ID: \`${player.id}\``)
      .addFields(
        {
          name: 'Combat Stats',
          value:
            `🔫 **Kills**: ${stats.kills.toLocaleString()}\n` +
            `🎯 **K/D Ratio**: ${stats.kdRatio.toFixed(2)}\n` +
            `💥 **Avg Damage**: ${stats.avgDamage.toFixed(1)}`,
          inline: true,
        },
        {
          name: 'Win Stats',
          value:
            `🏆 **Wins**: ${stats.wins.toLocaleString()}\n` +
            `📊 **Top 10s**: ${stats.topTen.toLocaleString()}\n` +
            `📈 **Win Rate**: ${(stats.winRate * 100).toFixed(1)}%`,
          inline: true,
        },
        {
          name: 'Overview',
          value: `🎮 **Matches Played**: ${stats.matches.toLocaleString()}`,
          inline: false,
        }
      )
      .setThumbnail(discordUser.avatarURL() || null)
      .setFooter({ text: config.discord.footerText })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error(`Error in /profile command: ${error}`);

    const embed = new EmbedBuilder()
      .setColor('Red')
      .setTitle('❌ Profile Lookup Failed')
      .setDescription(`An error occurred. Please try again later.`)
      .setFooter({ text: config.discord.footerText })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}
