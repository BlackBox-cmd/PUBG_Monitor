import { Schema } from 'mongoose';
import { Platform } from '../../types/pubg';

export const UserSchema = new Schema({
  discordId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  discordUsername: {
    type: String,
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
    default: 'steam',
  } as { type: typeof String; enum: Platform[]; default: Platform },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  verified: {
    type: Boolean,
    default: false,
  },
});

// Add pre-save middleware to update timestamp
(UserSchema as any).pre('save', function (this: any, next: any) {
  this.updatedAt = new Date();
  next();
});
