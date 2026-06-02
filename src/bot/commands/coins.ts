import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import config from '../../config';
import { getUserFromDb, getBattleCoinsForUser } from '../../lib/userHelper';
import * as logger from '../../utils/logger';

export async function handleCoins(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  try {
    const registered = await getUserFromDb(interaction.user.id);
    if (!registered) {
      const embed = new EmbedBuilder()
        .setColor('Yellow')
        .setTitle('Not Registered')
        .setDescription(
          `You're not registered with any PUBG account.\n\n` +
          `Use \`/register\` to link your PUBG account and start earning BattleCoins.`
        )
        .setFooter({ text: config.discord.footerText })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const coins = await getBattleCoinsForUser(interaction.user.id);
    if (!coins) {
      const embed = new EmbedBuilder()
        .setColor('Orange')
        .setTitle('BattleCoins Not Initialized')
        .setDescription(`Your BattleCoins wallet has not been initialized yet. Play one match or re-register to get started.`)
        .setFooter({ text: config.discord.footerText })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const recentTransactions = (coins.transactions || [])
      .slice(-5)
      .reverse()
      .map((transaction) => {
        const sign = transaction.type === 'spend' ? '-' : '+';
        return `${sign}${transaction.amount} ${transaction.reason.replace('_', ' ')}${transaction.relatedMatchId ? ` (match: ${transaction.relatedMatchId})` : ''}`;
      })
      .join('\n') || 'No recent transactions.';

    const embed = new EmbedBuilder()
      .setColor('Blue')
      .setTitle(`${registered.pubgPlayerName} — BattleCoins Wallet`)
      .setDescription(`Your BattleCoins balance is updated automatically after match completion.`)
      .addFields(
        { name: 'Balance', value: `**${coins.balance}**`, inline: true },
        { name: 'Total Earned', value: `${coins.totalEarned}`, inline: true },
        { name: 'Total Spent', value: `${coins.totalSpent}`, inline: true },
        { name: 'Recent Activity', value: recentTransactions, inline: false }
      )
      .setFooter({ text: config.discord.footerText })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error(`Error in /coins command: ${error}`);
    const embed = new EmbedBuilder()
      .setColor('Red')
      .setTitle('❌ BattleCoins Lookup Failed')
      .setDescription('An error occurred while fetching your BattleCoins wallet. Please try again later.')
      .setFooter({ text: config.discord.footerText })
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
  }
}
