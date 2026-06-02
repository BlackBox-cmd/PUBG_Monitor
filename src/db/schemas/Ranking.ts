import { Schema } from 'mongoose';

export const RankingSchema = new Schema({
  region: {
    type: String,
    required: true,
    index: true,
  },
  mode: {
    type: String,
    required: true,
    index: true,
  },
  season: {
    type: String,
    required: true,
    index: true,
  },
  rank: {
    type: Number,
    required: true,
  },
  pubgPlayerId: {
    type: String,
    required: true,
    index: true,
  },
  pubgPlayerName: {
    type: String,
    required: true,
  },
  platform: {
    type: String,
    enum: ['steam', 'xbox', 'psn', 'mobile'],
    required: true,
  },
  stats: {
    kills: {
      type: Number,
      default: 0,
    },
    wins: {
      type: Number,
      default: 0,
    },
    topTen: {
      type: Number,
      default: 0,
    },
    matches: {
      type: Number,
      default: 0,
    },
    kdRatio: {
      type: Number,
      default: 0,
    },
    winRate: {
      type: Number,
      default: 0,
    },
  },
  cachedAt: {
    type: Date,
    default: Date.now,
  },
});

// Compound index for efficient leaderboard queries
RankingSchema.index(
  { region: 1, mode: 1, season: 1, rank: 1 },
  { unique: true }
);

// TTL index: auto-delete cached leaderboard data older than 1 hour
RankingSchema.index({ cachedAt: 1 }, { expireAfterSeconds: 3600 });
