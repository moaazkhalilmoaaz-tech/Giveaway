const store = require('../store');
const { loadGiveaways, endGiveaway } = require('../services/giveawayService');
const { loadGreetSettings } = require('../services/greetService');
const { loadLuckSettings } = require('../services/luckService');

function registerEvents(client) {
  client.once('ready', async () => {
    console.log(`Bot is ready: ${client.user.tag}`);

    await loadGiveaways();
    await loadGreetSettings();
    await loadLuckSettings();

    const endingGiveaways = new Set();

    setInterval(() => {
      const now = Date.now();
      for (const [giveawayId, giveaway] of Object.entries(store.giveaways)) {
        if (now >= new Date(giveaway.endtime).getTime()) {
          if (endingGiveaways.has(giveawayId)) continue;
          endingGiveaways.add(giveawayId);
          endGiveaway(client, giveawayId).finally(() => {
            endingGiveaways.delete(giveawayId);
          });
        }
      }
    }, 5000);
  });
}

module.exports = { registerEvents };