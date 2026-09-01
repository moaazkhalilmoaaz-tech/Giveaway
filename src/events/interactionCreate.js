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

function makeMessageAdapter(interaction) {
  return {
    guild: interaction.guild,
    author: interaction.user,
    member: interaction.member,
    channel: interaction.channel,
    reply: (content) => {
      if (interaction.replied || interaction.deferred) {
        return interaction.followUp(typeof content === 'string' ? { content, fetchReply: true } : { ...content, fetchReply: true });
      }
      return interaction.reply(typeof content === 'string' ? { content, fetchReply: true } : { ...content, fetchReply: true });
    },
  };
}

function registerInteractionCreate(client) {
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;
    const isOwner = OWNER_ID && interaction.user.id === OWNER_ID;
    const isAdmin = interaction.member?.permissions.has(PermissionsBitField.Flags.Administrator);

    try {
      const heavyCommands = ['gstart', 'gend', 'greroll', 'setavatar', 'setbanner', 'resetprofile'];
      if (heavyCommands.includes(commandName)) await interaction.deferReply();

      // ─── OWNER ONLY ───

      if (commandName === 'botservers') {
        if (!isOwner) return interaction.reply({ content: '❌ Owner only.', ephemeral: true });
        return interaction.reply(`🌐 **Total Servers:** ${client.guilds.cache.size}`);
      }

      if (commandName === 'botserverlist') {
        if (!isOwner) return interaction.reply({ content: '❌ Owner only.', ephemeral: true });
        const servers = client.guilds.cache
          .map(g => `• **${g.name}** | ID: \`${g.id}\` | Members: **${g.memberCount}**`)
          .sort((a, b) => a.localeCompare(b));
        let buffer = `📌 **Bot Servers (${servers.length})**\n\n`;
        for (const line of servers) {
          if ((buffer + line + '\n').length > 1800) {
            await interaction.followUp(buffer);
            buffer = '';
          }
          buffer += line + '\n';
        }
        return interaction.reply(buffer);
      }

      if (commandName === 'botmembers') {
        if (!isOwner) return interaction.reply({ content: '❌ Owner only.', ephemeral: true });
        let total = 0;
        client.guilds.cache.forEach(g => total += g.memberCount);
        return interaction.reply(`👥 **Total Members:** ${total}`);
      }

      if (commandName === 'botserverfind') {
        if (!isOwner) return interaction.reply({ content: '❌ Owner only.', ephemeral: true });
        const query = interaction.options.getString('query');
        const exact = client.guilds.cache.get(query);
        if (exact) return interaction.reply(`✅ Found:\n• **${exact.name}** | ID: \`${exact.id}\` | Members: **${exact.memberCount}**`);
        const results = client.guilds.cache
          .filter(g => g.name.toLowerCase().includes(query.toLowerCase()))
          .map(g => `• **${g.name}** | ID: \`${g.id}\` | Members: **${g.memberCount}**`)
          .slice(0, 10);
        if (!results.length) return interaction.reply('❌ No matches found.');
        return interaction.reply(`🔎 Results:\n${results.join('\n')}`);
      }

      if (commandName === 'botping') {
        if (!isOwner) return interaction.reply({ content: '❌ Owner only.', ephemeral: true });
        const sent = await interaction.reply({ content: '🏓 Pinging...', fetchReply: true });
        const latency = sent.createdTimestamp - interaction.createdTimestamp;
        return interaction.editReply(`🏓 **Pong!**\n• Message latency: **${latency}ms**\n• API latency: **${Math.round(client.ws.ping)}ms**`);
      }

      if (commandName === 'botstats') {
        if (!isOwner) return interaction.reply({ content: '❌ Owner only.', ephemeral: true });
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
        return interaction.reply({ embeds: [embed] });
      }

      if (commandName === 'botuptime') {
        if (!isOwner) return interaction.reply({ content: '❌ Owner only.', ephemeral: true });
        const ms = process.uptime() * 1000;
        const d = Math.floor(ms / 86400000);
        const h = Math.floor((ms % 86400000) / 3600000);
        const m = Math.floor((ms % 3600000) / 60000);
        return interaction.reply(`⏱️ **Uptime:** ${d}d ${h}h ${m}m`);
      }

      if (commandName === 'botmemory') {
        if (!isOwner) return interaction.reply({ content: '❌ Owner only.', ephemeral: true });
        const used = process.memoryUsage().rss / 1024 / 1024;
        const total = os.totalmem() / 1024 / 1024;
        return interaction.reply(`🧠 **Memory:** ${used.toFixed(1)} MB / ${total.toFixed(0)} MB`);
      }

      if (commandName === 'botcpu') {
        if (!isOwner) return interaction.reply({ content: '❌ Owner only.', ephemeral: true });
        const cpus = os.cpus();
        return interaction.reply(`🖥️ **CPU:** ${cpus[0]?.model || 'Unknown'} | Cores: **${cpus.length}**`);
      }

      // ─── PUBLIC ───

      if (commandName === 'botinvite') {
        const invite = `https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=274877990912&scope=bot`;
        return interaction.reply(`🔗 **Invite the bot:**\n${invite}`);
      }

      if (commandName === 'help') {
        const P = PREFIX;
        const embed = new EmbedBuilder()
          .setTitle('🎉 Giveaway Bot - Commands')
          .setColor('#FF0000')
          .setDescription('All available giveaway bot commands:')
          .addFields(
            {
              name: '🚀 gstart',
              value: `\`${P}gstart <time> <winners> <prize> [luck:on/off]\`\n\`/gstart\`\nStart a new giveaway`,
            },
            {
              name: '🗑️ gend',
              value: `\`${P}gend <message_id>\`\n\`/gend\`\nEnd a giveaway manually`,
            },
            {
              name: '📋 glist',
              value: `\`${P}glist\`\n\`/glist\`\nShow list of active giveaways`,
            },
            {
              name: '🔄 greroll',
              value: `\`${P}greroll <message_id>\`\n\`/greroll\`\nReroll winners`,
            },
            {
              name: '🏆 gtop',
              value: `\`${P}gtop\`\n\`/gtop\`\nShow giveaway winners leaderboard`,
            },
            {
              name: '🍀 gluck',
              value:
                `\`${P}gluck add <@role> <multiplier>\` | \`/gluck add\` → Add lucky role\n` +
                `\`${P}gluck remove <@role>\` | \`/gluck remove\` → Remove lucky role\n` +
                `\`${P}gluck list\` | \`/gluck list\` → Show all lucky roles\n` +
                `\`${P}gluck clear\` | \`/gluck clear\` → Remove all lucky roles\n` +
                `\`${P}gluck me\` | \`/gluck me\` → Check your luck multiplier`,
            },
            {
              name: '👋 greet',
              value:
                `\`${P}greet\` | \`/greet toggle\` → Add/remove greeting channel\n` +
                `\`${P}greet set <message>\` | \`/greet set\` → Set custom greeting\n` +
                `\`${P}greet time <duration>\` | \`/greet time\` → Set auto-delete time\n` +
                `\`${P}greet reset\` | \`/greet reset\` → Remove all channels\n` +
                `\`${P}greet clear\` | \`/greet clear\` → Reset everything\n` +
                `\`${P}greet test\` | \`/greet test\` → Test greeting\n` +
                `\`${P}greet stats\` | \`/greet stats\` → Show settings`,
            },
            {
              name: '🖼️ Profile (Admin Only)',
              value:
                `\`${P}setavatar <url>\` | \`/setavatar\`\n` +
                `\`${P}setbanner <url>\` | \`/setbanner\`\n` +
                `\`${P}resetprofile\` | \`/resetprofile\``,
            },
          );
        return interaction.reply({ embeds: [embed] });
      }

      // ─── PROFILE ───

      if (commandName === 'setavatar') {
        if (!isAdmin) return interaction.editReply('❌ You need Administrator permission.');
        return handleSetAvatar(makeMessageAdapter(interaction), [interaction.options.getString('url')]);
      }

      if (commandName === 'setbanner') {
        if (!isAdmin) return interaction.editReply('❌ You need Administrator permission.');
        return handleSetBanner(makeMessageAdapter(interaction), [interaction.options.getString('url')]);
      }

      if (commandName === 'resetprofile') {
        if (!isAdmin) return interaction.editReply('❌ You need Administrator permission.');
        return handleResetProfile(makeMessageAdapter(interaction));
      }

      // ─── GIVEAWAY ───

      if (commandName === 'gstart') {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageEvents)) {
          return interaction.editReply('❌ You need Manage Events permission.');
        }

        const timeArg = interaction.options.getString('time');
        const winnersCount = interaction.options.getInteger('winners');
        const prize = interaction.options.getString('prize');
        const luckEnabled = interaction.options.getBoolean('luck') ?? true;
        const duration = parseTime(timeArg);

        if (duration === 0) return interaction.editReply('❌ Invalid time! Use 1h, 30m, 1d');

        const giveawayId = Date.now().toString();
        const endTime = new Date(Date.now() + duration).toISOString();

        const luckRoles = store.luckSettings?.[interaction.guild.id];
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
            `↕️ Hosted by: <@${interaction.user.id}>` +
            luckLine
          )
          .setFooter({ text: `🏆 Winners: ${winnersCount}` });

        const giveawayMessage = await interaction.channel.send({ embeds: [embed] });
        await giveawayMessage.react('🎉');
        await interaction.deleteReply();

        store.giveaways[giveawayId] = {
          id: giveawayId,
          messageId: giveawayMessage.id,
          channelId: interaction.channel.id,
          guildId: interaction.guild.id,
          host: interaction.user.username,
          hostId: interaction.user.id,
          prize,
          winners: winnersCount,
          endtime: endTime,
          participants: [],
          luckEnabled,
        };

        await saveGiveaway(store.giveaways[giveawayId]);
        return;
      }

      if (commandName === 'gend') {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageEvents)) {
          return interaction.editReply('❌ You need Manage Events permission.');
        }
        const messageId = interaction.options.getString('message_id');
        const giveawayId = Object.keys(store.giveaways).find(id => store.giveaways[id].messageId === messageId);
        if (!giveawayId) return interaction.editReply('❌ No active giveaway found.');
        await endGiveaway(client, giveawayId);
        return interaction.deleteReply();
      }

      if (commandName === 'glist') {
        const pageSize = 10;
        const page = interaction.options.getInteger('page') || 1;
        const active = Object.values(store.giveaways).filter(g => g.guildId === interaction.guild.id);
        if (!active.length) return interaction.reply('📋 No active giveaways currently.');
        const totalPages = Math.ceil(active.length / pageSize);
        if (page < 1 || page > totalPages) return interaction.reply(`❌ Invalid page. Choose between 1 and ${totalPages}`);
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
        return interaction.reply({ embeds: [embed] });
      }

      if (commandName === 'greroll') {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageEvents)) {
          return interaction.editReply('❌ You need Manage Events permission.');
        }
        const messageId = interaction.options.getString('message_id');
        const { data, error } = await supabase.from('ended_giveaways').select('*').eq('messageId', messageId);
        if (error || !data?.length) return interaction.editReply('❌ No ended giveaway found.');
        const giveaway = data[0];
        if (!giveaway.participants?.length) return interaction.editReply('❌ No participants to reroll.');
        const newWinners = selectWinners(giveaway.participants, giveaway.winners);
        const mentions = newWinners.map(id => `<@${id}>`).join(', ');
        await interaction.channel.send(`🔄 Congratulations ${mentions}! You are the new winners of **${giveaway.prize}**!`);
        return interaction.deleteReply();
      }

      // ─── GTOP ───

      if (commandName === 'gtop') {
        const top = await getTopWinners(interaction.guild.id, 10);
        const { rank, wins: myWins } = await getUserRank(interaction.guild.id, interaction.user.id);

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
          .setFooter({ text: `${interaction.guild.name} • Top 10 Winners` })
          .setTimestamp();

        if (rank) {
          embed.addFields({
            name: '📍 Your Rank',
            value: `**#${rank}** | <@${interaction.user.id}> | Wins: **${myWins}**`,
          });
        } else {
          embed.addFields({
            name: '📍 Your Rank',
            value: `You haven't won any giveaways yet.`,
          });
        }

        return interaction.reply({ embeds: [embed] });
      }

      // ─── GLUCK ───

      if (commandName === 'gluck') {
        const sub = interaction.options.getSubcommand();

        if (sub === 'me') {
          const weight = getMemberWeight(interaction.member, interaction.guild.id);
          const luckRoles = store.luckSettings?.[interaction.guild.id] || {};
          const myRoles = Object.entries(luckRoles)
            .filter(([id]) => interaction.member.roles.cache.has(id))
            .map(([id, w]) => `<@&${id}> (×${w})`);
          const embed = new EmbedBuilder()
            .setTitle('🍀 Your Luck')
            .setColor('#00ff88')
            .addFields(
              { name: 'Total Multiplier', value: `×${weight}`, inline: true },
              { name: 'Max Possible', value: `×${MAX_WEIGHT}`, inline: true },
              { name: 'Lucky Roles You Have', value: myRoles.length ? myRoles.join('\n') : 'None' }
            );
          return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageEvents)) {
          return interaction.reply({ content: '❌ You need Manage Events permission.', ephemeral: true });
        }

        if (!store.luckSettings[interaction.guild.id]) store.luckSettings[interaction.guild.id] = {};

        if (sub === 'add') {
          const role = interaction.options.getRole('role');
          const multiplier = interaction.options.getNumber('multiplier');
          store.luckSettings[interaction.guild.id][role.id] = multiplier;
          await saveLuckRole(interaction.guild.id, role.id, multiplier);
          return interaction.reply(`✅ <@&${role.id}> will now have **×${multiplier}** luck in giveaways!`);
        }

        if (sub === 'remove') {
          const role = interaction.options.getRole('role');
          if (!store.luckSettings[interaction.guild.id]?.[role.id]) {
            return interaction.reply({ content: '❌ This role has no luck bonus.', ephemeral: true });
          }
          delete store.luckSettings[interaction.guild.id][role.id];
          await deleteLuckRole(interaction.guild.id, role.id);
          return interaction.reply(`✅ Removed luck bonus from <@&${role.id}>.`);
        }

        if (sub === 'list') {
          const roles = store.luckSettings[interaction.guild.id] || {};
          if (!Object.keys(roles).length) {
            return interaction.reply('📋 No lucky roles set up for this server.');
          }
          const embed = new EmbedBuilder()
            .setTitle('🍀 Lucky Roles')
            .setColor('#00ff88');
          const lines = Object.entries(roles)
            .sort((a, b) => b[1] - a[1])
            .map(([id, w]) => `<@&${id}> → **×${w}**`);
          embed.setDescription(lines.join('\n'));
          embed.setFooter({ text: `Max multiplier cap: ×${MAX_WEIGHT}` });
          return interaction.reply({ embeds: [embed] });
        }

        if (sub === 'clear') {
          store.luckSettings[interaction.guild.id] = {};
          await clearLuckSettings(interaction.guild.id);
          return interaction.reply('✅ All lucky roles cleared.');
        }
      }

      // ─── GREET ───

      if (commandName === 'greet') {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
          return interaction.reply({ content: '❌ You need Manage Server permission.', ephemeral: true });
        }

        const sub = interaction.options.getSubcommand();

        if (!store.greetSettings[interaction.guild.id]) {
          store.greetSettings[interaction.guild.id] = {
            guild_id: interaction.guild.id,
            channels: [],
            message: 'Welcome {mention} 🎉',
            delete_time: 0,
          };
        }

        const settings = store.greetSettings[interaction.guild.id];

        if (sub === 'toggle') {
          const channelId = interaction.channel.id;
          if (settings.channels.includes(channelId)) {
            settings.channels = settings.channels.filter(id => id !== channelId);
            await saveGreetSettings(interaction.guild.id);
            return interaction.reply(`✅ Greeting channel ${interaction.channel} removed.`);
          } else {
            settings.channels.push(channelId);
            await saveGreetSettings(interaction.guild.id);
            return interaction.reply(`✅ Greeting channel ${interaction.channel} added.`);
          }
        }

        if (sub === 'set') {
          settings.message = interaction.options.getString('message');
          await saveGreetSettings(interaction.guild.id);
          return interaction.reply('✅ Greeting message updated!');
        }

        if (sub === 'time') {
          const timeMs = parseTime(interaction.options.getString('duration'));
          if (timeMs === 0) return interaction.reply('❌ Invalid time! Use 5s, 10m, 1h');
          settings.delete_time = timeMs;
          await saveGreetSettings(interaction.guild.id);
          return interaction.reply(`✅ Greeting messages will be deleted after ${formatTimeLeft(timeMs)}`);
        }

        if (sub === 'reset') {
          settings.channels = [];
          await saveGreetSettings(interaction.guild.id);
          return interaction.reply('✅ All greeting channels removed.');
        }

        if (sub === 'clear') {
          await supabase.from('greet_settings').delete().eq('guild_id', interaction.guild.id);
          delete store.greetSettings[interaction.guild.id];
          return interaction.reply('✅ All greeting settings cleared.');
        }

        if (sub === 'test') {
          if (!settings.channels?.length) return interaction.reply('❌ No greeting channels set up.');
          const testMessage = settings.message
            .replace(/{mention}/g, `<@${interaction.user.id}>`)
            .replace(/{username}/g, interaction.user.username);
          let sentCount = 0;
          for (const channelId of settings.channels) {
            const channel = interaction.guild.channels.cache.get(channelId);
            if (!channel) continue;
            try {
              const sent = await channel.send(testMessage);
              scheduleGreetMessageDeletion(sent, settings.delete_time);
              sentCount++;
            } catch (e) {
              console.error('Test greet error:', e);
            }
          }
          return interaction.reply(`✅ Test greeting sent to ${sentCount} channel(s)!`);
        }

        if (sub === 'stats') {
          const embed = new EmbedBuilder().setTitle('👋 Greeting Settings').setColor('#00ff00');
          const validChannels = (settings.channels || [])
            .map(id => interaction.guild.channels.cache.get(id))
            .filter(Boolean)
            .map(ch => `<#${ch.id}>`)
            .join(', ') || 'No channels';
          embed.addFields(
            { name: 'Channels', value: validChannels },
            { name: 'Message', value: settings.message || 'Welcome {mention} 🎉' },
            { name: 'Delete Time', value: settings.delete_time > 0 ? formatTimeLeft(settings.delete_time) : 'No auto-delete' }
          );
          return interaction.reply({ embeds: [embed] });
        }
      }

    } catch (err) {
      console.error('interactionCreate error:', err);
      const errMsg = '❌ An error occurred while executing this command.';
      if (interaction.deferred) interaction.editReply(errMsg);
      else if (!interaction.replied) interaction.reply({ content: errMsg, ephemeral: true });
    }
  });
}

module.exports = { registerInteractionCreate };