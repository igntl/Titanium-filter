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
const SOURCE_CHANNEL_ID = "1496211516020490260"; // الروم اللي يرسل فيه الاعضاء
const DEST_CHANNEL_ID = "1519325101479297176"; // روم الاخراج
// ============================

const DATA_FILE = "./filterData.json";

const VALID_POSITIONS = ["RF", "CF", "CM", "CDM", "ST", "CB", "RB", "LB", "RLB", "LRB", "GK"];

// تحميل وحفظ البيانات
function loadData() {
  return fs.existsSync(DATA_FILE) ? fs.readJsonSync(DATA_FILE) : { entries: [] };
}

function saveData(data) {
  fs.writeJsonSync(data, { spaces: 2 });
}

// تحليل الرسالة: فقط رسائل تحتوي على يوزر + مركز
function parseMessage(content) {
  const words = content.split(/\s+/);
  let username = null;
  let position = null;
  let allPositions = [];

  words.forEach(word => {
    const w = word.toUpperCase();
    if (VALID_POSITIONS.includes(w)) {
      if (!position) position = w;
      allPositions.push(w);
    } else if (!username) {
      // شرط: يوزر يجب أن يحتوي على أحرف أو أرقام فقط
      if (/^[A-Za-z0-9|]+$/.test(word)) {
        username = word;
      }
    }
  });

  // تجاهل الرسائل اللي لا تحتوي على يوزر + مركز
  if (!username || allPositions.length === 0) return null;

  return { username, position: position || "Unknown", allPositions };
}

// تحديث روم الاخراج
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

// الحدث الرئيسي عند وصول رسالة جديدة
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (message.channel.id !== SOURCE_CHANNEL_ID) return;

  const entry = parseMessage(message.content);
  if (!entry) return; // تجاهل أي رسالة لا تحتوي على يوزر + مركز

  const data = loadData();
  data.entries.push(entry);
  saveData(data);

  const destChannel = await client.channels.fetch(DEST_CHANNEL_ID);
  await updateDestChannel(destChannel, data);
});

client.login(TOKEN);
