const store = require('../store');
const { saveGiveaway } = require('../services/giveawayService');

function registerMessageReactionAdd(client) {
  client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot || reaction.emoji.name !== '🎉') return;

    const giveawayId = Object.keys(store.giveaways).find(
      id => store.giveaways[id].messageId === reaction.message.id
    );
    if (!giveawayId) return;

    const giveaway = store.giveaways[giveawayId];
    if (!giveaway.participants.includes(user.id)) {
      giveaway.participants.push(user.id);
      await saveGiveaway(giveaway);
    }
  });
}

module.exports = { registerMessageReactionAdd };
