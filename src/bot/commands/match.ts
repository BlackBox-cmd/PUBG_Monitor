import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import config from '../../config';
import pubgClient from '../../api/pubgClient';
import { getUserFromDb } from '../../lib/userHelper';
import * as logger from '../../utils/logger';

export async function handleMatch(interaction: ChatInputCommandInteraction) {
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
            `Use \`/register\` to link your account, or specify a player name: \`/match player:PlayerName\``
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

    // Fetch last match
    logger.info(`Fetching last match for ${playerName} (${playerId}) on ${platform}`);
    const matches = await pubgClient.getPlayerMatches(platform, playerId, 1);

    if (!matches || matches.length === 0) {
      const embed = new EmbedBuilder()
        .setColor('Orange')
        .setTitle('No Match Found')
        .setDescription(`Player **${playerName}** has no recent matches.`)
        .setFooter({ text: config.discord.footerText })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const match = matches[0];
    const matchAttrs = match.attributes || {};
    const matchStats: any = matchAttrs.stats || {};
    const createdAt = new Date(matchAttrs.createdAt || Date.now());
    const durationSeconds = matchAttrs.duration || 0;
    const durationMinutes = Math.floor(durationSeconds / 60);
    const durationString = `${durationMinutes}m ${durationSeconds % 60}s`;

    // Calculate KDA and other metrics
    const kda = matchStats.kills || 0;
    const damage = matchStats.damageDealt || 0;
    const survived = matchStats.survival_time || durationSeconds;
    const finalPos = matchAttrs.isCustomMatch ? 'Custom' : matchStats.rank || 'N/A';
    const dpm = damage > 0 && survived > 0 ? (damage / (survived / 60)).toFixed(1) : 'N/A';

    // Build detailed match embed
    const embed = new EmbedBuilder()
      .setColor(String(finalPos) === '1' ? 'Gold' : 'Blurple')
      .setTitle(`${playerName} — Last Match Details`)
      .setDescription(
        `**${matchAttrs.gameMode || 'Unknown'}** on **${matchAttrs.mapName || 'Unknown'}**\n` +
        `${createdAt.toLocaleDateString()} at ${createdAt.toLocaleTimeString()}`
      )
      .addFields(
        {
          name: 'Match Result',
          value:
            `🏅 **Final Position**: #${finalPos}\n` +
            `⏱️ **Duration**: ${durationString}\n` +
            `${matchAttrs.isCustomMatch ? '🎮 Custom Match' : ''}`,
          inline: false,
        },
        {
          name: 'Combat Stats',
          value:
            `🔫 **Kills**: ${kda}\n` +
            `💥 **Damage Dealt**: ${damage.toFixed(0)}\n` +
            `📊 **Damage Per Minute**: ${dpm}`,
          inline: true,
        },
        {
          name: 'Survival',
          value:
            `⏲️ **Survived**: ${(survived / 60).toFixed(1)} min\n` +
            `🛡️ **Damage Taken**: ${matchStats.damageTaken || 0}`,
          inline: true,
        }
      )
      .setFooter({ text: config.discord.footerText })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error(`Error in /match command: ${error}`);

    const embed = new EmbedBuilder()
      .setColor('Red')
      .setTitle('❌ Match Lookup Failed')
      .setDescription(`An error occurred. Please try again later.`)
      .setFooter({ text: config.discord.footerText })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}
