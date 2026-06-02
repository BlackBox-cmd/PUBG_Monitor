import { Schema } from 'mongoose';

export const MatchSchema = new Schema({
  pubgMatchId: {
    type: String,
    required: true,
    unique: true,
    index: true,
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
  createdAt: {
    type: Date,
    required: true,
  },
  duration: {
    type: Number, // in seconds
    required: true,
  },
  gameMode: {
    type: String,
    required: true,
  },
  mapName: {
    type: String,
    required: true,
  },
  stats: {
    kills: {
      type: Number,
      default: 0,
    },
    assists: {
      type: Number,
      default: 0,
    },
    damageDealt: {
      type: Number,
      default: 0,
    },
    damageTaken: {
      type: Number,
      default: 0,
    },
    finalPosition: {
      type: Number,
      required: true,
    },
    timeSurvived: {
      type: Number, // in seconds
      default: 0,
    },
  },
  storedAt: {
    type: Date,
    default: Date.now,
  },
});

// Add pre-save middleware to auto-set storedAt
(MatchSchema as any).pre('save', function (this: any, next: any) {
  if (!this.storedAt) {
    this.storedAt = new Date();
  }
  next();
});

// TTL index: auto-delete old match records after 90 days
MatchSchema.index({ storedAt: 1 }, { expireAfterSeconds: 7776000 });
