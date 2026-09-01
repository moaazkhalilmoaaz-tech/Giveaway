const store = {
  giveaways: {},      // { [id]: giveaway }
  greetSettings: {},  // { [guildId]: settings }
  luckSettings: {},   // { [guildId]: { [roleId]: weight } }
};

module.exports = store;