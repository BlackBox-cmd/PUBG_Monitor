import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import config from '../../config';
import pubgClient from '../../api/pubgClient';
import { getUserFromDb } from '../../lib/userHelper';
import * as logger from '../../utils/logger';

interface ResolvedPlayer {
  id: string;
  name: string;
  platform: string;
}

async function resolvePlayer(playerName: string | null, discordUserId: string): Promise<ResolvedPlayer | null> {
  if (playerName) {
    const player = await pubgClient.getPlayerByName('steam', playerName);
    if (!player) return null;
    return {
      id: player.id,
      name: player.attributes?.name || playerName,
      platform: 'steam',
    };
  }

  const registered = await getUserFromDb(discordUserId);
  if (!registered) return null;

  return {
    id: registered.pubgPlayerId,
    name: registered.pubgPlayerName,
    platform: registered.platform,
  };
}

export async function handleCompare(interaction: ChatInputCommandInteraction) {
  const player1Param = interaction.options.getString('player1');
  const player2Param = interaction.options.getString('player2');
  const discordUser = interaction.user;

  await interaction.deferReply();

  try {
    if (!player1Param && !player2Param) {
      const registered = await getUserFromDb(discordUser.id);
      if (!registered) {
        const embed = new EmbedBuilder()
          .setColor('Yellow')
          .setTitle('Need Players to Compare')
          .setDescription(
            `Provide at least one player name or register your account first.\n` +
            `Use "/compare player1:YourName player2:OtherName" or /register to compare against your linked PUBG account.`
          )
          .setFooter({ text: config.discord.footerText })
          .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
        return;
      }
    }

    const left = await resolvePlayer(player1Param, discordUser.id);
    const right = await resolvePlayer(player2Param, discordUser.id);

    if (!left || !right) {
      const embed = new EmbedBuilder()
        .setColor('Red')
        .setTitle('Player Lookup Failed')
        .setDescription('Could not resolve one or both players. Make sure the names are spelled correctly.')
        .setFooter({ text: config.discord.footerText })
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (left.id === right.id && left.platform === right.platform) {
      const embed = new EmbedBuilder()
        .setColor('Orange')
        .setTitle('Same Player')
        .setDescription('You are comparing the same PUBG player. Try a different player for a comparison.')
        .setFooter({ text: config.discord.footerText })
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    logger.info(`Comparing players ${left.name} and ${right.name}`);

    const statsLeft = await pubgClient.getPlayerStats(left.platform, left.id);
    const statsRight = await pubgClient.getPlayerStats(right.platform, right.id);

    if (!statsLeft || !statsRight) {
      const embed = new EmbedBuilder()
        .setColor('Orange')
        .setTitle('Stats Not Available')
        .setDescription('Could not retrieve stats for one or both players.')
        .setFooter({ text: config.discord.footerText })
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    let leftScore = 0;
    let rightScore = 0;

    const compareMetric = (a: number, b: number) => {
      if (a > b) leftScore += 1;
      else if (b > a) rightScore += 1;
    };

    compareMetric(statsLeft.wins, statsRight.wins);
    compareMetric(statsLeft.kdRatio, statsRight.kdRatio);
    compareMetric(statsLeft.kills, statsRight.kills);
    compareMetric(statsLeft.winRate, statsRight.winRate);
    compareMetric(statsLeft.topTen, statsRight.topTen);

    const winner = leftScore === rightScore ? 'Tie' : leftScore > rightScore ? left.name : right.name;

    const embed = new EmbedBuilder()
      .setColor(leftScore === rightScore ? 'Grey' : leftScore > rightScore ? 'Blue' : 'Purple')
      .setTitle(`${left.name} vs ${right.name}`)
      .setDescription(`Winner: **${winner}**\nComparison based on wins, K/D, kills, win rate, and top 10 finishes.`)
      .addFields(
        { name: 'Player 1', value: `${left.name} (${left.platform.toUpperCase()})`, inline: true },
        { name: 'Player 2', value: `${right.name} (${right.platform.toUpperCase()})`, inline: true },
        {
          name: 'Wins',
          value: `${statsLeft.wins.toLocaleString()} vs ${statsRight.wins.toLocaleString()}`,
          inline: true,
        },
        {
          name: 'K/D Ratio',
          value: `${statsLeft.kdRatio.toFixed(2)} vs ${statsRight.kdRatio.toFixed(2)}`,
          inline: true,
        },
        {
          name: 'Kills',
          value: `${statsLeft.kills.toLocaleString()} vs ${statsRight.kills.toLocaleString()}`,
          inline: true,
        },
        {
          name: 'Win Rate',
          value: `${(statsLeft.winRate * 100).toFixed(1)}% vs ${(statsRight.winRate * 100).toFixed(1)}%`,
          inline: true,
        },
        {
          name: 'Top 10s',
          value: `${statsLeft.topTen.toLocaleString()} vs ${statsRight.topTen.toLocaleString()}`,
          inline: true,
        }
      )
      .setFooter({ text: config.discord.footerText })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error(`Error in /compare command: ${error}`);
    const embed = new EmbedBuilder()
      .setColor('Red')
      .setTitle('❌ Compare Failed')
      .setDescription('An error occurred while comparing players. Please try again later.')
      .setFooter({ text: config.discord.footerText })
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
  }
}
