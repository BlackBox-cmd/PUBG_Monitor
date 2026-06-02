/**
 * TypeScript types and interfaces for PUBG API and bot data models
 */

export type Platform = 'steam' | 'xbox' | 'psn' | 'mobile';

export interface PubgPlayer {
  id: string;
  name: string;
  platform: Platform;
  shard: string;
  stats?: PlayerStats;
}

export interface PlayerStats {
  kills: number;
  wins: number;
  topTen: number;
  matches: number;
  kdRatio: number;
  winRate: number;
  avgDamage: number;
  season?: string;
  updatedAt?: Date;
}

export interface MatchData {
  id: string;
  createdAt: Date;
  duration: number;
  gameMode: string;
  mapName: string;
  isCustomMatch: boolean;
  stats: MatchStats;
}

export interface MatchStats {
  kills: number;
  assists: number;
  damageDealt: number;
  damageTaken: number;
  finalPosition: number;
  timeSurvived: number;
}

export interface LeaderboardEntry {
  rank: number;
  playerName: string;
  playerId: string;
  platform: Platform;
  stats: PlayerStats;
}

export interface Leaderboard {
  region: string;
  mode: string;
  season: string;
  generatedAt: Date;
  entries: LeaderboardEntry[];
}

export interface MatchNotification {
  playerId: string;
  playerName: string;
  matchId: string;
  stats: MatchStats;
  timestamp: Date;
}

export interface MapRotationInfo {
  name: string;
  isActive: boolean;
  nextRotation?: Date;
  rewards?: string[];
}

export interface EventInfo {
  name: string;
  isActive: boolean;
  startDate: Date;
  endDate: Date;
  description: string;
  rewards?: string[];
}

export interface PlayerComparison {
  player1: {
    name: string;
    stats: PlayerStats;
  };
  player2: {
    name: string;
    stats: PlayerStats;
  };
  winner: 'player1' | 'player2' | 'tie';
}
