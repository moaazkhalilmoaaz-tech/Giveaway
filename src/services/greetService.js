const supabase = require('../supabase');
const store = require('../store');

async function loadGreetSettings() {
  const { data, error } = await supabase.from('greet_settings').select('*');
  if (error) {
    console.error('Error loading greet settings:', error);
    return;
  }

  store.greetSettings = {};
  data.forEach(s => {
    store.greetSettings[s.guild_id] = {
      guild_id: s.guild_id,
      channels: s.channels || [],
      message: s.message || 'Welcome {mention} 🎉',
      delete_time: s.delete_time || 0,
    };
  });
}

async function saveGreetSettings(guildId) {
  const settings = store.greetSettings[guildId];
  if (!settings) return;

  const { error } = await supabase.from('greet_settings').upsert({
    guild_id: settings.guild_id,
    channels: settings.channels,
    message: settings.message,
    delete_time: settings.delete_time,
  });
  if (error) console.error('Error saving greet settings:', error);
}

function scheduleGreetMessageDeletion(message, deleteTime) {
  if (deleteTime > 0) {
    setTimeout(async () => {
      try {
        await message.delete();
      } catch (error) {
        console.error('Error deleting greet message:', error);
      }
    }, deleteTime);
  }
}

module.exports = {
  loadGreetSettings,
  saveGreetSettings,
  scheduleGreetMessageDeletion,
};