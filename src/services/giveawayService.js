const { EmbedBuilder } = require('discord.js');
const supabase = require('../supabase');
const store = require('../store');
const { selectWinners } = require('../utils/winners');
const { buildWeightedPool } = require('../services/luckService');
const { incrementWins } = require('../services/leaderboardService');

async function loadGiveaways() {
  const { data, error } = await supabase.from('giveaways').select('*');
  if (error) {
    console.error('Error loading giveaways:', error);
    return;
  }
  store.giveaways = {};
  data.forEach(g => {
    store.giveaways[g.id] = g;
  });
}

async function saveGiveaway(giveaway) {
  const { error } = await supabase.from('giveaways').upsert(giveaway);
  if (error) console.error('Error saving giveaway:', error);
}

async function deleteGiveaway(id) {
  const { error } = await supabase.from('giveaways').delete().eq('id', id);
  if (error) console.error('Error deleting giveaway:', error);
}

async function endGiveaway(client, giveawayId) {
  const giveaway = store.giveaways[giveawayId];
  if (!giveaway) return;

  // احذف فوراً من الـ store كطبقة حماية ضد التكرار
  delete store.giveaways[giveawayId];

  try {
    const channel = await client.channels.fetch(giveaway.channelId);
    const message = await channel.messages.fetch(giveaway.messageId);
    const guild = await client.guilds.fetch(giveaway.guildId);

    let winners = [];

    if (giveaway.participants.length > 0) {
      const luckEnabled = giveaway.luckEnabled ?? true;
      let pool;

      if (luckEnabled) {
        pool = await buildWeightedPool(giveaway.participants, guild, giveaway.guildId);
      } else {
        pool = giveaway.participants;
      }

      if (pool.length >= giveaway.winners) {
        winners = selectWinners(pool, giveaway.winners);
        // إزالة التكرار (ممكن نفس الشخص يظهر أكثر من مرة بسبب الأوزان)
        winners = [...new Set(winners)].slice(0, giveaway.winners);
      }
    }

    // ─── بناء نص الرتب المحظوظة ───
    const luckRoles = store.luckSettings?.[giveaway.guildId];
    let luckLine = '';
    if (luckRoles && Object.keys(luckRoles).length && (giveaway.luckEnabled ?? true)) {
      const roleTexts = Object.entries(luckRoles)
        .sort((a, b) => b[1] - a[1])
        .map(([id, w]) => `<@&${id}> (×${w})`)
        .join(', ');
      luckLine = `\n🍀 Lucky Roles: ${roleTexts}`;
    }

    const embed = new EmbedBuilder().setColor('#FF0000').setTimestamp();

    if (winners.length > 0) {
      const winnerMentions = winners.map(id => `<@${id}>`).join(', ');
      embed
        .setTitle(`${giveaway.prize}`)
        .setDescription(
          `🔔 Winner(s): ${winnerMentions}\n` +
          `⚙️ Ending: Ended\n` +
          `↕️ Hosted by: <@${giveaway.hostId}>` +
          luckLine
        )
        .setFooter({ text: `🏆 Winners: ${giveaway.winners}` });

      await channel.send(`🎊 Congratulations ${winnerMentions}! You won **${giveaway.prize}**! 🎉`);
      await incrementWins(giveaway.guildId, winners);
    } else {
      embed
        .setTitle(`🎉 ${giveaway.prize} 🎉`)
        .setDescription(
          `🔔 Winner(s): No valid entries\n` +
          `⚙️ Ending: Ended\n` +
          `↕️ Hosted by: <@${giveaway.hostId}>` +
          luckLine
        )
        .setFooter({ text: `🏆 Winners: ${giveaway.winners}` });
    }

    await message.edit({ embeds: [embed] });

    const { error } = await supabase.from('ended_giveaways').insert([{
      ...giveaway,
      endedAt: new Date().toISOString(),
      winners_list: winners,
    }]);
    if (error) console.error('Error saving ended giveaway:', error);

    await deleteGiveaway(giveawayId);
  } catch (error) {
    const unrecoverableCodes = [10003, 10008, 50001];
    if (unrecoverableCodes.includes(error.code)) {
      // القناة أو الرسالة مو موجودة، احذف القيفاوي نهائياً
      await deleteGiveaway(giveawayId);
      console.log(`Removed unrecoverable giveaway ${giveawayId} (code: ${error.code})`);
    } else {
      // خطأ مؤقت، رجّع للـ store عشان يحاول مرة ثانية
      store.giveaways[giveawayId] = giveaway;
      console.error('Error ending giveaway:', error);
    }
  }
}

module.exports = { loadGiveaways, saveGiveaway, deleteGiveaway, endGiveaway };