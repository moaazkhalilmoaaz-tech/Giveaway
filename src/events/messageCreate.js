const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const supabase = require('../supabase');
const store = require('../store');
const os = require('os');

const { endGiveaway, saveGiveaway } = require('../services/giveawayService');
const { saveGreetSettings, scheduleGreetMessageDeletion } = require('../services/greetService');
const { handleSetAvatar, handleSetBanner, handleResetProfile } = require('../services/profileService');
const { saveLuckRole, deleteLuckRole, clearLuckSettings, getMemberWeight, MAX_WEIGHT } = require('../services/luckService');
const { getTopWinners, getUserRank } = require('../services/leaderboardService');

const { parseTime, formatTimeLeft } = require('../utils/time');
const { selectWinners } = require('../utils/winners');

const OWNER_ID = (process.env.OWNER_ID || '').trim();
const PREFIX = (process.env.PREFIX || '!').trim();

function registerMessageCreate(client) {
  client.on('messageCreate', async (message) => {
    try {
      if (message.author.bot || !message.guild) return;
      if (!message.content.startsWith(PREFIX)) return;

      const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
      const command = (args.shift() || '').toLowerCase();
      if (!command) return;

      const isOwner = OWNER_ID && message.author.id === OWNER_ID;

      // ─── OWNER ONLY ───

      if (command === 'botservers') {
        if (!isOwner) return;
        return message.reply(`🌐 **Total Servers:** ${client.guilds.cache.size}`);
      }

      if (command === 'botserverlist') {
        if (!isOwner) return;
        const servers = client.guilds.cache
          .map(g => `• **${g.name}** | ID: \`${g.id}\` | Members: **${g.memberCount}**`)
          .sort((a, b) => a.localeCompare(b));
        let buffer = `📌 **Bot Servers (${servers.length})**\n\n`;
        for (const line of servers) {
          if ((buffer + line + '\n').length > 1800) {
            await message.reply(buffer);
            buffer = '';
          }
          buffer += line + '\n';
        }
        if (buffer.trim()) await message.reply(buffer);
        return;
      }

      if (command === 'botmembers') {
        if (!isOwner) return;
        let total = 0;
        client.guilds.cache.forEach(g => total += g.memberCount);
        return message.reply(`👥 **Total Members:** ${total}`);
      }

      if (command === 'botserverfind') {
        if (!isOwner) return;
        const query = args.join(' ').trim();
        if (!query) return message.reply(`❌ Usage: \`${PREFIX}botserverfind <name or server_id>\``);
        const exact = client.guilds.cache.get(query);
        if (exact) return message.reply(`✅ Found:\n• **${exact.name}** | ID: \`${exact.id}\` | Members: **${exact.memberCount}**`);
        const results = client.guilds.cache
          .filter(g => g.name.toLowerCase().includes(query.toLowerCase()))
          .map(g => `• **${g.name}** | ID: \`${g.id}\` | Members: **${g.memberCount}**`)
          .slice(0, 10);
        if (!results.length) return message.reply('❌ No matches found.');
        return message.reply(`🔎 Results (max 10):\n${results.join('\n')}`);
      }

      if (command === 'botping') {
        if (!isOwner) return;
        const sent = await message.reply('🏓 Pinging...');
        return sent.edit(`🏓 **Pong!**\n• Message latency: **${sent.createdTimestamp - message.createdTimestamp}ms**\n• API latency: **${Math.round(client.ws.ping)}ms**`);
      }

      if (command === 'botstats') {
        if (!isOwner) return;
        let totalMembers = 0;
        client.guilds.cache.forEach(g => totalMembers += g.memberCount);
        const embed = new EmbedBuilder()
          .setTitle('🤖 Bot Stats')
          .setColor('#5865F2')
          .addFields(
            { name: 'Servers', value: `${client.guilds.cache.size}`, inline: true },
            { name: 'Members', value: `${totalMembers}`, inline: true },
            { name: 'Active Giveaways', value: `${Object.keys(store.giveaways).length}`, inline: true },
            { name: 'Ping', value: `${Math.round(client.ws.ping)}ms`, inline: true },
            { name: 'Uptime', value: `${Math.floor(process.uptime() / 60)} min`, inline: true }
          );
        return message.reply({ embeds: [embed] });
      }

      if (command === 'botuptime') {
        if (!isOwner) return;
        const ms = process.uptime() * 1000;
        const d = Math.floor(ms / 86400000);
        const h = Math.floor((ms % 86400000) / 3600000);
        const m = Math.floor((ms % 3600000) / 60000);
        return message.reply(`⏱️ **Uptime:** ${d}d ${h}h ${m}m`);
      }

      if (command === 'botmemory') {
        if (!isOwner) return;
        const used = process.memoryUsage().rss / 1024 / 1024;
        const total = os.totalmem() / 1024 / 1024;
        return message.reply(`🧠 **Memory:** ${used.toFixed(1)} MB / ${total.toFixed(0)} MB`);
      }

      if (command === 'botcpu') {
        if (!isOwner) return;
        const cpus = os.cpus();
        return message.reply(`🖥️ **CPU:** ${cpus[0]?.model || 'Unknown'} | Cores: **${cpus.length}**`);
      }

      if (command === 'bothealth') {
        const embed = new EmbedBuilder()
          .setTitle('✅ Bot Health')
          .setColor('#00ff00')
          .addFields(
            { name: 'Ping', value: `${Math.round(client.ws.ping)}ms`, inline: true },
            { name: 'Uptime', value: `${Math.floor(process.uptime() / 60)} min`, inline: true },
            { name: 'Active Giveaways', value: `${Object.keys(store.giveaways).length}`, inline: true }
          );
        return message.reply({ embeds: [embed] });
      }

      // ─── PUBLIC ───

      if (command === 'botinvite') {
        const invite = `https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=274877990912&scope=bot`;
        return message.reply(`🔗 **Invite the bot:**\n${invite}`);
      }

      // ─── PROFILE ───

      if (command === 'setavatar') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
          return message.reply('❌ You need Administrator permission.');
        }
        return handleSetAvatar(message, args);
      }

      if (command === 'setbanner') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
          return message.reply('❌ You need Administrator permission.');
        }
        return handleSetBanner(message, args);
      }

      if (command === 'resetprofile') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
          return message.reply('❌ You need Administrator permission.');
        }
        return handleResetProfile(message);
      }

      // ─── GIVEAWAY ───

      if (command === 'gstart') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageEvents)) {
          return message.reply('❌ You need Manage Events permission.');
        }
        if (args.length < 3) {
          return message.reply(`❌ Usage: \`${PREFIX}gstart <time> <winners_count> <prize> [luck:on/off]\``);
        }

        const timeArg = args[0];
        const winnersCount = parseInt(args[1]);

        const lastArg = args[args.length - 1].toLowerCase();
        let luckEnabled = true;
        let prizeArgs = args.slice(2);
        if (lastArg === 'luck:off') {
          luckEnabled = false;
          prizeArgs = args.slice(2, -1);
        } else if (lastArg === 'luck:on') {
          prizeArgs = args.slice(2, -1);
        }
        const prize = prizeArgs.join(' ');

        const duration = parseTime(timeArg);
        if (duration === 0) return message.reply('❌ Invalid time! Use 1h, 30m, 1d');
        if (isNaN(winnersCount) || winnersCount < 1) return message.reply('❌ Winners count must be > 0');
        if (!prize) return message.reply('❌ Please specify a prize!');

        message.delete().catch(() => {});

        const giveawayId = Date.now().toString();
        const endTime = new Date(Date.now() + duration).toISOString();

        const luckRoles = store.luckSettings?.[message.guild.id];
        let luckLine = '';
        if (luckEnabled && luckRoles && Object.keys(luckRoles).length) {
          const roleTexts = Object.entries(luckRoles)
            .sort((a, b) => b[1] - a[1])
            .map(([id, w]) => `<@&${id}> (×${w})`)
            .join(', ');
          luckLine = `\n🍀 Lucky Roles: ${roleTexts}`;
        }

        const embed = new EmbedBuilder()
          .setTitle(`${prize}`)
          .setColor('#FFFF00')
          .setDescription(
            `🔔 React with 🎉 to enter!\n` +
            `⚙️ Ending: <t:${Math.floor((Date.now() + duration) / 1000)}:R>\n` +
            `↕️ Hosted by: <@${message.author.id}>` +
            luckLine
          )
          .setFooter({ text: `🏆 Winners: ${winnersCount}` });

        const giveawayMessage = await message.channel.send({ embeds: [embed] });
        await giveawayMessage.react('🎉');

        store.giveaways[giveawayId] = {
          id: giveawayId,
          messageId: giveawayMessage.id,
          channelId: message.channel.id,
          guildId: message.guild.id,
          host: message.author.username,
          hostId: message.author.id,
          prize,
          winners: winnersCount,
          endtime: endTime,
          participants: [],
          luckEnabled,
        };

        await saveGiveaway(store.giveaways[giveawayId]);
        return;
      }

      if (command === 'help') {
        const embed = new EmbedBuilder()
          .setTitle('🎉 Giveaway Bot - Commands')
          .setColor('#FF0000')
          .setDescription('All available giveaway bot commands:')
          .addFields(
            {
              name: '🚀 gstart',
              value: `\`${PREFIX}gstart <time> <winners> <prize> [luck:on/off]\`\n\`/gstart\`\nStart a new giveaway`,
            },
            {
              name: '🗑️ gend',
              value: `\`${PREFIX}gend <message_id>\`\n\`/gend\`\nEnd a giveaway manually`,
            },
            {
              name: '📋 glist',
              value: `\`${PREFIX}glist\`\n\`/glist\`\nShow list of active giveaways`,
            },
            {
              name: '🔄 greroll',
              value: `\`${PREFIX}greroll <message_id>\`\n\`/greroll\`\nReroll winners`,
            },
            {
              name: '🏆 gtop',
              value: `\`${PREFIX}gtop\`\n\`/gtop\`\nShow giveaway winners leaderboard`,
            },
            {
              name: '🍀 gluck',
              value:
                `\`${PREFIX}gluck add <@role> <multiplier>\` → Add lucky role\n` +
                `\`${PREFIX}gluck remove <@role>\` → Remove lucky role\n` +
                `\`${PREFIX}gluck list\` → Show all lucky roles\n` +
                `\`${PREFIX}gluck clear\` → Remove all lucky roles\n` +
                `\`${PREFIX}gluck me\` → Check your luck multiplier`,
            },
            {
              name: '👋 greet',
              value:
                `\`${PREFIX}greet\` → Toggle channel | \`${PREFIX}greet set <msg>\` → Set message\n` +
                `\`${PREFIX}greet time <dur>\` → Auto-delete | \`${PREFIX}greet test\` → Test\n` +
                `\`${PREFIX}greet reset\` → Remove channels | \`${PREFIX}greet stats\` → Settings`,
            },
            {
              name: '🖼️ Profile (Admin Only)',
              value: `\`${PREFIX}setavatar <url>\` | \`${PREFIX}setbanner <url>\` | \`${PREFIX}resetprofile\``,
            },
          );
        return message.reply({ embeds: [embed] });
      }

      if (command === 'gend') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageEvents)) {
          return message.reply('❌ Permission needed');
        }
        if (!args[0]) return message.reply(`❌ Usage: \`${PREFIX}gend <message_id>\``);
        const giveawayId = Object.keys(store.giveaways).find(id => store.giveaways[id].messageId === args[0]);
        if (!giveawayId) return message.reply('❌ No active giveaway found');
        await endGiveaway(client, giveawayId);
        return message.reply('✅ Giveaway ended successfully!');
      }

      if (command === 'glist') {
        const pageSize = 10;
        const page = parseInt(args[0]) || 1;
        const active = Object.values(store.giveaways).filter(g => g.guildId === message.guild.id);
        if (!active.length) return message.reply('📋 No active giveaways currently');
        const totalPages = Math.ceil(active.length / pageSize);
        if (page < 1 || page > totalPages) return message.reply(`❌ Invalid page. Choose between 1 and ${totalPages}`);
        const slice = active.slice((page - 1) * pageSize, page * pageSize);
        const embed = new EmbedBuilder()
          .setTitle(`📋 Active Giveaways (Page ${page}/${totalPages})`)
          .setColor('#0099ff');
        slice.forEach((g, i) => {
          const timeLeft = formatTimeLeft(new Date(g.endtime).getTime() - Date.now());
          const luckTag = g.luckEnabled ? ' 🍀' : '';
          embed.addFields({
            name: `${(page - 1) * pageSize + i + 1}. ${g.prize}${luckTag}`,
            value: `**Winners:** ${g.winners}\n**Time Left:** ${timeLeft}\n**ID:** ${g.messageId}`,
            inline: false,
          });
        });
        let footerText = `Page ${page}/${totalPages}`;
        if (page < totalPages) footerText = `Next ➡ ${PREFIX}glist ${page + 1} | ${footerText}`;
        embed.setFooter({ text: footerText });
        return message.reply({ embeds: [embed] });
      }

      if (command === 'greroll') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageEvents)) {
          return message.reply('❌ Permission needed');
        }
        if (!args[0]) return message.reply(`❌ Usage: \`${PREFIX}greroll <message_id>\``);
        const { data, error } = await supabase.from('ended_giveaways').select('*').eq('messageId', args[0]);
        if (error || !data?.length) return message.reply('❌ No ended giveaway found');
        const giveaway = data[0];
        if (!giveaway.participants?.length) return message.reply('❌ No participants to reroll');
        const newWinners = selectWinners(giveaway.participants, giveaway.winners);
        return message.channel.send(`🔄 Congratulations ${newWinners.map(id => `<@${id}>`).join(', ')}! You are the new winners of **${giveaway.prize}**!`);
      }

      // ─── GTOP ───

      if (command === 'gtop') {
        const top = await getTopWinners(message.guild.id, 10);
        const { rank, wins: myWins } = await getUserRank(message.guild.id, message.author.id);

        const medals = ['🥇', '🥈', '🥉'];

        let description = '';
        if (!top.length) {
          description = 'No winners recorded yet.';
        } else {
          description = top.map((row, i) => {
            const medal = medals[i] || `**#${i + 1}**`;
            return `${medal} | <@${row.user_id}> | Wins: **${row.wins}**`;
          }).join('\n');
        }

        const embed = new EmbedBuilder()
          .setTitle('🏆 Giveaway Leaderboard')
          .setColor('#FFD700')
          .setDescription(description)
          .setFooter({ text: `${message.guild.name} • Top 10 Winners` })
          .setTimestamp();

        if (rank) {
          embed.addFields({
            name: '📍 Your Rank',
            value: `**#${rank}** | <@${message.author.id}> | Wins: **${myWins}**`,
          });
        } else {
          embed.addFields({
            name: '📍 Your Rank',
            value: `You haven't won any giveaways yet.`,
          });
        }

        return message.reply({ embeds: [embed] });
      }

      // ─── GLUCK ───

      if (command === 'gluck') {
        const sub = args[0]?.toLowerCase();

        if (sub === 'me') {
          const weight = getMemberWeight(message.member, message.guild.id);
          const luckRoles = store.luckSettings?.[message.guild.id] || {};
          const myRoles = Object.entries(luckRoles)
            .filter(([id]) => message.member.roles.cache.has(id))
            .map(([id, w]) => `<@&${id}> (×${w})`);
          const embed = new EmbedBuilder()
            .setTitle('🍀 Your Luck')
            .setColor('#00ff88')
            .addFields(
              { name: 'Total Multiplier', value: `×${weight}`, inline: true },
              { name: 'Max Possible', value: `×${MAX_WEIGHT}`, inline: true },
              { name: 'Lucky Roles You Have', value: myRoles.length ? myRoles.join('\n') : 'None' }
            );
          return message.reply({ embeds: [embed] });
        }

        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageEvents)) {
          return message.reply('❌ You need Manage Events permission.');
        }

        if (!store.luckSettings[message.guild.id]) store.luckSettings[message.guild.id] = {};

        if (sub === 'add') {
          const roleId = args[1]?.replace(/[<@&>]/g, '');
          const multiplier = parseFloat(args[2]);
          if (!roleId || isNaN(multiplier)) {
            return message.reply(`❌ Usage: \`${PREFIX}gluck add <@role> <multiplier>\` (e.g. 1.5 - 10)`);
          }
          if (multiplier < 1.1 || multiplier > MAX_WEIGHT) {
            return message.reply(`❌ Multiplier must be between 1.1 and ${MAX_WEIGHT}`);
          }
          const role = message.guild.roles.cache.get(roleId);
          if (!role) return message.reply('❌ Role not found.');
          store.luckSettings[message.guild.id][roleId] = multiplier;
          await saveLuckRole(message.guild.id, roleId, multiplier);
          return message.reply(`✅ <@&${roleId}> will now have **×${multiplier}** luck in giveaways!`);
        }

        if (sub === 'remove') {
          const roleId = args[1]?.replace(/[<@&>]/g, '');
          if (!roleId) return message.reply(`❌ Usage: \`${PREFIX}gluck remove <@role>\``);
          if (!store.luckSettings[message.guild.id]?.[roleId]) {
            return message.reply('❌ This role has no luck bonus.');
          }
          delete store.luckSettings[message.guild.id][roleId];
          await deleteLuckRole(message.guild.id, roleId);
          return message.reply(`✅ Removed luck bonus from <@&${roleId}>.`);
        }

        if (sub === 'list') {
          const roles = store.luckSettings[message.guild.id] || {};
          if (!Object.keys(roles).length) return message.reply('📋 No lucky roles set up for this server.');
          const embed = new EmbedBuilder()
            .setTitle('🍀 Lucky Roles')
            .setColor('#00ff88');
          const lines = Object.entries(roles)
            .sort((a, b) => b[1] - a[1])
            .map(([id, w]) => `<@&${id}> → **×${w}**`);
          embed.setDescription(lines.join('\n'));
          embed.setFooter({ text: `Max multiplier cap: ×${MAX_WEIGHT}` });
          return message.reply({ embeds: [embed] });
        }

        if (sub === 'clear') {
          store.luckSettings[message.guild.id] = {};
          await clearLuckSettings(message.guild.id);
          return message.reply('✅ All lucky roles cleared.');
        }

        return message.reply(`❌ Unknown subcommand. Use: \`${PREFIX}gluck add/remove/list/clear/me\``);
      }

      // ─── GREET ───

      if (command === 'greet') {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
          return message.reply('❌ You need Manage Server permission.');
        }

        const sub = args[0]?.toLowerCase();

        if (!store.greetSettings[message.guild.id]) {
          store.greetSettings[message.guild.id] = {
            guild_id: message.guild.id,
            channels: [],
            message: 'Welcome {mention} 🎉',
            delete_time: 0,
          };
        }

        const settings = store.greetSettings[message.guild.id];

        if (!sub) {
          const channelId = message.channel.id;
          if (settings.channels.includes(channelId)) {
            settings.channels = settings.channels.filter(id => id !== channelId);
            await saveGreetSettings(message.guild.id);
            return message.reply(`✅ Greeting channel ${message.channel} removed`);
          } else {
            settings.channels.push(channelId);
            await saveGreetSettings(message.guild.id);
            return message.reply(`✅ Greeting channel ${message.channel} added`);
          }
        }

        if (sub === 'set') {
          const customMessage = args.slice(1).join(' ');
          if (!customMessage) return message.reply(`❌ Usage: \`${PREFIX}greet set <message>\``);
          settings.message = customMessage;
          await saveGreetSettings(message.guild.id);
          return message.reply('✅ Greeting message updated!');
        }

        if (sub === 'time') {
          const timeMs = parseTime(args[1] || '');
          if (timeMs === 0) return message.reply('❌ Invalid time! Use 5s, 10m, 1h');
          settings.delete_time = timeMs;
          await saveGreetSettings(message.guild.id);
          return message.reply(`✅ Greeting messages will be deleted after ${formatTimeLeft(timeMs)}`);
        }

        if (sub === 'reset') {
          settings.channels = [];
          await saveGreetSettings(message.guild.id);
          return message.reply('✅ All greeting channels removed');
        }

        if (sub === 'clear') {
          await supabase.from('greet_settings').delete().eq('guild_id', message.guild.id);
          delete store.greetSettings[message.guild.id];
          return message.reply('✅ All greeting settings cleared');
        }

        if (sub === 'test') {
          if (!settings.channels?.length) return message.reply('❌ No greeting channels set up');
          const testMessage = settings.message
            .replace(/{mention}/g, `<@${message.author.id}>`)
            .replace(/{username}/g, message.author.username);
          let sentCount = 0;
          for (const channelId of settings.channels) {
            const channel = message.guild.channels.cache.get(channelId);
            if (!channel) continue;
            try {
              const sent = await channel.send(testMessage);
              scheduleGreetMessageDeletion(sent, settings.delete_time);
              sentCount++;
            } catch (e) {
              console.error('Test greet error:', e);
            }
          }
          return message.reply(`✅ Test greeting sent to ${sentCount} channel(s)!`);
        }

        if (sub === 'stats') {
          const embed = new EmbedBuilder().setTitle('👋 Greeting Settings').setColor('#00ff00');
          const validChannels = (settings.channels || [])
            .map(id => message.guild.channels.cache.get(id))
            .filter(Boolean)
            .map(ch => `<#${ch.id}>`)
            .join(', ') || 'No channels';
          embed.addFields(
            { name: 'Channels', value: validChannels },
            { name: 'Message', value: settings.message || 'Welcome {mention} 🎉' },
            { name: 'Delete Time', value: settings.delete_time > 0 ? formatTimeLeft(settings.delete_time) : 'No auto-delete' }
          );
          return message.reply({ embeds: [embed] });
        }
      }

    } catch (err) {
      console.error('messageCreate error:', err);
    }
  });
}

module.exports = { registerMessageCreate };