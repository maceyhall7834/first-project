import './keep_alive.js';
import dotenv from 'dotenv';
import mineflayer from 'mineflayer';
import mcDataLib from 'minecraft-data';

dotenv.config();

const serversRaw = (process.env.SERVER_LIST || '').trim();
if (!serversRaw) {
  console.error('SERVER_LIST not set in .env');
  process.exit(1);
}
const servers = serversRaw.split(',').map(s => s.trim()).filter(Boolean);

// Settings
const BOT_NAME = 'Core'; // fixed name
const MC_VERSION = '1.12.2'; // mineflayer uses minecraft-data keys; 1.12.2 matches 1.12.x clients
const SPAWN_CHUNK_RADIUS = 1; // radius in chunks (1 = 3x3 chunks); adjust if desired
const CONTROL_INTERVAL_MS = 250; // how often we update controls

// Shared synchronized movement plan: pick a target and every bot follows same controls timing to save CPU
let globalPlan = {
  nextChangeAt: Date.now(),
  actions: {} // { forward:bool, back:bool, left:bool, right:bool, jump:bool, sneak:bool, look: { yaw, pitch } }
};

function randomActionSet() {
  // random realistic key presses with occasional sprint/jump toggles
  const dirChance = Math.random();
  const actions = { forward: false, back: false, left: false, right: false, jump: false, sneak: false, look: null };
  if (dirChance < 0.6) actions.forward = true;
  else if (dirChance < 0.75) actions.left = true;
  else if (dirChance < 0.9) actions.right = true;
  else actions.back = true;

  // occasional combined strafing
  if (Math.random() < 0.12) {
    actions.left = Math.random() < 0.5;
    actions.right = !actions.left && Math.random() < 0.5;
  }

  // occasional jump/sneak
  actions.jump = Math.random() < 0.08;
  actions.sneak = Math.random() < 0.06;

  // random look jitter
  actions.look = { yaw: (Math.random() - 0.5) * 0.8, pitch: (Math.random() - 0.5) * 0.3 };
  return actions;
}

function scheduleNextPlan() {
  const dur = 1000 + Math.floor(Math.random() * 3000); // 1-4s per action set
  globalPlan.nextChangeAt = Date.now() + dur;
  globalPlan.actions = randomActionSet();
}

// initialize plan
scheduleNextPlan();

// Create one bot per server
for (const server of servers) {
  const [hostRaw, portRaw] = server.split(':').map(x => x.trim());
  const host = hostRaw;
  const port = portRaw ? parseInt(portRaw, 10) : 25565;

  const bot = mineflayer.createBot({
    host,
    port,
    username: BOT_NAME,
    auth: 'offline',
    version: MC_VERSION
  });

  const mcData = mcDataLib(MC_VERSION);

  bot.once('spawn', () => {
    console.log(`Core spawned on ${host}:${port}`);
    // record spawn chunk
    const spawnPos = bot.entity.position;
    const spawnChunkX = Math.floor(spawnPos.x / 16);
    const spawnChunkZ = Math.floor(spawnPos.z / 16);
    bot._spawnChunkArea = { spawnChunkX, spawnChunkZ };
    bot._lastControlTime = Date.now();

    // control loop for this bot using the globalPlan (synchronized)
    const controlLoop = setInterval(() => {
      if (!bot.entity) return;
      // update global plan if time
      if (Date.now() >= globalPlan.nextChangeAt) scheduleNextPlan();

      const act = globalPlan.actions;

      // compute a candidate movement target position (ensure inside spawn chunks)
      // If the bot is about to walk outside spawn chunk bounds, invert movement direction.
      const pos = bot.entity.position;
      const chunkX = Math.floor(pos.x / 16);
      const chunkZ = Math.floor(pos.z / 16);
      const { spawnChunkX, spawnChunkZ } = bot._spawnChunkArea;
      const dxChunks = chunkX - spawnChunkX;
      const dzChunks = chunkZ - spawnChunkZ;

      // If bot is at edge of allowed radius, block movement that increases distance
      const r = SPAWN_CHUNK_RADIUS;
      const blocked = { forward: false, back: false, left: false, right: false };

      // estimate direction relative to bot yaw: forward increases z when yaw near 0; to keep it simple, use position checks:
      if (dxChunks > r) { /* too far +X */ blocked.right = true; }
      if (dxChunks < -r) { /* too far -X */ blocked.left = true; }
      if (dzChunks > r) { /* too far +Z */ blocked.forward = true; }
      if (dzChunks < -r) { /* too far -Z */ blocked.back = true; }

      // apply controls but respect blocked directions
      bot.setControlState('forward', act.forward && !blocked.forward);
      bot.setControlState('back', act.back && !blocked.back);
      bot.setControlState('left', act.left && !blocked.left);
      bot.setControlState('right', act.right && !blocked.right);
      bot.setControlState('jump', act.jump);
      bot.setControlState('sneak', act.sneak);

      // small look jitter around current view
      const yaw = (bot.entity.yaw || 0) + act.look.yaw;
      const pitch = (bot.entity.pitch || 0) + act.look.pitch;
      bot.look(yaw, pitch, true).catch(()=>{});
    }, CONTROL_INTERVAL_MS);

    bot.on('end', () => {
      clearInterval(controlLoop);
      console.log(`Core disconnected from ${host}:${port}`);
    });
    bot.on('kicked', (reason) => {
      clearInterval(controlLoop);
      console.log(`Core kicked from ${host}:${port}:`, reason);
    });
    bot.on('error', (err) => {
      clearInterval(controlLoop);
      console.log(`Core error on ${host}:${port}:`, err);
    });
  });

  bot.on('error', (err) => {
    console.log(`Core connection error to ${host}:${port}:`, err.message || err);
  });
}
