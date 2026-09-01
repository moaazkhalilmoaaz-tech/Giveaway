const supabase = require('../supabase');
const store = require('../store');

const MAX_WEIGHT = 10;

// ─── Load from DB into store ───
async function loadLuckSettings() {
  const { data, error } = await supabase.from('luck_settings').select('*');
  if (error) { console.error('Error loading luck settings:', error); return; }

  store.luckSettings = {};
  for (const row of data) {
    if (!store.luckSettings[row.guild_id]) store.luckSettings[row.guild_id] = {};
    store.luckSettings[row.guild_id][row.role_id] = Number(row.weight);
  }
}

// ─── Save one role ───
async function saveLuckRole(guildId, roleId, weight) {
  const { error } = await supabase.from('luck_settings').upsert({ guild_id: guildId, role_id: roleId, weight });
  if (error) console.error('Error saving luck role:', error);
}

// ─── Delete one role ───
async function deleteLuckRole(guildId, roleId) {
  const { error } = await supabase.from('luck_settings').delete()
    .eq('guild_id', guildId).eq('role_id', roleId);
  if (error) console.error('Error deleting luck role:', error);
}

// ─── Clear all roles for a guild ───
async function clearLuckSettings(guildId) {
  const { error } = await supabase.from('luck_settings').delete().eq('guild_id', guildId);
  if (error) console.error('Error clearing luck settings:', error);
}

// ─── Get weight for a member (sum of matching roles, capped at MAX_WEIGHT) ───
function getMemberWeight(member, guildId) {
  const roles = store.luckSettings?.[guildId];
  if (!roles || !Object.keys(roles).length) return 1;

  let total = 1; // base weight
  for (const [roleId, weight] of Object.entries(roles)) {
    if (member.roles.cache.has(roleId)) {
      total += weight - 1; // add bonus on top of base
    }
  }
  return Math.min(total, MAX_WEIGHT);
}

// ─── Build weighted ticket pool from participants ───
// يجيب كل الأعضاء دفعة وحدة بدل طلب فردي لكل شخص
async function buildWeightedPool(participants, guild, guildId) {
  const pool = [];
  const roles = store.luckSettings?.[guildId];

  // لو ما في رتب محظوظة، ما في داعي نجيب الأعضاء
  if (!roles || !Object.keys(roles).length) {
    return participants;
  }

  // جيب كل الأعضاء دفعة وحدة
  let membersMap = new Map();
  try {
    const fetched = await guild.members.fetch({ user: participants });
    fetched.forEach(m => membersMap.set(m.id, m));
  } catch {
    // لو فشل الجلب، ارجع للقائمة العادية بدون أوزان
    return participants;
  }

  for (const userId of participants) {
    const member = membersMap.get(userId) || null;
    const weight = member ? getMemberWeight(member, guildId) : 1;
    for (let i = 0; i < weight; i++) pool.push(userId);
  }

  return pool;
}

module.exports = {
  loadLuckSettings,
  saveLuckRole,
  deleteLuckRole,
  clearLuckSettings,
  getMemberWeight,
  buildWeightedPool,
  MAX_WEIGHT,
};