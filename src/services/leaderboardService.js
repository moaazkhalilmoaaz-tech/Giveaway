const supabase = require('../supabase');

// ─── زيادة فوز لكل فائز ───
async function incrementWins(guildId, userIds) {
  for (const userId of userIds) {
    // جلب الرقم الحالي
    const { data } = await supabase
      .from('giveaway_wins')
      .select('wins')
      .eq('guild_id', guildId)
      .eq('user_id', userId)
      .single();

    const currentWins = data?.wins || 0;

    await supabase.from('giveaway_wins').upsert({
      guild_id: guildId,
      user_id: userId,
      wins: currentWins + 1,
    });
  }
}

// ─── جلب أفضل 10 في السيرفر ───
async function getTopWinners(guildId, limit = 10) {
  const { data, error } = await supabase
    .from('giveaway_wins')
    .select('user_id, wins')
    .eq('guild_id', guildId)
    .order('wins', { ascending: false })
    .limit(limit);

  if (error) { console.error('Error fetching leaderboard:', error); return []; }
  return data || [];
}

// ─── جلب ترتيب مستخدم معين ───
async function getUserRank(guildId, userId) {
  // جلب كل المستخدمين مرتبين
  const { data, error } = await supabase
    .from('giveaway_wins')
    .select('user_id, wins')
    .eq('guild_id', guildId)
    .order('wins', { ascending: false });

  if (error || !data) return { rank: null, wins: 0 };

  const index = data.findIndex(row => row.user_id === userId);
  if (index === -1) return { rank: null, wins: 0 };

  return { rank: index + 1, wins: data[index].wins };
}

module.exports = { incrementWins, getTopWinners, getUserRank };