const { Client, GatewayIntentBits, Collection } = require('discord.js');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const configModule = require('./config');
const config = configModule.default || configModule;
const { startUptimeHeartbeat } = require('./utils/uptime');

// ── Create client ────────────────────────────────────────────────

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
    ],
});

client.commands = new Collection();

// ── Load commands ────────────────────────────────────────────────

const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
    for (const file of commandFiles) {
        const command = require(path.join(commandsPath, file));
        if (command.data && command.execute) {
            client.commands.set(command.data.name, command);
            console.log(`📦 Loaded command: /${command.data.name}`);
        }
    }
}

// ── Load events ──────────────────────────────────────────────────

const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
    const eventFiles = fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'));
    for (const file of eventFiles) {
        const event = require(path.join(eventsPath, file));
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args));
        } else {
            client.on(event.name, (...args) => event.execute(...args));
        }
        console.log(`🔔 Loaded event: ${event.name}`);
    }
}

// ── Connect MongoDB & Login ──────────────────────────────────────

async function start() {
    try {
        // Try connecting to MongoDB (optional — alerts won't work without it)
        try {
            await mongoose.connect(config.mongodb.uri);
            console.log('🗄️  Connected to MongoDB');
        } catch (dbErr) {
            console.warn('⚠️  MongoDB connection failed:', dbErr.message);
            console.warn('⚠️  Bot will start without database (alerts disabled).');
            console.warn('💡 If using MongoDB Atlas, try the standard connection string instead of mongodb+srv://');
        }

        // Login to Discord
        await client.login(config.discord.token);

        client.once('ready', () => {
            startUptimeHeartbeat('Bot', () => client.ws.ping);
        });
    } catch (err) {
        console.error('❌ Failed to start bot:', err);
        process.exit(1);
    }
}

start();

// ── Graceful shutdown ────────────────────────────────────────────

process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down...');
    await mongoose.disconnect();
    client.destroy();
    process.exit(0);
});

process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});
