const Eris = require("eris");
const keep_alive = require('./keep_alive.js');

// Replace TOKEN with your bot account's token
const bot = new Eris(process.env.token);

bot.on("error", (err) => {
  console.error(err); // or your preferred logger
});

bot.on("ready", () => {
  console.log(`Logged in as ${bot.user.username}#${bot.user.discriminator}`);
  
  // Set the bot's presence to "Idle" and "Playing Minecraft"
  bot.editStatus("idle", {
    name: "Minecraft",
    type: 0 // 0 means "Playing"
  });
});

bot.connect(); // Get the bot to connect to Discord
