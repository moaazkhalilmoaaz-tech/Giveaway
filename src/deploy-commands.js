require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
  // ─── Giveaway ───
  new SlashCommandBuilder()
    .setName('gstart')
    .setDescription('Start a new giveaway')
    .addStringOption(o => o.setName('time').setDescription('Duration (e.g. 1h, 30m, 1d)').setRequired(true))
    .addIntegerOption(o => o.setName('winners').setDescription('Number of winners').setRequired(true).setMinValue(1))
    .addStringOption(o => o.setName('prize').setDescription('Giveaway prize').setRequired(true))
    .addBooleanOption(o => o.setName('luck').setDescription('Enable extra luck for lucky roles? (default: true)').setRequired(false)),

  new SlashCommandBuilder()
    .setName('gend')
    .setDescription('End a giveaway manually')
    .addStringOption(o => o.setName('message_id').setDescription('Giveaway message ID').setRequired(true)),

  new SlashCommandBuilder()
    .setName('glist')
    .setDescription('Show active giveaways')
    .addIntegerOption(o => o.setName('page').setDescription('Page number').setRequired(false)),

  new SlashCommandBuilder()
    .setName('greroll')
    .setDescription('Reroll winners for an ended giveaway')
    .addStringOption(o => o.setName('message_id').setDescription('Giveaway message ID').setRequired(true)),

  // ─── Extra Luck ───
  new SlashCommandBuilder()
    .setName('gluck')
    .setDescription('Manage extra luck roles for giveaways')
    .addSubcommand(s =>
      s.setName('add')
        .setDescription('Add a role with a luck multiplier')
        .addRoleOption(o => o.setName('role').setDescription('The role to boost').setRequired(true))
        .addNumberOption(o => o.setName('multiplier').setDescription('Luck multiplier (1.5 - 10)').setRequired(true).setMinValue(1.1).setMaxValue(10))
    )
    .addSubcommand(s =>
      s.setName('remove')
        .setDescription('Remove a luck role')
        .addRoleOption(o => o.setName('role').setDescription('The role to remove').setRequired(true))
    )
    .addSubcommand(s => s.setName('list').setDescription('Show all luck roles and their multipliers'))
    .addSubcommand(s => s.setName('clear').setDescription('Remove all luck roles'))
    .addSubcommand(s => s.setName('me').setDescription('Check your current luck multiplier')),

  new SlashCommandBuilder()
    .setName('gtop')
    .setDescription('Show the giveaway winners leaderboard'),

  // ─── Greet ───
  new SlashCommandBuilder()
    .setName('greet')
    .setDescription('Manage greeting settings')
    .addSubcommand(s => s.setName('toggle').setDescription('Add/remove current channel as greeting channel'))
    .addSubcommand(s =>
      s.setName('set')
        .setDescription('Set custom greeting message')
        .addStringOption(o => o.setName('message').setDescription('Message text. Use {mention} and {username}').setRequired(true))
    )
    .addSubcommand(s =>
      s.setName('time')
        .setDescription('Set auto-delete time for greet messages')
        .addStringOption(o => o.setName('duration').setDescription('e.g. 5s, 10m, 1h').setRequired(true))
    )
    .addSubcommand(s => s.setName('reset').setDescription('Remove all greeting channels'))
    .addSubcommand(s => s.setName('clear').setDescription('Reset all greeting settings'))
    .addSubcommand(s => s.setName('test').setDescription('Send a test greeting'))
    .addSubcommand(s => s.setName('stats').setDescription('Show current greeting settings')),

  // ─── Profile ───
  new SlashCommandBuilder()
    .setName('setavatar')
    .setDescription('Set the bot server avatar')
    .addStringOption(o => o.setName('url').setDescription('Direct image URL').setRequired(true)),

  new SlashCommandBuilder()
    .setName('setbanner')
    .setDescription('Set the bot server banner')
    .addStringOption(o => o.setName('url').setDescription('Direct image URL').setRequired(true)),

  new SlashCommandBuilder()
    .setName('resetprofile')
    .setDescription('Reset the bot server avatar and banner'),

  // ─── Bot Info ───
  new SlashCommandBuilder().setName('botinvite').setDescription('Get the bot invite link'),
  new SlashCommandBuilder().setName('help').setDescription('Show all available commands'),
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`🔄 Registering ${commands.length} slash commands globally...`);
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    console.log('✅ Slash commands registered successfully!');
  } catch (error) {
    console.error('❌ Failed to register commands:', error);
  }
})();