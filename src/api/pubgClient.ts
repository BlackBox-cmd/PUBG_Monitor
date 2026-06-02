import axios, { AxiosError } from 'axios';
import redis from '../lib/cache';
import config from '../config';
import * as logger from '../utils/logger';
import { PlayerStats, Leaderboard, EventInfo, MapRotationInfo } from '../types/pubg';

const PUBG_API_KEY = config.pubg.apiKey;
const RATE_LIMIT_DELAY = 100; // ms between requests to respect rate limits

// Rate limiting: queue requests to avoid hitting API limits
class RequestThrottler {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  private lastRequestTime = 0;

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const now = Date.now();
          const timeSinceLastRequest = now - this.lastRequestTime;
          if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
            await new Promise(r => setTimeout(r, RATE_LIMIT_DELAY - timeSinceLastRequest));
          }
          this.lastRequestTime = Date.now();
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.process();
    });
  }

  private async process() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;
    try {
      const fn = this.queue.shift();
      if (fn) await fn();
    } finally {
      this.processing = false;
      if (this.queue.length > 0) this.process();
    }
  }
}

export interface PUBGPlayer {
  id: string;
  type: string;
  attributes: {
    name: string;
    stats?: {
      all?: {
        kills: number;
        wins: number;
        top10s: number;
        matchesPlayed: number;
        kd: number;
        winRate: number;
        damageDealt: number;
      };
      [key: string]: any;
    };
  };
  relationships?: {
    matches?: {
      data: Array<{ id: string }>;
    };
    [key: string]: any;
  };
}

export interface PUBGMatch {
  id: string;
  type: string;
  attributes: {
    createdAt: string;
    duration: number;
    gameMode: string;
    mapName: string;
    isCustomMatch: boolean;
    seasonState: string;
    stats?: {
      kills: number;
      damageDealt: number;
      survival_time: number;
      rank: number;
      [key: string]: any;
    };
  };
  relationships?: {
    rosters?: {
      data: Array<{ id: string }>;
    };
    [key: string]: any;
  };
}

export interface PUBGSeason {
  id: string;
  type: string;
  attributes: {
    isCurrentSeason: boolean;
    isOffseason: boolean;
    seasonId: string;
    [key: string]: any;
  };
}

type PubgResource = {
  id: string;
  type: string;
  attributes?: any;
  relationships?: any;
};

type PubgGameModeStats = {
  damageDealt?: number;
  kills?: number;
  losses?: number;
  roundsPlayed?: number;
  top10s?: number;
  wins?: number;
};

type PubgAggregateStats = {
  damageDealt: number;
  kills: number;
  losses: number;
  matches: number;
  topTen: number;
  wins: number;
};

export class PUBGClient {
  private base = 'https://api.playbattlegrounds.com';
  private throttler = new RequestThrottler();

  constructor(private apiKey: string = PUBG_API_KEY) {
    if (!this.apiKey) {
      logger.error('PUBG_API_KEY not set in environment variables');
    }
  }

  private headers() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: 'application/vnd.api+json',
    };
  }

  /**
   * Get player by name (cached for 1 hour)
   */
  async getPlayerByName(platform: string, name: string): Promise<PUBGPlayer | null> {
    const cacheKey = `pubg:player:${platform}:${name}`;
    
    try {
      // Check cache first
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.info(`Cache hit for player ${name} on ${platform}`);
        return JSON.parse(cached);
      }

      const player = await this.throttler.execute(async () => {
        const url = `${this.base}/shards/${platform}/players?filter[playerNames]=${encodeURIComponent(name)}`;
        const res = await axios.get(url, { 
          headers: this.headers(),
          timeout: 10000,
        });
        return res.data.data[0] || null;
      });

      if (player) {
        // Cache for 1 hour
        await redis.setex(cacheKey, 3600, JSON.stringify(player));
      }

      return player;
    } catch (error) {
      logger.error(`Failed to fetch player ${name} on ${platform}: ${error}`);
      throw this.handleError(error);
    }
  }

  /**
   * Get player by ID (for direct lookups)
   */
  async getPlayerById(platform: string, playerId: string): Promise<PUBGPlayer | null> {
    const cacheKey = `pubg:playerid:${platform}:${playerId}`;
    
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const player = await this.throttler.execute(async () => {
        const url = `${this.base}/shards/${platform}/players/${encodeURIComponent(playerId)}`;
        const res = await axios.get(url, { 
          headers: this.headers(),
          timeout: 10000,
        });
        return res.data.data || null;
      });

      if (player) {
        await redis.setex(cacheKey, 3600, JSON.stringify(player));
      }

      return player;
    } catch (error) {
      logger.error(`Failed to fetch player ${playerId} on ${platform}: ${error}`);
      throw this.handleError(error);
    }
  }

  /**
   * Get player stats (kills, wins, K/D ratio, etc.)
   * Returns aggregate lifetime stats across all game modes.
   */
  async getPlayerStats(
    platform: string,
    playerId: string,
    season: string = 'lifetime'
  ): Promise<PlayerStats | null> {
    const cacheKey = `pubg:stats:${platform}:${playerId}:${season}`;

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const stats = await this.throttler.execute(async () => {
        const url = `${this.base}/shards/${platform}/players/${encodeURIComponent(playerId)}/seasons/${encodeURIComponent(season)}`;
        const res = await axios.get(url, {
          headers: this.headers(),
          timeout: 10000,
        });

        const gameModeStats = res.data.data?.attributes?.gameModeStats || {};
        return this.aggregateGameModeStats(gameModeStats, season);
      });

      await redis.setex(cacheKey, 3600, JSON.stringify(stats));
      return stats;
    } catch (error) {
      logger.error(`Failed to get stats for player ${playerId}: ${error}`);
      return null;
    }
  }

  /**
   * Get player's recent matches (last N matches)
   */
  async getPlayerMatches(platform: string, playerId: string, limit: number = 5): Promise<PUBGMatch[]> {
    const cacheKey = `pubg:matches:${platform}:${playerId}`;
    
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const matches = JSON.parse(cached);
        return matches.slice(0, limit);
      }

      const player = await this.getPlayerById(platform, playerId);
      const matchRefs = player?.relationships?.matches?.data || [];
      const matchIds = matchRefs
        .map((match: { id?: string }) => match.id)
        .filter((id: string | undefined): id is string => Boolean(id))
        .slice(0, Math.min(limit, 20));

      const matches = (
        await Promise.all(
          matchIds.map((matchId) => this.getMatchById(platform, matchId, playerId))
        )
      ).filter((match): match is PUBGMatch => Boolean(match));

      if (matches.length > 0) {
        // Cache for 30 minutes
        await redis.setex(cacheKey, 1800, JSON.stringify(matches));
      }

      return matches.slice(0, limit);
    } catch (error) {
      logger.error(`Failed to fetch matches for player ${playerId}: ${error}`);
      throw this.handleError(error);
    }
  }

  /**
   * Get match details by ID
   */
  async getMatchById(
    platform: string,
    matchId: string,
    playerId?: string
  ): Promise<PUBGMatch | null> {
    const cacheKey = `pubg:match:${platform}:${matchId}${playerId ? `:${playerId}` : ''}`;
    
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const match = await this.throttler.execute(async () => {
        const url = `${this.base}/shards/${platform}/matches/${matchId}`;
        const res = await axios.get(url, { 
          headers: this.headers(),
          timeout: 10000,
        });
        return this.mapMatchResponse(res.data, playerId);
      });

      if (match) {
        // Cache forever (match data never changes)
        await redis.set(cacheKey, JSON.stringify(match));
      }

      return match;
    } catch (error) {
      logger.error(`Failed to fetch match ${matchId}: ${error}`);
      throw this.handleError(error);
    }
  }

  /**
   * Get match details including rosters and participants
   */
  async getMatchDetails(platform: string, matchId: string): Promise<any | null> {
    const cacheKey = `pubg:match:details:${platform}:${matchId}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const details = await this.throttler.execute(async () => {
        const url = `${this.base}/shards/${platform}/matches/${matchId}`;
        const res = await axios.get(url, {
          headers: this.headers(),
          timeout: 15000,
        });
        return res.data || null;
      });

      if (details) {
        await redis.setex(cacheKey, 3600, JSON.stringify(details));
      }

      return details;
    } catch (error) {
      logger.error(`Failed to fetch match details ${matchId}: ${error}`);
      throw this.handleError(error);
    }
  }

  /**
   * Get leaderboard for a region and game mode
   * Cached for 1 hour to respect API limits
   */
  async getLeaderboard(
    platform: string,
    region: string,
    gameMode: string = 'squad',
    season?: string
  ): Promise<Leaderboard | null> {
    const seasonParam = season || 'current';
    const leaderboardShard = this.getLeaderboardShard(platform, region);
    const cacheKey = `pubg:leaderboard:${leaderboardShard}:${gameMode}:${seasonParam}`;

    try {
      const resolvedSeason =
        seasonParam.toLowerCase() === 'current'
          ? (await this.getSeasonInfo(leaderboardShard))?.id
          : seasonParam;

      if (!resolvedSeason) {
        return null;
      }

      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.info(`Cache hit for leaderboard ${region}/${gameMode}`);
        return JSON.parse(cached);
      }

      const leaderboard = await this.throttler.execute(async () => {
        const url = `${this.base}/shards/${leaderboardShard}/leaderboards/${resolvedSeason}/${gameMode}`;
        const res = await axios.get(url, { 
          headers: this.headers(),
          timeout: 15000,
        });
        
        const data = res.data.included || [];
        return {
          region: leaderboardShard,
          gameMode,
          mode: gameMode,
          season: resolvedSeason,
          generatedAt: new Date(),
          entries: data
            .map((entry: any, idx: number) => ({
              rank: entry.attributes?.rank || idx + 1,
              playerName: entry.attributes?.name || 'Unknown',
              playerId: entry.id,
              platform,
              stats: {
                kills: entry.attributes?.stats?.kills || 0,
                wins: entry.attributes?.stats?.wins || 0,
                topTen: 0,
                matches: entry.attributes?.stats?.games || 0,
                kdRatio:
                  entry.attributes?.stats?.kda ||
                  entry.attributes?.stats?.killDeathRatio ||
                  0,
                winRate: entry.attributes?.stats?.winRatio || 0,
                avgDamage: entry.attributes?.stats?.averageDamage || 0,
              },
            }))
            .sort((left: { rank: number }, right: { rank: number }) => left.rank - right.rank),
        };
      });

      if (leaderboard) {
        // Cache for 1 hour
        await redis.setex(cacheKey, 3600, JSON.stringify(leaderboard));
      }

      return leaderboard;
    } catch (error) {
      logger.error(`Failed to fetch leaderboard for ${region}/${gameMode}: ${error}`);
      throw this.handleError(error);
    }
  }

  /**
   * Get current season information
   */
  async getSeasonInfo(platform: string): Promise<PUBGSeason | null> {
    const cacheKey = `pubg:season:${platform}`;

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const season = await this.throttler.execute(async () => {
        const url = `${this.base}/shards/${platform}/seasons`;
        const res = await axios.get(url, { 
          headers: this.headers(),
          timeout: 10000,
        });
        const seasons = res.data.data || [];
        return seasons.find((item: PUBGSeason) => item.attributes?.isCurrentSeason) || null;
      });

      if (season) {
        // Cache for 6 hours
        await redis.setex(cacheKey, 21600, JSON.stringify(season));
      }

      return season;
    } catch (error) {
      logger.error(`Failed to fetch season info for ${platform}: ${error}`);
      throw this.handleError(error);
    }
  }

  /**
   * Get map rotation and active maps
   * This is static data that changes monthly
   */
  async getMapRotation(): Promise<MapRotationInfo[]> {
    const cacheKey = 'pubg:maps:rotation';

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Maps in PUBG with current rotation status
      // In a real implementation, this would come from PUBG's status API
      const maps: MapRotationInfo[] = [
        {
          name: 'Erangel',
          isActive: true,
          rewards: ['BP', 'XP'],
        },
        {
          name: 'Miramar',
          isActive: true,
          rewards: ['BP', 'XP'],
        },
        {
          name: 'Taego',
          isActive: true,
          rewards: ['BP', 'XP'],
        },
        {
          name: 'Deston',
          isActive: true,
          rewards: ['BP', 'XP'],
        },
        {
          name: 'Haven',
          isActive: false,
          rewards: [],
        },
      ];

      // Cache for 24 hours (maps rotate monthly)
      await redis.setex(cacheKey, 86400, JSON.stringify(maps));
      return maps;
    } catch (error) {
      logger.error(`Failed to fetch map rotation: ${error}`);
      throw this.handleError(error);
    }
  }

  /**
   * Get active events and seasonal information
   */
  async getEvents(): Promise<EventInfo[]> {
    const cacheKey = 'pubg:events:active';

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // In a real implementation, this would come from PUBG's status API
      // For now, return placeholder events
      const events: EventInfo[] = [
        {
          name: 'Season Event',
          isActive: true,
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          description: 'Current seasonal event with exclusive rewards',
          rewards: ['BP', 'cosmetics'],
        },
        {
          name: 'Weekend Challenge',
          isActive: true,
          startDate: new Date(),
          endDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days
          description: 'Compete in daily challenges for bonus rewards',
          rewards: ['BP'],
        },
      ];

      // Cache for 12 hours
      await redis.setex(cacheKey, 43200, JSON.stringify(events));
      return events;
    } catch (error) {
      logger.error(`Failed to fetch events: ${error}`);
      throw this.handleError(error);
    }
  }

  /**
   * Download and process telemetry data
   */
  async fetchTelemetry(telemetryUrl: string): Promise<ArrayBuffer> {
    try {
      const res = await this.throttler.execute(async () => {
        return axios.get<ArrayBuffer>(telemetryUrl, {
          responseType: 'arraybuffer',
          timeout: 30000,
        });
      });
      return res.data;
    } catch (error) {
      logger.error(`Failed to fetch telemetry: ${error}`);
      throw this.handleError(error);
    }
  }

  /**
   * Handle API errors with user-friendly messages
   */
  private handleError(error: any): Error {
    if (error.response?.status === 401) {
      return new Error('Unauthorized: Check your PUBG API key');
    } else if (error.response?.status === 404) {
      return new Error('Player or resource not found');
    } else if (error.response?.status === 429) {
      return new Error('Rate limit exceeded. Please try again later.');
    } else if (error.code === 'ECONNABORTED') {
      return new Error('Request timeout. PUBG API may be slow.');
    }
    return error;
  }

  private mapMatchResponse(response: any, playerId?: string): PUBGMatch | null {
    const match = response?.data;
    if (!match) return null;

    const included: PubgResource[] = response?.included || [];
    const participant = playerId
      ? included.find(
          (item) =>
            item.type === 'participant' && item.attributes?.stats?.playerId === playerId
        )
      : undefined;
    const roster = participant
      ? included.find((item) => {
          const participants = item.relationships?.participants?.data || [];
          return (
            item.type === 'roster' &&
            participants.some((entry: { id: string }) => entry.id === participant.id)
          );
        })
      : undefined;

    const participantStats = participant?.attributes?.stats || {};
    const rosterStats = roster?.attributes?.stats || {};

    return {
      ...match,
      attributes: {
        ...match.attributes,
        stats: playerId
          ? {
              ...participantStats,
              damageTaken: participantStats.damageTaken || 0,
              rank: rosterStats.rank || participantStats.winPlace || 0,
              survival_time: participantStats.timeSurvived || 0,
            }
          : match.attributes?.stats,
      },
    };
  }

  private aggregateGameModeStats(
    gameModeStats: Record<string, PubgGameModeStats>,
    season: string
  ): PlayerStats {
    const initialTotals: PubgAggregateStats = {
      damageDealt: 0,
      kills: 0,
      losses: 0,
      matches: 0,
      topTen: 0,
      wins: 0,
    };

    const totals = Object.values(gameModeStats).reduce((acc: PubgAggregateStats, stats: PubgGameModeStats) => {
      return {
        damageDealt: (acc.damageDealt || 0) + (stats.damageDealt || 0),
        kills: (acc.kills || 0) + (stats.kills || 0),
        losses: (acc.losses || 0) + (stats.losses || 0),
        matches: (acc.matches || 0) + (stats.roundsPlayed || 0),
        topTen: (acc.topTen || 0) + (stats.top10s || 0),
        wins: (acc.wins || 0) + (stats.wins || 0),
      };
    }, initialTotals);

    return {
      kills: totals.kills,
      wins: totals.wins,
      topTen: totals.topTen,
      matches: totals.matches,
      kdRatio: totals.losses > 0 ? totals.kills / totals.losses : totals.kills,
      winRate: totals.matches > 0 ? totals.wins / totals.matches : 0,
      avgDamage: totals.matches > 0 ? totals.damageDealt / totals.matches : 0,
      season,
      updatedAt: new Date(),
    };
  }

  private getLeaderboardShard(platform: string, region: string) {
    const configuredShard = process.env.PUBG_LEADERBOARD_SHARD;
    const normalizedRegion = region.toLowerCase();

    if (normalizedRegion.includes('-')) {
      return normalizedRegion;
    }

    if (normalizedRegion === 'global') {
      return configuredShard || (platform === 'steam' ? 'pc-as' : `${platform}-as`);
    }

    if (platform === 'steam') {
      const aliases: Record<string, string> = {
        asia: 'pc-as',
        as: 'pc-as',
        eu: 'pc-eu',
        europe: 'pc-eu',
        jp: 'pc-jp',
        japan: 'pc-jp',
        krjp: 'pc-krjp',
        korea: 'pc-krjp',
        na: 'pc-na',
        northamerica: 'pc-na',
        oc: 'pc-oc',
        oceania: 'pc-oc',
        ru: 'pc-ru',
        russia: 'pc-ru',
        sa: 'pc-sa',
        sea: 'pc-sea',
      };

      return aliases[normalizedRegion] || `pc-${normalizedRegion}`;
    }

    if (platform === 'psn' || platform === 'xbox') {
      return `${platform}-${normalizedRegion}`;
    }

    return platform;
  }
}

export default new PUBGClient();
