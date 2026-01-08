import mineflayer from 'mineflayer';
import { pathfinder, Movements, goals } from 'mineflayer-pathfinder';
const Vec3 = mineflayer.vec3 || ((x,y,z)=>({x,y,z}));
import { MovementEmulator } from './movement.js';

export function spawnBotsForServers(servers) {
  servers.forEach((server) => {
    const [host, portStr] = server.split(':').map(x => x.trim());
    const port = portStr ? parseInt(portStr, 10) : 25565;
    createBot({ host, port });
  });
}

function createBot({ host, port }) {
  const username = 'Core';
  const bot = mineflayer.createBot({
    host,
    port,
    username,
    auth: 'offline',
    // reduce load: tiny view distance (server must allow it)
    viewDistance: 'tiny'
  });

  bot.loadPlugin(pathfinder);

  bot.once('spawn', async () => {
    console.log(`Core spawned on ${host}:${port}`);

    // record spawn chunk
    const spawnPos = bot.entity.position.clone();
    const spawnChunkX = Math.floor(spawnPos.x / 16);
    const spawnChunkZ = Math.floor(spawnPos.z / 16);
    const chunkRadius = 1; // restrict to spawn chunks area; adjust if desired

    // set pathfinder movements to emulate a player (no block breaking)
    const defaultMove = new Movements(bot);
    defaultMove.canDig = false;
    defaultMove.scafoldingBlocks = []; // don't scaffold
    bot.pathfinder.setMovements(defaultMove);

    // Movement emulator will issue setGoal periodically and emulate controls via pathfinder.goto
    const emulator = new MovementEmulator(bot, { spawnChunkX, spawnChunkZ, chunkRadius });
    emulator.start();
  });

  bot.on('kicked', (reason) => console.log(`Core on ${host}:${port} kicked:`, reason));
  bot.on('error', (err) => console.log(`Core on ${host}:${port} error:`, err));
}
