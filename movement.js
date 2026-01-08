import { goals } from 'mineflayer-pathfinder';

// Helper to create Vec3 using mineflayer's vec3 if available, otherwise plain object.
function makeVec3(bot, x, y, z) {
  if (bot && bot.vec3) {
    return bot.vec3(x, y, z);
  }
  return { x, y, z };
}

export class MovementEmulator {
  constructor(bot, opts = {}) {
    this.bot = bot;
    this.spawnChunkX = opts.spawnChunkX;
    this.spawnChunkZ = opts.spawnChunkZ;
    this.chunkRadius = opts.chunkRadius || 1;
    this.running = false;
    this.loopDelayMin = 1000;
    this.loopDelayMax = 4000;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._mainLoop();
  }

  stop() {
    this.running = false;
    try { this.bot.pathfinder.setGoal(null); } catch {}
  }

  _randomPointInSpawn() {
    const cx = this.spawnChunkX + Math.floor((Math.random() * (2 * this.chunkRadius + 1)) - this.chunkRadius);
    const cz = this.spawnChunkZ + Math.floor((Math.random() * (2 * this.chunkRadius + 1)) - this.chunkRadius);
    const x = (cx + 0.5) * 16 + (Math.random() * 10 - 5);
    const z = (cz + 0.5) * 16 + (Math.random() * 10 - 5);

    // sample Y near current position to avoid unreasonable vertical goals
    const y = Math.max(1, Math.floor(this.bot.entity.position.y + (Math.random() * 3 - 1.5)));
    return makeVec3(this.bot, x, y, z);
  }

  async _goto(position, radius = 1) {
    const GoalNear = goals.GoalNear;
    const goal = new GoalNear(position.x, position.y, position.z, radius);
    try {
      await this.bot.pathfinder.goto(goal);
    } catch (err) {
      // ignore path errors/stuck states
    }
  }

  async _lookAround() {
    for (let i = 0; i < 3; i++) {
      const yaw = Math.random() * Math.PI * 2 - Math.PI;
      const pitch = (Math.random() - 0.5) * 0.6;
      try { await this.bot.look(yaw, pitch, true); } catch {}
      await this._sleep(400 + Math.random() * 800);
    }
  }

  async _mainLoop() {
    while (this.running) {
      const r = Math.random();
      if (r < 0.75) {
        const target = this._randomPointInSpawn();
        await this._goto(target, 1.2);
        await this._lookAround();
      } else {
        await this._lookAround();
        if (Math.random() < 0.3) {
          const shortTarget = this._randomPointInSpawn();
          await this._goto(shortTarget, 1.2);
        }
      }
      const pause = this.loopDelayMin + Math.random() * (this.loopDelayMax - this.loopDelayMin);
      await this._sleep(pause);
    }
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
