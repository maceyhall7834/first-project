import 'dotenv/config';
import mineflayer from 'mineflayer';
import './keep_alive.js';

const BOT_NAME = 'Core';
const SERVER_LIST_RAW = (process.env.SERVER_LIST || '').trim();
if (!SERVER_LIST_RAW) {
  console.error('SERVER_LIST not set in .env (format: host[:port],host2[:port],...)');
  process.exit(1);
}

const servers = SERVER_LIST_RAW.split(',').map(s => s.trim()).filter(Boolean);

// Backoff parameters
const INITIAL_BACKOFF_MS = 2000;         // 2s
const MAX_BACKOFF_MS = 2 * 60 * 1000;    // 2 minutes
const JITTER_FACTOR = 0.2;               // ±20% multiplicative jitter

function createBotManagerFor(server) {
  const [hostRaw, portRaw] = server.split(':').map(x => x.trim());
  const host = hostRaw;
  const port = portRaw ? parseInt(portRaw, 10) : 25565;

  // Per-server state
  let retryCount = 0;
  let backoffTimer = null;

  function jitterMultiplier() {
    return 1 + (Math.random() * 2 - 1) * JITTER_FACTOR; // uniform in [1-J, 1+J]
  }

  function computeBackoffMs() {
    // Exponential base: INITIAL * 2^(retryCount-1) for retryCount>=1
    const expBase = INITIAL_BACKOFF_MS * Math.pow(2, Math.max(0, retryCount - 1));
    // Apply multiplicative jitter, then cap
    const jittered = Math.max(0, Math.round(expBase * jitterMultiplier()));
    return Math.min(jittered, MAX_BACKOFF_MS);
  }

  function scheduleReconnect() {
    if (backoffTimer) {
      clearTimeout(backoffTimer);
      backoffTimer = null;
    }
    const waitMs = computeBackoffMs();
    console.log(`${BOT_NAME} scheduling reconnect to ${host}:${port} in ${Math.round(waitMs / 1000)}s (retry #${retryCount})`);
    backoffTimer = setTimeout(() => {
      backoffTimer = null;
      spawnBot();
    }, waitMs);
  }

  function spawnBot() {
    const bot = mineflayer.createBot({
      host,
      port,
      username: BOT_NAME,
      version: process.env.MC_VERSION || '1.20.1',
    });

    bot.once('spawn', () => {
      console.log(`${BOT_NAME} spawned on ${host}:${port}`);
      retryCount = 0;
      if (backoffTimer) {
        clearTimeout(backoffTimer);
        backoffTimer = null;
      }
      bot._afkInterval = setInterval(() => {
        bot.look(Math.random() * Math.PI * 2, Math.random() * Math.PI - (Math.PI / 2)).catch(()=>{});
      }, 60000);
    });

    bot.on('end', () => {
      console.log(`${BOT_NAME} disconnected from ${host}:${port}`);
      clearInterval(bot._afkInterval);
      retryCount = Math.min(retryCount + 1, 30);
      scheduleReconnect();
    });

    bot.on('kicked', (reason) => {
      console.log(`${BOT_NAME} kicked from ${host}:${port}:`, reason);
      clearInterval(bot._afkInterval);
      retryCount = Math.min(retryCount + 1, 30);
      scheduleReconnect();
    });

    bot.on('error', (err) => {
      console.log(`${BOT_NAME} connection error to ${host}:${port}:`, err && err.message ? err.message : err);
      setTimeout(() => {
        if (bot._client && bot._client.socket && !bot._client.socket.destroyed) return;
        retryCount = Math.min(retryCount + 1, 30);
        if (!backoffTimer) scheduleReconnect();
      }, 500);
    });

    return bot;
  }

  // initial attempt
  spawnBot();

  return {
    server,
    getRetryCount: () => retryCount,
    getNextBackoffMs: () => computeBackoffMs(),
    cancelPendingReconnect: () => {
      if (backoffTimer) {
        clearTimeout(backoffTimer);
        backoffTimer = null;
      }
    },
  };
}

for (const s of servers) createBotManagerFor(s);
