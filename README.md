# PUBG Discord Bot (starter)

Starter scaffold for a Discord bot that provides PUBG PC stats and match notifications.

Quick start

1. Copy `.env.example` to `.env` and set values.
   - Set `DISCORD_APP_ID` to your bot application ID to enable global slash command registration.
2. Install dependencies:

```bash
npm install
```

3. Run in dev mode:

```bash
npm run dev
```

Run the telemetry worker:

```bash
npm run worker
```

Build & run:

```bash
npm run build
npm start
```

Features

### Easy Registration
Use `/register <username> [platform]` to link your PUBG account to your Discord user and start using the bot.
- **username** (required): Your exact PUBG player name
- **platform** (optional): `steam`, `xbox`, `psn`, or `mobile` (default: `steam`)

**Example**: `/register PlayerName steam`

After successful registration, you'll see your current stats displayed. Use `/unregister` to unlink your account.

### Detailed Profile
Check your PUBG profile with key stats like kills, wins, K/D ratio and more using `/profile`.
- **player** (optional): Player name (default: your registered account)

**Examples**:
- `/profile` — Get your profile
- `/profile player:PlayerName` — Get another player's profile

### Match History
View the last 5 matches with details on map, mode, kills, final position and duration using `/history`.
- **player** (optional): Player name (default: your registered account)

**Example**: `/history` or `/history player:PlayerName`

### Last Match Details
Access complete and specific info about your last match with `/match`.
- **player** (optional): Player name (default: your registered account)

**Example**: `/match` or `/match player:PlayerName`

### Updated Ranking
Check the top players by region and mode, with real-time data and filters via `/ranking`.
- **region** (optional): Region to filter by, e.g. `global`, `na`, `eu`
- **mode** (optional): `solo`, `duo`, or `squad`
- **season** (optional): Season identifier, or leave blank for current season

### Player Comparator
Compare stats between two players to see who dominates using `/compare`.
- **player1** (optional): First player name (defaults to your registered account if available)
- **player2** (optional): Second player name

**Example**: `/compare player1:PlayerA player2:PlayerB`

### Advanced Stats
Get detailed PUBG breakdowns with `/stats`.
- **player** (optional): Player name (default: your registered account)

**Example**: `/stats`

### Maps and Events
Stay up to date with active maps and ongoing events using `/maps` and `/events`.
- `/maps` — Current map rotation and active rewards
- `/events` — Active PUBG events and seasonal challenges

### BattleCoins – Rewards System
With BattleCoins you can enjoy a unique system within the PUBG Monitor bot, designed to reward your activity. Check your balance with `/coins`.

### Cross-Platform Support
Full support for Steam, Console (Xbox/PlayStation), and Mobile platforms.

### Bot Updates
Check the latest changes, improvements and new features using `/updates`.

Files of interest

- `src/bot/index.ts` — Discord bot entry
- `src/api/pubgClient.ts` — PUBG API client skeleton
- `src/workers/telemetryWorker.ts` — worker skeleton
- `src/db/mongo.ts` — MongoDB helper
- `.env.example` — environment variables

## Command Reference

Below is a concise reference for available slash commands and examples.

- `/ping` — Bot health check.

- `/register username:<name> [platform:<steam|xbox|psn|mobile>]` — Link your PUBG account to Discord.
   - Example: `/register PlayerName steam`

- `/unregister` — Unlink your PUBG account.

- `/profile [player:<name>]` — Show overall player stats (K/D, wins, damage).
   - Example: `/profile` (uses your registered account)
   - Example: `/profile player:OtherPlayer`

- `/history [player:<name>]` — Show last 5 matches with summary per match.

- `/match [player:<name>]` — Detailed view of the most recent match (DPM, survival time, final position).

- `/compare [player1:<name>] [player2:<name>]` — Side-by-side player comparison; defaults to your registered account if one name is omitted.

- `/ranking [region:<code>] [mode:<solo|duo|squad>] [season:<id>]` — Leaderboard view for region/mode/season.

- `/stats [player:<name>]` — Advanced stats and mode breakdown (uses last 20 matches for breakdown).

- `/maps` — Current map rotation and active map rewards.

- `/events` — Active PUBG events and seasonal information.

- `/coins` — Your BattleCoins wallet: balance, totals, and recent transactions.

- `/updates` — Summary of recent bot updates and feature highlights.

## Telemetry Worker & BattleCoins

- The telemetry worker processes match telemetry and awards BattleCoins to registered users based on match completion, kills, top-10 finishes and wins. The worker subscribes to a Redis channel and expects messages with the shape `{"matchId":"...","platform":"steam"}`.
- Run the telemetry worker locally with:

```bash
npm run worker
```

- BattleCoins rules (current implementation):
   - Base reward: 10 coins per processed match per registered player
   - Win bonus: +20 coins for 1st place
   - Top-10 bonus: +10 coins for finishing in top 10
   - Kill bonus: +2 coins per kill
   - Duplicate rewards are prevented via transaction checks

## Deployment & Run

Start the bot (after setting environment variables in `.env`):

```bash
npm install
npm run build
npm start
```

Start the telemetry worker (separate process):

```bash
npm run worker
```

### Environment variables
See `.env.example` for required values. At minimum you should set `DISCORD_TOKEN`, `DISCORD_APP_ID`, `PUBG_API_KEY`, `MONGO_URI` and `REDIS_URL`.

## CHANGELOG

See `CHANGELOG.md` for a phase-by-phase summary of implemented features and notable changes.
