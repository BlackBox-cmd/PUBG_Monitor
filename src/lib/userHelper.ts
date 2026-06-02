import { User, IUser, Player, BattleCoins, IBattleCoins } from '../db/models';
import * as logger from '../utils/logger';
import { Platform } from '../types/pubg';

/**
 * Get a user's PUBG account information from Discord ID
 * @param discordId - Discord user ID
 * @returns User document or null if not registered
 */
export async function getUserFromDb(
  discordId: string
): Promise<IUser | null> {
  try {
    const user = await User.findOne({ discordId });
    return user;
  } catch (error) {
    logger.error(`Error retrieving user ${discordId}: ${error}`);
    return null;
  }
}

/**
 * Register a Discord user with a PUBG player account
 * @param discordId - Discord user ID
 * @param discordUsername - Discord username
 * @param pubgPlayerId - PUBG player ID (from API)
 * @param pubgPlayerName - PUBG player name
 * @param platform - Platform (default: steam)
 * @returns Created or updated user document
 */
export async function registerUser(
  discordId: string,
  discordUsername: string,
  pubgPlayerId: string,
  pubgPlayerName: string,
  platform: Platform = 'steam'
): Promise<IUser> {
  try {
    const user = await User.findOneAndUpdate(
      { discordId },
      {
        discordId,
        discordUsername,
        pubgPlayerId,
        pubgPlayerName,
        platform,
        verified: true,
        updatedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    logger.info(
      `Registered user ${discordUsername} with PUBG account ${pubgPlayerName}`
    );
    return user;
  } catch (error) {
    logger.error(`Error registering user ${discordId}: ${error}`);
    throw error;
  }
}

/**
 * Unregister a Discord user from their PUBG account
 * @param discordId - Discord user ID
 * @returns Deleted user count
 */
export async function unregisterUser(discordId: string): Promise<number> {
  try {
    const result = await User.deleteOne({ discordId });
    logger.info(`Unregistered user ${discordId}`);
    return result.deletedCount || 0;
  } catch (error) {
    logger.error(`Error unregistering user ${discordId}: ${error}`);
    throw error;
  }
}

/**
 * Initialize BattleCoins for a new user
 * @param discordId - Discord user ID
 * @returns Created or existing BattleCoins document
 */
export async function initializeBattleCoins(
  discordId: string
): Promise<IBattleCoins> {
  try {
    let coins = await BattleCoins.findOne({ discordId });

    if (!coins) {
      coins = await BattleCoins.create({
        discordId,
        balance: 0,
        totalEarned: 0,
        totalSpent: 0,
        transactions: [],
      });
      logger.info(`Initialized BattleCoins for user ${discordId}`);
    }

    return coins;
  } catch (error) {
    logger.error(`Error initializing BattleCoins for ${discordId}: ${error}`);
    throw error;
  }
}

/**
 * Get user's BattleCoins balance
 * @param discordId - Discord user ID
 * @returns Current balance or 0 if not found
 */
export async function getUserBalance(discordId: string): Promise<number> {
  try {
    const coins = await BattleCoins.findOne({ discordId });
    return coins?.balance || 0;
  } catch (error) {
    logger.error(`Error retrieving balance for ${discordId}: ${error}`);
    return 0;
  }
}

/**
 * Get the full BattleCoins wallet for a user
 * @param discordId - Discord user ID
 * @returns BattleCoins document or null if not found
 */
export async function getBattleCoinsForUser(
  discordId: string
): Promise<IBattleCoins | null> {
  try {
    const coins = await BattleCoins.findOne({ discordId });
    return coins;
  } catch (error) {
    logger.error(`Error retrieving BattleCoins wallet for ${discordId}: ${error}`);
    return null;
  }
}

/**
 * Check whether a BattleCoins transaction already exists for a match and reason.
 */
export async function hasBattleCoinsTransaction(
  discordId: string,
  matchId: string,
  reason: string
): Promise<boolean> {
  try {
    const coins = await BattleCoins.findOne({
      discordId,
      transactions: {
        $elemMatch: { relatedMatchId: matchId, reason },
      },
    });
    return !!coins;
  } catch (error) {
    logger.error(`Error checking BattleCoins transaction for ${discordId}: ${error}`);
    return false;
  }
}

/**
 * Add BattleCoins to user (for rewards/bonuses)
 * @param discordId - Discord user ID
 * @param amount - Amount to add
 * @param reason - Reason for earning (e.g., 'match_completion', 'win_bonus')
 * @param relatedMatchId - Optional match ID if related to a match
 * @returns Updated BattleCoins document
 */
export async function addBattleCoins(
  discordId: string,
  amount: number,
  reason: string,
  relatedMatchId?: string
): Promise<IBattleCoins | null> {
  try {
    const coins = await BattleCoins.findOneAndUpdate(
      { discordId },
      {
        $inc: {
          balance: amount,
          totalEarned: amount,
        },
        $push: {
          transactions: {
            type: 'earn',
            amount,
            reason,
            relatedMatchId,
            timestamp: new Date(),
          },
        },
      },
      { new: true }
    );

    if (!coins) {
      logger.error(`BattleCoins record not found for ${discordId}`);
      return null;
    }

    logger.info(
      `Added ${amount} BattleCoins to ${discordId} (${reason}). New balance: ${coins.balance}`
    );
    return coins;
  } catch (error) {
    logger.error(`Error adding BattleCoins to ${discordId}: ${error}`);
    throw error;
  }
}

/**
 * Spend BattleCoins (if implemented in future)
 * @param discordId - Discord user ID
 * @param amount - Amount to spend
 * @param reason - Reason for spending
 * @returns Updated BattleCoins document or null if insufficient balance
 */
export async function spendBattleCoins(
  discordId: string,
  amount: number,
  reason: string
): Promise<IBattleCoins | null> {
  try {
    const coins = await BattleCoins.findOne({ discordId });

    if (!coins || coins.balance < amount) {
      logger.error(
        `Insufficient BattleCoins for ${discordId}. Required: ${amount}, Available: ${coins?.balance || 0}`
      );
      return null;
    }

    const updated = await BattleCoins.findOneAndUpdate(
      { discordId },
      {
        $inc: {
          balance: -amount,
          totalSpent: amount,
        },
        $push: {
          transactions: {
            type: 'spend',
            amount,
            reason,
            timestamp: new Date(),
          },
        },
      },
      { new: true }
    );

    logger.info(
      `Spent ${amount} BattleCoins from ${discordId} (${reason}). New balance: ${updated?.balance}`
    );
    return updated;
  } catch (error) {
    logger.error(`Error spending BattleCoins for ${discordId}: ${error}`);
    throw error;
  }
}
