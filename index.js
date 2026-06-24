const { Client, GatewayIntentBits, Partials } = require('discord.js');
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
const SOURCE_CHANNEL_ID = "1496211516020490260"; // روم الترشيحات
const DEST_CHANNEL_ID = "1519325101479297176";  // روم الإرسال النهائي
// ============================

const DATA_FILE = "./filterData.json";
const VALID_POSITIONS = ["RF","CF","CM","CDM","ST","CB","RB","LB","RLB","LRB","GK"];

function loadData() {
  if (!fs.existsSync(DATA_FILE)) return { entries: [] };
  const data = fs.readJsonSync(DATA_FILE);
  if (!data.entries) data.entries = [];
  return data;
}

function saveData(data) {
  fs.writeJsonSync(DATA_FILE, data, { spaces: 2 });
}

// تحليل كل رسالة: يدعم الأسماء قبل أو بعد المراكز، وأكثر من مركز
function parseMessage(content) {
  const words = content.split(/\s+/).filter(w => w.trim());
  if (!words.length) return null;

  let username = null;
  let firstPosition = null;
  let allPositions = [];

  words.forEach(word => {
    const up = word.toUpperCase();
    if (VALID_POSITIONS.includes(up)) {
      if (!firstPosition) firstPosition = up;
      allPositions.push(up);
    } else if (!username) {
      username = word;
    }
  });

  if (!username) return null;
  if (!firstPosition) firstPosition = "Unknown";

  return { username, position: firstPosition, allPositions };
}

// يرسل الرسالتين للروم الثاني
async function updateDestChannel(channel, data) {
  const sortedMap = {};
  VALID_POSITIONS.forEach(pos => sortedMap[pos] = []);
  data.entries.forEach(e => sortedMap[e.position].push(e.username));

  let orderedText = "**📝 الترشيحات مرتبة حسب المراكز:**\n";
  Object.entries(sortedMap).forEach(([pos, users]) => {
    if (users.length) {
      orderedText += `\n**${pos}**\n${users.join("\n")}\n`;
    }
  });

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

  try {
    const destChannel = await client.channels.fetch(DEST_CHANNEL_ID);
    await updateDestChannel(destChannel, data);
  } catch (err) {
    console.error("Error sending messages:", err);
  }

  // اختياري: حذف الرسائل الأصلية لتجنب الزحمة
  message.delete().catch(() => {});
});

client.login(TOKEN);
