const { REST, Routes } = require('discord.js');
const https = require('https');
const http = require('http');

// ╔════════════════════════════════════════════════════════════════════════════╗
// ║                      PROFILE SERVICE MODULE                                ║
// ║              Avatar / Banner management for redgiveaway bot                ║
// ╚════════════════════════════════════════════════════════════════════════════╝

/**
 * تحميل الصورة من URL وتحويلها إلى Data URI (base64)
 */
function downloadAndEncodeImage(url) {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;

    protocol.get(url, (response) => {
      // إذا كان في redirect اتبعه
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        return resolve(downloadAndEncodeImage(response.headers.location));
      }

      if (response.statusCode !== 200) {
        console.error(`[ProfileService] HTTP Error: ${response.statusCode}`);
        return resolve(null);
      }

      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        try {
          const buffer = Buffer.concat(chunks);
          const base64 = buffer.toString('base64');
          const ext = url.split('.').pop().split('?')[0].toLowerCase();
          const mimeMap = {
            png: 'image/png',
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            gif: 'image/gif',
            webp: 'image/webp',
          };
          const mimeType = mimeMap[ext] || 'image/png';
          resolve(`data:${mimeType};base64,${base64}`);
        } catch (err) {
          console.error('[ProfileService] Encode error:', err);
          resolve(null);
        }
      });
      response.on('error', (err) => {
        console.error('[ProfileService] Response error:', err);
        resolve(null);
      });
    }).on('error', (err) => {
      console.error('[ProfileService] Request error:', err);
      resolve(null);
    });
  });
}

function isValidUrl(str) {
  return str && (str.startsWith('http://') || str.startsWith('https://'));
}

// ─────────────────────────────────────────────
//  الدوال الرئيسية
// ─────────────────────────────────────────────

/**
 * !setavatar <url>
 */
async function handleSetAvatar(message, args) {
  if (!args[0] || !isValidUrl(args[0])) {
    return message.reply(`❌ Usage: \`${process.env.PREFIX || '!'}setavatar <image_url>\``);
  }

  const status = await message.reply('⏳ Updating server avatar...');
  const avatarData = await downloadAndEncodeImage(args[0]);

  if (!avatarData) {
    return status.edit('❌ Failed to download the image. Check the URL and try again.');
  }

  try {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    await rest.patch(Routes.guildMember(message.guild.id, '@me'), {
      body: { avatar: avatarData },
    });
    await status.edit('✅ Server avatar updated successfully!');
  } catch (err) {
    console.error('[ProfileService] setavatar error:', err);
    await status.edit(`❌ Discord API error: ${err.message}`);
  }
}

/**
 * !setbanner <url>
 */
async function handleSetBanner(message, args) {
  if (!args[0] || !isValidUrl(args[0])) {
    return message.reply(`❌ Usage: \`${process.env.PREFIX || '!'}setbanner <image_url>\``);
  }

  const status = await message.reply('⏳ Updating server banner...');
  const bannerData = await downloadAndEncodeImage(args[0]);

  if (!bannerData) {
    return status.edit('❌ Failed to download the image. Check the URL and try again.');
  }

  try {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    await rest.patch(Routes.guildMember(message.guild.id, '@me'), {
      body: { banner: bannerData },
    });
    await status.edit('✅ Server banner updated successfully!');
  } catch (err) {
    console.error('[ProfileService] setbanner error:', err);
    await status.edit(`❌ Discord API error: ${err.message}`);
  }
}

/**
 * !setprofile <avatar_url> <banner_url> [bio]
 */
async function handleSetProfile(message, args) {
  if (!args[0] || !isValidUrl(args[0])) {
    return message.reply(
      `❌ Usage: \`${process.env.PREFIX || '!'}setprofile <avatar_url> <banner_url> [bio]\``
    );
  }

  const status = await message.reply('⏳ Updating server profile...');

  const avatarUrl = args[0];
  const bannerUrl = args[1] && isValidUrl(args[1]) ? args[1] : null;
  const bio = args.slice(bannerUrl ? 2 : 1).join(' ') || null;

  const [avatarData, bannerData] = await Promise.all([
    downloadAndEncodeImage(avatarUrl),
    bannerUrl ? downloadAndEncodeImage(bannerUrl) : Promise.resolve(null),
  ]);

  if (!avatarData) {
    return status.edit('❌ Failed to download avatar image.');
  }

  try {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    const body = { avatar: avatarData };
    if (bannerData) body.banner = bannerData;
    if (bio) body.bio = bio;

    await rest.patch(Routes.guildMember(message.guild.id, '@me'), { body });

    await status.edit(
      `✅ Server profile updated!\n` +
      `Avatar: ✅\n` +
      `Banner: ${bannerData ? '✅' : '⚠️ skipped (no URL or failed)'}\n` +
      `Bio: ${bio ? '✅' : '⚠️ not set'}`
    );
  } catch (err) {
    console.error('[ProfileService] setprofile error:', err);
    await status.edit(`❌ Discord API error: ${err.message}`);
  }
}

/**
 * !resetprofile
 */
async function handleResetProfile(message) {
  const status = await message.reply('⏳ Resetting server profile...');

  try {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    await rest.patch(Routes.guildMember(message.guild.id, '@me'), {
      body: { avatar: null, banner: null, bio: null },
    });
    await status.edit('✅ Server profile reset successfully!');
  } catch (err) {
    console.error('[ProfileService] resetprofile error:', err);
    await status.edit(`❌ Discord API error: ${err.message}`);
  }
}

module.exports = { handleSetAvatar, handleSetBanner, handleSetProfile, handleResetProfile };