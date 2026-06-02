import mongoose from 'mongoose';
import * as logger from '../utils/logger';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/pubg';

let isConnected = false;

/**
 * Connect to MongoDB using Mongoose
 * Initializes all data models on first connection
 */
export async function connectMongo(): Promise<void> {
  if (isConnected) {
    logger.info('MongoDB already connected');
    return;
  }

  try {
    await mongoose.connect(MONGO_URI);
    isConnected = true;
    logger.info('Connected to MongoDB with Mongoose');

    // Import models to initialize schemas
    await import('./models');
    logger.info('Mongoose models initialized');
  } catch (error) {
    logger.error(`Failed to connect to MongoDB: ${error}`);
    throw error;
  }
}

/**
 * Legacy function for compatibility with existing code
 * Returns mongoose connection
 */
export async function getDb() {
  if (!isConnected) {
    await connectMongo();
  }
  return mongoose.connection;
}

/**
 * Close MongoDB connection
 */
export async function closeDb(): Promise<void> {
  try {
    await mongoose.disconnect();
    isConnected = false;
    logger.info('MongoDB connection closed');
  } catch (error) {
    logger.error(`Error closing MongoDB connection: ${error}`);
    throw error;
  }
}
