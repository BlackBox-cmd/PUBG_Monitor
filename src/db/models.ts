import { model, Model, Document } from 'mongoose';
import { UserSchema } from './schemas/User';
import { PlayerSchema } from './schemas/Player';
import { MatchSchema } from './schemas/Match';
import { RankingSchema } from './schemas/Ranking';
import { BattleCoinsSchema } from './schemas/BattleCoins';

/**
 * User model - Discord user to PUBG player mapping
 */
export interface IUser extends Document {
  discordId: string;
  discordUsername: string;
  pubgPlayerId: string;
  pubgPlayerName: string;
  platform: 'steam' | 'xbox' | 'psn' | 'mobile';
  createdAt: Date;
  updatedAt: Date;
  verified: boolean;
}

export const User: Model<IUser> = model<IUser>('User', UserSchema);

/**
 * Player model - Cached PUBG player stats
 */
export interface IPlayer extends Document {
  pubgPlayerId: string;
  pubgPlayerName: string;
  platform: 'steam' | 'xbox' | 'psn' | 'mobile';
  stats: {
    kills: number;
    wins: number;
    topTen: number;
    matches: number;
    kdRatio: number;
    winRate: number;
    avgDamage: number;
  };
  season: string | null;
  cachedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const Player: Model<IPlayer> = model<IPlayer>('Player', PlayerSchema);

/**
 * Match model - Player match history
 */
export interface IMatch extends Document {
  pubgMatchId: string;
  pubgPlayerId: string;
  pubgPlayerName: string;
  platform: 'steam' | 'xbox' | 'psn' | 'mobile';
  createdAt: Date;
  duration: number;
  gameMode: string;
  mapName: string;
  stats: {
    kills: number;
    assists: number;
    damageDealt: number;
    damageTaken: number;
    finalPosition: number;
    timeSurvived: number;
  };
  storedAt: Date;
}

export const Match: Model<IMatch> = model<IMatch>('Match', MatchSchema);

/**
 * Ranking model - Cached leaderboard data
 */
export interface IRanking extends Document {
  region: string;
  mode: string;
  season: string;
  rank: number;
  pubgPlayerId: string;
  pubgPlayerName: string;
  platform: 'steam' | 'xbox' | 'psn' | 'mobile';
  stats: {
    kills: number;
    wins: number;
    topTen: number;
    matches: number;
    kdRatio: number;
    winRate: number;
  };
  cachedAt: Date;
}

export const Ranking: Model<IRanking> = model<IRanking>(
  'Ranking',
  RankingSchema
);

/**
 * BattleCoins model - User rewards system
 */
export interface ITransaction {
  type: 'earn' | 'spend' | 'bonus' | 'penalty';
  amount: number;
  reason: string;
  relatedMatchId?: string;
  timestamp: Date;
}

export interface IBattleCoins extends Document {
  discordId: string;
  balance: number;
  totalEarned: number;
  totalSpent: number;
  transactions: ITransaction[];
  createdAt: Date;
  updatedAt: Date;
}

export const BattleCoins: Model<IBattleCoins> = model<IBattleCoins>(
  'BattleCoins',
  BattleCoinsSchema
);

// Export all models together for easy importing
export const models = {
  User,
  Player,
  Match,
  Ranking,
  BattleCoins,
};
