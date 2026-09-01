const store = require('../store');
const { scheduleGreetMessageDeletion } = require('../services/greetService');

function registerGuildMemberAdd(client) {
  client.on('guildMemberAdd', async (member) => {
    const settings = store.greetSettings[member.guild.id];
    if (!settings || !settings.channels || settings.channels.length === 0 || !settings.message) return;

    const welcomeMessage = settings.message
      .replace(/{mention}/g, `<@${member.id}>`)
      .replace(/{username}/g, member.user.username);

    for (const channelId of settings.channels) {
      const channel = member.guild.channels.cache.get(channelId);
      if (!channel) continue;

      try {
        const sentMessage = await channel.send(welcomeMessage);
        scheduleGreetMessageDeletion(sentMessage, settings.delete_time);
      } catch (error) {
        console.error('Error sending greet message:', error);
      }
    }
  });
}

module.exports = { registerGuildMemberAdd };
