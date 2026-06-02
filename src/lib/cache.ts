import Redis from 'ioredis';
import * as logger from '../utils/logger';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const MAX_REDIS_RETRIES = Number(process.env.REDIS_MAX_RETRIES || 3);
const REDIS_DISPLAY_URL = getRedisDisplayUrl(REDIS_URL);

function getRedisDisplayUrl(redisUrl: string) {
  try {
    const parsed = new URL(redisUrl);
    if (parsed.password) {
      parsed.password = '***';
    }
    return parsed.toString();
  } catch {
    return redisUrl;
  }
}

class Cache {
  private client = new Redis(REDIS_URL, {
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
      if (times > MAX_REDIS_RETRIES) {
        return null;
      }
      return Math.min(times * 1000, 5000);
    },
  });

  private warnedUnavailable = false;

  constructor() {
    this.client.on('ready', () => {
      this.warnedUnavailable = false;
      logger.info('Connected to Redis');
    });

    this.client.on('end', () => {
      logger.warn('Redis connection closed');
    });

    this.client.on('error', (error) => {
      this.warnUnavailable(error);
    });
  }

  async get(key: string) {
    try {
      return await this.client.get(key);
    } catch (error) {
      this.warnUnavailable(error);
      return null;
    }
  }

  async set(key: string, value: string) {
    try {
      return await this.client.set(key, value);
    } catch (error) {
      this.warnUnavailable(error);
      return null;
    }
  }

  async setex(key: string, seconds: number, value: string) {
    try {
      return await this.client.setex(key, seconds, value);
    } catch (error) {
      this.warnUnavailable(error);
      return null;
    }
  }

  async subscribe(channel: string) {
    try {
      return await this.client.subscribe(channel);
    } catch (error) {
      this.warnUnavailable(error);
      throw new Error(`Redis is unavailable; cannot subscribe to ${channel}`);
    }
  }

  on(event: 'message', listener: (channel: string, message: string) => void) {
    return this.client.on(event, listener);
  }

  private warnUnavailable(error: unknown) {
    if (this.warnedUnavailable) return;
    this.warnedUnavailable = true;

    const message = error instanceof Error ? error.message : String(error);
    logger.warn(
      `Redis unavailable at ${REDIS_DISPLAY_URL}. Cache is disabled until Redis is reachable. ${message}`
    );
  }
}

const redis = new Cache();

export default redis;
