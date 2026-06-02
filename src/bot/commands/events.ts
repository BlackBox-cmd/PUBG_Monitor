import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import config from '../../config';
import pubgClient from '../../api/pubgClient';
import * as logger from '../../utils/logger';

export async function handleEvents(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  try {
    logger.info('Fetching event information');
    const events = await pubgClient.getEvents();

    if (!events || events.length === 0) {
      const embed = new EmbedBuilder()
        .setColor('Orange')
        .setTitle('No Active Events')
        .setDescription('No active PUBG events were found at this time.')
        .setFooter({ text: config.discord.footerText })
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const eventFields = events.map((event) => ({
      name: `${event.isActive ? '🟢' : '⚪'} ${event.name}`,
      value:
        `${event.description}\n` +
        `**Starts:** ${event.startDate.toLocaleDateString()} • **Ends:** ${event.endDate.toLocaleDateString()}\n` +
        `${event.rewards?.length ? `Rewards: ${event.rewards.join(', ')}` : 'Rewards unavailable.'}`,
      inline: false,
    }));

    const embed = new EmbedBuilder()
      .setColor('DarkPurple')
      .setTitle('PUBG Events')
      .setDescription('Current and upcoming PUBG events')
      .addFields(...eventFields)
      .setFooter({ text: config.discord.footerText })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error(`Error in /events command: ${error}`);
    const embed = new EmbedBuilder()
      .setColor('Red')
      .setTitle('❌ Events Lookup Failed')
      .setDescription('An error occurred while fetching event data. Please try again later.')
      .setFooter({ text: config.discord.footerText })
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
  }
}
