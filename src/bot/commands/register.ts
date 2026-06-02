import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import config from '../../config';
import pubgClient from '../../api/pubgClient';
import {
  registerUser,
  getUserFromDb,
  initializeBattleCoins,
} from '../../lib/userHelper';
import * as logger from '../../utils/logger';
import { Platform } from '../../types/pubg';

export async function handleRegister(
  interaction: ChatInputCommandInteraction
) {
  const pubgUsername = interaction.options.getString('username', true);
  const platform = (interaction.options.getString('platform') || 'steam') as Platform;
  const discordUser = interaction.user;

  await interaction.deferReply();

  try {
    // Check if user is already registered
    const existing = await getUserFromDb(discordUser.id);
    if (existing) {
      const embed = new EmbedBuilder()
        .setColor('Yellow')
        .setTitle('Already Registered')
        .setDescription(
          `You're already linked to **${existing.pubgPlayerName}** on **${existing.platform}**.\n\n` +
          `To link a different account, unregister first.`
        )
        .setFooter({ text: config.discord.footerText })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Verify player exists on PUBG API
    logger.info(
      `Verifying PUBG player: ${pubgUsername} on ${platform}`
    );
    const pubgPlayer = await pubgClient.getPlayerByName(platform, pubgUsername);

    if (!pubgPlayer) {
      const embed = new EmbedBuilder()
        .setColor('Red')
        .setTitle('Player Not Found')
        .setDescription(
          `Could not find player **${pubgUsername}** on **${platform}**.\n\n` +
          `Make sure the name is spelled correctly and the platform is correct.`
        )
        .addFields({ name: 'Supported Platforms', value: '`steam`, `xbox`, `psn`, `mobile`' })
        .setFooter({ text: config.discord.footerText })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Register user in database
    const playerName = pubgPlayer.attributes?.name || pubgUsername;
    const playerId = pubgPlayer.id;

    logger.info(
      `Registering ${discordUser.username} (${discordUser.id}) to PUBG player ${playerName} (${playerId})`
    );

    const user = await registerUser(
      discordUser.id,
      discordUser.username,
      playerId,
      playerName,
      platform
    );

    // Initialize BattleCoins for the user
    await initializeBattleCoins(discordUser.id);
    logger.info(`Initialized BattleCoins for user ${discordUser.id}`);

    // Get player stats for display
    const stats = await pubgClient.getPlayerStats(platform, playerId);

    // Build confirmation embed
    const embed = new EmbedBuilder()
      .setColor('Green')
      .setTitle('✅ Registration Successful')
      .setDescription(
        `Linked Discord account **${discordUser.username}** to PUBG account **${playerName}**`
      )
      .addFields(
        { name: 'Player ID', value: playerId, inline: true },
        { name: 'Platform', value: platform.toUpperCase(), inline: true },
        { name: 'Registered At', value: new Date(user.createdAt).toLocaleString(), inline: false }
      );

    if (stats) {
      embed.addFields(
        { name: 'Current Stats', value: '_ _', inline: false },
        { name: 'Kills', value: stats.kills.toString(), inline: true },
        { name: 'Wins', value: stats.wins.toString(), inline: true },
        { name: 'Top 10s', value: stats.topTen.toString(), inline: true },
        { name: 'Matches Played', value: stats.matches.toString(), inline: true },
        { name: 'K/D Ratio', value: stats.kdRatio.toFixed(2), inline: true },
        { name: 'Win Rate', value: `${(stats.winRate * 100).toFixed(1)}%`, inline: true }
      );
    }

    embed
      .setThumbnail(discordUser.avatarURL() || null)
      .setFooter({ text: config.discord.footerText })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error(`Error in /register command: ${error}`);

    const embed = new EmbedBuilder()
      .setColor('Red')
      .setTitle('❌ Registration Failed')
      .setDescription(
        `An error occurred while registering. Please try again later.\n\n` +
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
      .setFooter({ text: config.discord.footerText })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}
