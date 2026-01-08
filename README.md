Usage:
1. npm install
2. Edit .env: SERVER_LIST=host1,host2,...
3. npm start

Behavior:
- Spawns one offline bot named "Core" per server listed in SERVER_LIST.
- Each bot restricts movement to the spawn-chunk area (small radius).
- Uses mineflayer-pathfinder (bot.pathfinder.goto) to emulate realistic player controls.
- keep_alive.js starts an HTTP server on port 8080.
