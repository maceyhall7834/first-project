import { goals } from 'mineflayer-pathfinder';
import Vec3 from 'vec3';

export class MovementEmulator {
  constructor(bot, opts = {}) {
    this.bot = bot;
    this.spawnChunkX = opts.spawnChunkX;
    this.spawnChunkZ = opts.spawnChunkZ;
    this.chunkRadius = opts.chunkRadius || 1;
    this.running = false;
    this.loopDelayMin = 1000;
    this.loopDelayMax = 4000;
    this.moveRadiusBlocks = (this.chunkRadius * 2 + 1) * 8; // rough radius inside spawn area
    this.current = null;
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
    // pick a chunk within radius and a coordinate inside it
    const cx = this.spawnChunkX + Math.floor((Math.random() * (2 * this.chunkRadius + 1)) - this.chunkRadius);
    const cz = this.spawnChunkZ + Math.floor((Math.random() * (2 * this.chunkRadius + 1)) - this.chunkRadius);
    const x = (cx + 0.5) * 16 + (Math.random() * 10 - 5);
    const z = (cz + 0.5) * 16 + (Math.random() * 10 - 5);

    // sample Y from world near bot to avoid huge vertical goals
    const groundY = Math.max(1, Math.floor(this.bot.entity.position.y + (Math.random() * 3 - 1.5)));
    return new Vec3(x, groundY, z);
  }

  async _goto(position, radius = 1) {
    // Use pathfinder.goto to compute a path. This will move the bot using pathfinder controls.
    const GoalNear = goals.GoalNear;
    const goal = new GoalNear(position.x, position.y, position.z, radius);
    try {
      await this.bot.pathfinder.goto(goal);
    } catch (err) {
      // pathfinder rejects when stuck or path impossible; ignore and continue
    }
  }

  async _lookAround() {
    // perform a few look actions to simulate head movement
    for (let i = 0; i < 3; i++) {
      const yaw = Math.random() * Math.PI * 2 - Math.PI;
      const pitch = (Math.random() - 0.5) * 0.6;
      try { await this.bot.look(yaw, pitch, true); } catch {}
      await this._sleep(400 + Math.random() * 800);
    }
  }

  async _mainLoop() {
    while (this.running) {
      // pick behavior: stroll to a point or idle+look around
      const r = Math.random();
      if (r < 0.75) {
        const target = this._randomPointInSpawn();
        // choose a small radius so we don't path all the way across unnecessarily
        await this._goto(target, 1.2);
        await this._lookAround();
      } else {
        await this._lookAround();
        // occasionally walk a short distance with sprint/jump toggles handled by pathfinder heuristics
        if (Math.random() < 0.3) {
          const shortTarget = this._randomPointInSpawn();
          await this._goto(shortTarget, 1.2);
        }
      }
      // random pause between actions
      const pause = this.loopDelayMin + Math.random() * (this.loopDelayMax - this.loopDelayMin);
      await this._sleep(pause);
    }
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
