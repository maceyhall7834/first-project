import './keep_alive.js';
import dotenv from 'dotenv';
import { spawnBotsForServers } from './bot.js';

dotenv.config();

const serversRaw = (process.env.SERVER_LIST || '').trim();
if (!serversRaw) {
  console.error('No servers specified in .env (SERVER_LIST).');
  process.exit(1);
}

const servers = serversRaw.split(',').map(s => s.trim()).filter(Boolean);

// Spawn a single offline bot named exactly "Core" onto each server in the list.
spawnBotsForServers(servers);
