import { Schema } from 'mongoose';

export const BattleCoinsSchema = new Schema({
  discordId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  balance: {
    type: Number,
    default: 0,
    min: 0,
  },
  totalEarned: {
    type: Number,
    default: 0,
    min: 0,
  },
  totalSpent: {
    type: Number,
    default: 0,
    min: 0,
  },
  transactions: [
    {
      type: {
        type: String,
        enum: ['earn', 'spend', 'bonus', 'penalty'],
        required: true,
      },
      amount: {
        type: Number,
        required: true,
      },
      reason: {
        type: String, // e.g., "match_completion", "win_bonus", "top_10_bonus"
        required: true,
      },
      relatedMatchId: {
        type: String,
        default: null,
      },
      timestamp: {
        type: Date,
        default: Date.now,
      },
    },
  ],
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
(BattleCoinsSchema as any).pre('save', function (this: any, next: any) {
  this.updatedAt = new Date();
  next();
});

// TTL index: keep transaction history for 1 year, then clean old records
BattleCoinsSchema.index(
  { 'transactions.timestamp': 1 },
  { expireAfterSeconds: 31536000, sparse: true }
);
