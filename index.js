const { Client, GatewayIntentBits, Partials, PermissionsBitField } = require('discord.js');
const fs = require('fs-extra');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

// ====== تعديل هذي القيم ======
const TOKEN = process.env.TOKEN;
const SOURCE_CHANNEL_ID = "1496211516020490260";
const DEST_CHANNEL_ID = "1519325101479297176";
// ============================

const DATA_FILE = "./filterData.json";

const VALID_POSITIONS = ["RF", "CF", "CM", "CDM", "ST", "CB", "RB", "LB", "RLB", "LRB", "GK"];

function loadData() {
  return fs.existsSync(DATA_FILE) ? fs.readJsonSync(DATA_FILE) : { entries: [] };
}

function saveData(data) {
  fs.writeJsonSync(DATA_FILE, data, { spaces: 2 });
}

function parseMessage(content) {
  // يقسم الكلمات
  const words = content.split(/\s+/);
  let username = null;
  let position = null;
  let allPositions = [];

  words.forEach(word => {
    if (VALID_POSITIONS.includes(word.toUpperCase()) && !position) {
      position = word.toUpperCase();
      allPositions.push(word.toUpperCase());
    } else if (VALID_POSITIONS.includes(word.toUpperCase()) && position) {
      allPositions.push(word.toUpperCase());
    } else if (!username) {
      username = word;
    }
  });

  if (!username) return null;

  return {
    username,
    position: position || "Unknown",
    allPositions
  };
}

async function updateDestChannel(channel, data) {
  // رسالة مرتبة حسب المراكز
  const sortedMap = {};
  VALID_POSITIONS.forEach(pos => sortedMap[pos] = []);

  data.entries.forEach(e => {
    sortedMap[e.position].push(e.username);
  });

  let orderedText = "**📝 الترشيحات مرتبة حسب المراكز:**\n";
  Object.entries(sortedMap).forEach(([pos, users]) => {
    if (users.length > 0) {
      orderedText += `\n**${pos}**\n`;
      users.forEach(u => orderedText += `${u}\n`);
    }
  });

  // رسالة عادية لكل الإيديات والمراكز
  let rawText = "**📝 جميع الترشيحات:**\n";
  data.entries.forEach(e => {
    rawText += `${e.username} ${e.allPositions.join(" ")}\n`;
  });

  await channel.send(orderedText);
  await channel.send(rawText);
}

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (message.channel.id !== SOURCE_CHANNEL_ID) return;

  const entry = parseMessage(message.content);
  if (!entry) return;

  const data = loadData();
  data.entries.push(entry);
  saveData(data);

  const destChannel = await client.channels.fetch(DEST_CHANNEL_ID);
  await updateDestChannel(destChannel, data);

  // اختياري: حذف الرسائل الأصلية لتجنب الزحمة
  message.delete().catch(() => {});
});

client.login(TOKEN);
