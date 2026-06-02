import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import config from '../../config';
import { getUserFromDb, unregisterUser } from '../../lib/userHelper';
import * as logger from '../../utils/logger';

export async function handleUnregister(
  interaction: ChatInputCommandInteraction
) {
  const discordUser = interaction.user;
  await interaction.deferReply();

  try {
    // Check if user is registered
    const user = await getUserFromDb(discordUser.id);
    if (!user) {
      const embed = new EmbedBuilder()
        .setColor('Yellow')
        .setTitle('Not Registered')
        .setDescription(
          `You're not registered with any PUBG account yet.\n\n` +
          `Use \`/register\` to link your account.`
        )
        .setFooter({ text: config.discord.footerText })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Unregister user
    logger.info(
      `Unregistering user ${discordUser.id} from PUBG player ${user.pubgPlayerName}`
    );
    await unregisterUser(discordUser.id);

    const embed = new EmbedBuilder()
      .setColor('Green')
      .setTitle('✅ Unregistered')
      .setDescription(
        `Successfully unlinked from **${user.pubgPlayerName}** on **${user.platform}**.\n\n` +
        `You can register a new account anytime with \`/register\`.`
      )
      .setFooter({ text: config.discord.footerText })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error(`Error in /unregister command: ${error}`);

    const embed = new EmbedBuilder()
      .setColor('Red')
      .setTitle('❌ Unregister Failed')
      .setDescription(
        `An error occurred while unregistering. Please try again later.`
      )
      .setFooter({ text: config.discord.footerText })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}
