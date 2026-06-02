import 'dotenv/config';
import {
  ChatInputCommandInteraction,
  Client,
  DiscordAPIError,
  GatewayIntentBits,
  REST,
  Routes,
  EmbedBuilder,
  ActivityType,
  Events,
} from 'discord.js';
import config from '../config';
import { connectMongo } from '../db/mongo';
import { handleProfile } from './commands/profile';
import { handleRegister } from './commands/register';
import { handleUnregister } from './commands/unregister';
import { handleHistory } from './commands/history';
import { handleMatch } from './commands/match';
import { handleCompare } from './commands/compare';
import { handleRanking } from './commands/ranking';
import { handleStats } from './commands/stats';
import { handleMaps } from './commands/maps';
import { handleEvents } from './commands/events';
import { handleCoins } from './commands/coins';
import { handleUpdates } from './commands/updates';
import { startUptimeHeartbeat } from '../utils/uptime';

const BOT_TOKEN = config.discord.token;

if (!BOT_TOKEN) {
  console.error('Missing DISCORD_TOKEN in env');
  process.exit(1);
}

function isUnknownInteraction(error: unknown) {
  return error instanceof DiscordAPIError && error.code === 10062;
}

async function handleCommandError(
  interaction: ChatInputCommandInteraction,
  error: unknown
) {
  if (isUnknownInteraction(error)) {
    console.warn(
      `Discord interaction expired before /${interaction.commandName} could be acknowledged.`
    );
    return;
  }

  console.error(`Unhandled error in /${interaction.commandName}:`, error);

  if (!interaction.isRepliable()) return;

  try {
    const errorEmbed = new EmbedBuilder()
      .setColor('Red')
      .setTitle('Command Error')
      .setDescription('Something went wrong while running that command. Please try again.')
      .setFooter({ text: config.discord.footerText })
      .setTimestamp();

    const payload = {
      embeds: [errorEmbed],
    };

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(payload);
    } else {
      await interaction.reply({ ...payload, ephemeral: true });
    }
  } catch (replyError) {
    if (!isUnknownInteraction(replyError)) {
      console.error(`Failed to send error response for /${interaction.commandName}:`, replyError);
    }
  }
}

async function main() {
  await connectMongo();

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  client.on('error', (error) => {
    console.error('Discord client error:', error);
  });

  client.once(Events.ClientReady, () => {
    console.log(`Logged in as ${client.user?.tag}`);

    const activities = config.discord.activities;
    let index = 0;

    const updateActivity = () => {
      if (activities.length === 0) return;
      client.user?.setActivity(activities[index], {
        type: ActivityType.Watching,
      });
      index = (index + 1) % activities.length;
    };

    updateActivity();
    setInterval(updateActivity, 5000);

    startUptimeHeartbeat('Bot', () => client.ws.ping);
  });

  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName } = interaction;

    try {
      if (commandName === 'ping') {
        const embed = new EmbedBuilder()
          .setColor('Blue')
          .setTitle('Pong! 🏓')
          .setFooter({ text: config.discord.footerText })
          .setTimestamp();
        await interaction.reply({ embeds: [embed] });
        return;
      }
      if (commandName === 'register') {
        await handleRegister(interaction);
        return;
      }
      if (commandName === 'unregister') {
        await handleUnregister(interaction);
        return;
      }
      if (commandName === 'profile') {
        await handleProfile(interaction);
        return;
      }
      if (commandName === 'history') {
        await handleHistory(interaction);
        return;
      }
      if (commandName === 'match') {
        await handleMatch(interaction);
        return;
      }
      if (commandName === 'compare') {
        await handleCompare(interaction);
        return;
      }
      if (commandName === 'ranking') {
        await handleRanking(interaction);
        return;
      }
      if (commandName === 'stats') {
        await handleStats(interaction);
        return;
      }
      if (commandName === 'maps') {
        await handleMaps(interaction);
        return;
      }
      if (commandName === 'events') {
        await handleEvents(interaction);
        return;
      }
      if (commandName === 'coins') {
        await handleCoins(interaction);
        return;
      }
      if (commandName === 'updates') {
        await handleUpdates(interaction);
        return;
      }
    } catch (error) {
      await handleCommandError(interaction, error);
    }
  });

  // Register a minimal slash command (ping, profile)
  const appId = config.discord.appId;
  if (appId) {
    const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
    try {
      await rest.put(Routes.applicationCommands(appId), {
        body: [
          {
            name: 'ping',
            description: 'Ping the bot'
          },
          {
            name: 'register',
            description: 'Link your PUBG account to Discord',
            options: [
              { name: 'username', description: 'Your PUBG player name', type: 3, required: true },
              { 
                name: 'platform', 
                description: 'Gaming platform (default: steam)', 
                type: 3, 
                required: false,
                choices: [
                  { name: 'Steam', value: 'steam' },
                  { name: 'Xbox', value: 'xbox' },
                  { name: 'PlayStation', value: 'psn' },
                  { name: 'Mobile', value: 'mobile' }
                ]
              }
            ]
          },
          {
            name: 'unregister',
            description: 'Unlink your PUBG account from Discord'
          },
          {
            name: 'profile',
            description: 'Get player profile',
            options: [
              { name: 'player', description: 'Player name (default: your registered account)', type: 3, required: false }
            ]
          },
          {
            name: 'history',
            description: 'View your last 5 matches',
            options: [
              { name: 'player', description: 'Player name (default: your registered account)', type: 3, required: false }
            ]
          },
          {
            name: 'match',
            description: 'Get details about your last match',
            options: [
              { name: 'player', description: 'Player name (default: your registered account)', type: 3, required: false }
            ]
          },
          {
            name: 'compare',
            description: 'Compare two PUBG players side by side',
            options: [
              { name: 'player1', description: 'First player name', type: 3, required: false },
              { name: 'player2', description: 'Second player name', type: 3, required: false }
            ]
          },
          {
            name: 'ranking',
            description: 'View PUBG leaderboard',
            options: [
              { name: 'region', description: 'Leaderboard region', type: 3, required: false },
              { name: 'mode', description: 'Game mode', type: 3, required: false, choices: [
                { name: 'Solo', value: 'solo' },
                { name: 'Duo', value: 'duo' },
                { name: 'Squad', value: 'squad' }
              ] },
              { name: 'season', description: 'Season identifier', type: 3, required: false }
            ]
          },
          {
            name: 'stats',
            description: 'View detailed PUBG stats and mode breakdown',
            options: [
              { name: 'player', description: 'Player name (default: your registered account)', type: 3, required: false }
            ]
          },
          {
            name: 'maps',
            description: 'Show current PUBG map rotation'
          },
          {
            name: 'events',
            description: 'Show active PUBG events and rewards'
          }
          ,
          {
            name: 'coins',
            description: 'View your BattleCoins wallet and recent transactions'
          },
          {
            name: 'updates',
            description: 'Show the latest PUBG Monitor bot updates'
          }
        ]
      });
      console.log('Registered global application commands');
    } catch (err) {
      console.warn('Could not register commands globally — continuing.', err);
    }
  } else {
    console.warn('DISCORD_APP_ID is missing; skipping global slash command registration.');
  }

  await client.login(BOT_TOKEN);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
