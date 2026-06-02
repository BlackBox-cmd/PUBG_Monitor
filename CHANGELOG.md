# Changelog

All notable changes to this project are documented here.

## v0.1.0 - Phase Releases (2026-06-02)

### Phase 1 — Infrastructure
- Added Mongoose models and schemas for User, Player, Match, Ranking, BattleCoins
- Database connection management via `src/db/mongo.ts`

### Phase 2 — PUBG API Client
- Implemented `src/api/pubgClient.ts` with rate limiting and Redis caching
- Endpoints: player lookup, match lookup, leaderboard, season, maps, events, telemetry fetch

### Phase 3 — User Registration
- `/register` and `/unregister` commands
- `src/lib/userHelper.ts` utilities for user management

### Phase 4 — Core Commands
- `/profile`, `/history`, `/match` implemented
- Registered users fallback for commands

### Phase 5 — Comparison & Ranking
- `/compare`, `/ranking`, `/stats`, `/maps`, `/events` added

### Phase 6 — Advanced Stats
- Detailed stats breakdown and mode-based analysis for `/stats`

### Phase 7 — BattleCoins Rewards
- BattleCoins schema and wallet support
- Telemetry worker awards BattleCoins for match completion, kills, top-10s, and wins
- `/coins` command to view wallet and transactions

### Phase 8 — Updates Command
- `/updates` command to expose release notes and roadmap highlights

### Phase 9 — Documentation
- Full command reference added to `README.md`
- `.env.example` updated with additional variables
- `CHANGELOG.md` added

