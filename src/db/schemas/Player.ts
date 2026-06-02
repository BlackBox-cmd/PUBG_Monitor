import { Schema } from 'mongoose';
import { Platform } from '../../types/pubg';

export const PlayerSchema = new Schema({
  pubgPlayerId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  pubgPlayerName: {
    type: String,
    required: true,
    index: true,
  },
  platform: {
    type: String,
    enum: ['steam', 'xbox', 'psn', 'mobile'],
    required: true,
  } as { type: typeof String; enum: Platform[] },
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
    avgDamage: {
      type: Number,
      default: 0,
    },
  },
  season: {
    type: String,
    default: null,
  },
  cachedAt: {
    type: Date,
    default: Date.now,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Add pre-save middleware to update timestamp
(PlayerSchema as any).pre('save', function (this: any, next: any) {
  this.updatedAt = new Date();
  next();
});

// TTL index: auto-delete cached stats older than 24 hours
PlayerSchema.index({ cachedAt: 1 }, { expireAfterSeconds: 86400 });
