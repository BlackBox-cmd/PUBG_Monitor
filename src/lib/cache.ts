import { getDb } from '../db/mongo';
import * as logger from '../utils/logger';

class Cache {
  private listeners: { [channel: string]: ((channel: string, message: string) => void)[] } = {};
  private polling = false;
  private lastPollTime = new Date();

  constructor() {
    // Lazily initialized when database connects
  }

  private async getCollection(name: 'cache' | 'pubsub') {
    const db = await getDb();
    if (!db.db) {
      throw new Error('MongoDB native database instance is not available');
    }
    const col = db.db.collection(name);
    try {
      if (name === 'cache') {
        await col.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
      } else if (name === 'pubsub') {
        await col.createIndex({ createdAt: 1 }, { expireAfterSeconds: 3600 });
      }
    } catch (error) {
      logger.warn(`Non-critical error creating MongoDB index on ${name}: ${error}`);
    }
    return col;
  }

  async get(key: string): Promise<string | null> {
    try {
      const col = await this.getCollection('cache');
      const doc = await col.findOne({ key });
      if (!doc) return null;
      if (doc.expiresAt && new Date(doc.expiresAt) < new Date()) {
        await col.deleteOne({ key });
        return null;
      }
      return doc.value;
    } catch (error) {
      logger.warn(`MongoDB cache get error: ${error}`);
      return null;
    }
  }

  async set(key: string, value: string): Promise<any> {
    try {
      const col = await this.getCollection('cache');
      return await col.updateOne(
        { key },
        { $set: { key, value, updatedAt: new Date() }, $unset: { expiresAt: "" } },
        { upsert: true }
      );
    } catch (error) {
      logger.warn(`MongoDB cache set error: ${error}`);
      return null;
    }
  }

  async setex(key: string, seconds: number, value: string): Promise<any> {
    try {
      const col = await this.getCollection('cache');
      const expiresAt = new Date(Date.now() + seconds * 1000);
      return await col.updateOne(
        { key },
        { $set: { key, value, expiresAt, updatedAt: new Date() } },
        { upsert: true }
      );
    } catch (error) {
      logger.warn(`MongoDB cache setex error: ${error}`);
      return null;
    }
  }

  async subscribe(channel: string) {
    try {
      if (!this.listeners[channel]) {
        this.listeners[channel] = [];
      }
      // Start polling loop if not already polling
      if (!this.polling) {
        this.polling = true;
        this.startPolling();
      }
      logger.info(`Subscribed to MongoDB pubsub channel: ${channel}`);
    } catch (error) {
      logger.warn(`MongoDB subscribe error: ${error}`);
      throw error;
    }
  }

  on(event: 'message', listener: (channel: string, message: string) => void) {
    const channel = 'pubg:match:process'; // Default telemetry channel
    if (!this.listeners[channel]) {
      this.listeners[channel] = [];
    }
    this.listeners[channel].push(listener);
    return this;
  }

  async publish(channel: string, message: string) {
    try {
      const col = await this.getCollection('pubsub');
      await col.insertOne({
        channel,
        message,
        createdAt: new Date()
      });
    } catch (error) {
      logger.warn(`MongoDB publish error: ${error}`);
    }
  }

  private async startPolling() {
    while (this.polling) {
      try {
        const col = await this.getCollection('pubsub');
        const messages = await col
          .find({
            createdAt: { $gt: this.lastPollTime }
          })
          .sort({ createdAt: 1 })
          .toArray();

        if (messages.length > 0) {
          this.lastPollTime = messages[messages.length - 1].createdAt;
          for (const msg of messages) {
            const list = this.listeners[msg.channel];
            if (list) {
              for (const listener of list) {
                try {
                  await listener(msg.channel, msg.message);
                } catch (e) {
                  logger.error(`Error in pubsub message listener: ${e}`);
                }
              }
            }
          }
        }
      } catch (error) {
        logger.warn(`MongoDB pubsub poll error: ${error}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

const redis = new Cache();

export default redis;

