const store = require('../store');
const { saveGiveaway } = require('../services/giveawayService');

function registerMessageReactionRemove(client) {
  client.on('messageReactionRemove', async (reaction, user) => {
    if (user.bot || reaction.emoji.name !== '🎉') return;

    const giveawayId = Object.keys(store.giveaways).find(
      id => store.giveaways[id].messageId === reaction.message.id
    );
    if (!giveawayId) return;

    const giveaway = store.giveaways[giveawayId];
    giveaway.participants = giveaway.participants.filter(id => id !== user.id);
    await saveGiveaway(giveaway);
  });
}

module.exports = { registerMessageReactionRemove };