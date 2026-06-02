import zlib from 'zlib';
import { default as redis } from '../lib/cache';
import pubgClient from '../api/pubgClient';
import { User } from '../db/models';
import { addBattleCoins, hasBattleCoinsTransaction } from '../lib/userHelper';
import { getDb } from '../db/mongo';
import { startUptimeHeartbeat } from '../utils/uptime';

const PLATFORM = process.env.PUBG_PLATFORM || 'steam';
const PROCESS_CHANNEL = 'pubg:match:process';

async function fetchTelemetryJson(url: string) {
  const bytes = await pubgClient.fetchTelemetry(url);
  const decompressed = zlib.gunzipSync(Buffer.from(bytes));
  return JSON.parse(decompressed.toString('utf8'));
}

async function saveTelemetry(matchId: string, telemetry: any) {
  const db = await getDb();
  const collection = db.collection('telemetry');
  await collection.updateOne(
    { matchId },
    { $set: { matchId, telemetry, updatedAt: new Date() } },
    { upsert: true }
  );
}

function extractPlayerIdsFromMatchDetails(matchDetails: any): string[] {
  if (!matchDetails?.included) return [];
  const ids: string[] = [];
  for (const item of matchDetails.included) {
    if (item.type === 'participant' && item.attributes?.stats?.playerId) {
      ids.push(item.attributes.stats.playerId);
    }
    if (item.type === 'participant' && item.attributes?.playerId) {
      ids.push(item.attributes.playerId);
    }
  }
  return [...new Set(ids)];
}

async function awardBattleCoinsForMatch(matchId: string, platform: string) {
  const matchDetails = await pubgClient.getMatchDetails(platform, matchId);
  if (!matchDetails) return;

  const playerIds = extractPlayerIdsFromMatchDetails(matchDetails);
  if (playerIds.length === 0) return;

  const registeredPlayers = await User.find({ pubgPlayerId: { $in: playerIds } });
  if (!registeredPlayers || registeredPlayers.length === 0) return;

  for (const user of registeredPlayers) {
    const alreadyAwarded = await hasBattleCoinsTransaction(
      user.discordId,
      matchId,
      'match_completion'
    );
    if (alreadyAwarded) {
      continue;
    }

    const matches = await pubgClient.getPlayerMatches(platform, user.pubgPlayerId, 20);
    const match = matches.find((entry) => entry.id === matchId);
    if (!match) continue;

    const stats: any = match.attributes?.stats || {};
    const kills = stats.kills || 0;
    const rank = stats.rank || 0;
    const baseReward = 10;
    const winBonus = rank === 1 ? 20 : 0;
    const topTenBonus = rank > 0 && rank <= 10 ? 10 : 0;
    const killBonus = kills * 2;
    const totalReward = baseReward + winBonus + topTenBonus + killBonus;

    await addBattleCoins(user.discordId, totalReward, 'match_completion', matchId);
  }
}

export async function processMatch(matchId: string, platform = PLATFORM) {
  console.log(`Processing match ${matchId} on ${platform}`);
  const matchData = await pubgClient.getMatchById(platform, matchId);
  const telemetryUrl = (matchData?.attributes as any)?.telemetryUrl;
  if (!telemetryUrl) {
    throw new Error(`Telemetry URL missing for match ${matchId}`);
  }

  const telemetry = await fetchTelemetryJson(telemetryUrl);
  await saveTelemetry(matchId, telemetry);
  await awardBattleCoinsForMatch(matchId, platform);
  console.log(`Saved telemetry for match ${matchId}`);
  return { matchId, telemetry };
}

export async function startTelemetryWorker() {
  console.log('Telemetry worker starting');
  await getDb();
  await redis.subscribe(PROCESS_CHANNEL);
  console.log(`Subscribed to ${PROCESS_CHANNEL}`);

  // Start heartbeat for the telemetry worker
  startUptimeHeartbeat('Worker');

  redis.on('message', async (_channel, message) => {
    try {
      const payload = JSON.parse(message) as { matchId: string; platform?: string };
      if (!payload.matchId) {
        console.warn('Received process message without matchId', message);
        return;
      }
      await processMatch(payload.matchId, payload.platform);
    } catch (error) {
      console.error('Telemetry worker error', error);
    }
  });
}

if (require.main === module) {
  startTelemetryWorker().catch((e) => console.error(e));
}
