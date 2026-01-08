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

function createBotFor(server) {
  const [hostRaw, portRaw] = server.split(':').map(x => x.trim());
  const host = hostRaw;
  const port = portRaw ? parseInt(portRaw, 10) : 25565;

  const bot = mineflayer.createBot({
    host,
    port,
    username: BOT_NAME,
    version: process.env.MC_VERSION || '1.20.1',
  });

bot.once('spawn', () => {
  console.log(`${BOT_NAME} spawned on ${host}:${port}`);
  bot._afkInterval = setInterval(() => {
    bot.look(Math.random() * Math.PI * 2, Math.random() * Math.PI - (Math.PI / 2)).catch(()=>{});
  }, 60000);
});

  bot.on('end', () => {
    console.log(`${BOT_NAME} disconnected from ${host}:${port}`);
    clearInterval(bot._afkInterval);
    setTimeout(() => createBotFor(server), 2000 + Math.floor(Math.random() * 3000));
  });

  bot.on('kicked', (reason) => {
    console.log(`${BOT_NAME} kicked from ${host}:${port}:`, reason);
    clearInterval(bot._afkInterval);
  });

  bot.on('error', (err) => {
    console.log(`${BOT_NAME} connection error to ${host}:${port}:`, err && err.message ? err.message : err);
  });

  return bot;
}

for (const s of servers) createBotFor(s);
