require('dotenv').config();

const { logError } = require('./utils/errorBuffer');

process.on('unhandledRejection', (err) => {
  logError(err);
  console.error('Unhandled Rejection:', err);
});

process.on('uncaughtException', (err) => {
  logError(err);
  console.error('Uncaught Exception:', err);
});

const client = require('./client');
const { registerEvents } = require('./events/ready');
const { registerGuildMemberAdd } = require('./events/guildMemberAdd');
const { registerMessageCreate } = require('./events/messageCreate');
const { registerMessageReactionAdd } = require('./events/messageReactionAdd');
const { registerMessageReactionRemove } = require('./events/messageReactionRemove');
const { registerInteractionCreate } = require('./events/interactionCreate');

registerEvents(client);
registerGuildMemberAdd(client);
registerMessageCreate(client);
registerMessageReactionAdd(client);
registerMessageReactionRemove(client);
registerInteractionCreate(client);

client.login(process.env.DISCORD_TOKEN);
