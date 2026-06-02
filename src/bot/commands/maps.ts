import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import config from '../../config';
import pubgClient from '../../api/pubgClient';
import * as logger from '../../utils/logger';

export async function handleMaps(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  try {
    logger.info('Fetching map rotation');
    const maps = await pubgClient.getMapRotation();

    if (!maps || maps.length === 0) {
      const embed = new EmbedBuilder()
        .setColor('Orange')
        .setTitle('No Map Rotation Data')
        .setDescription('Could not fetch current map rotation data at this time.')
        .setFooter({ text: config.discord.footerText })
        .setTimestamp();
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const activeMaps = maps.filter((map) => map.isActive).map((map) => `**${map.name}**${map.rewards?.length ? ` — Rewards: ${map.rewards.join(', ')}` : ''}`);
    const inactiveMaps = maps.filter((map) => !map.isActive).map((map) => `**${map.name}**`);

    const embed = new EmbedBuilder()
      .setColor('Navy')
      .setTitle('PUBG Map Rotation')
      .addFields(
        { name: 'Active Maps', value: activeMaps.join('\n') || 'No active maps found.', inline: false },
        { name: 'Rotated Out / Inactive', value: inactiveMaps.join('\n') || 'No inactive maps at the moment.', inline: false }
      )
      .setFooter({ text: config.discord.footerText })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error(`Error in /maps command: ${error}`);
    const embed = new EmbedBuilder()
      .setColor('Red')
      .setTitle('❌ Map Rotation Failed')
      .setDescription('An error occurred while fetching map rotation data. Please try again later.')
      .setFooter({ text: config.discord.footerText })
      .setTimestamp();
    await interaction.editReply({ embeds: [embed] });
  }
}
