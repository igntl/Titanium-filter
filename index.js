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

// ===== تعديل القيم =====
const TOKEN = process.env.TOKEN;
const SOURCE_CHANNEL_ID = "1496211516020490260"; // شات الترشيحات
const DEST_CHANNEL_ID = "1519325101479297176";   // شات الإخراج
const DATA_FILE = "./filterData.json";

const VALID_POSITIONS = ["RF", "CF", "CM", "CDM", "ST", "CB", "RB", "LB", "RLB", "LRB", "GK"];

// =========================
function loadData() {
  return fs.existsSync(DATA_FILE) ? fs.readJsonSync(DATA_FILE) : { entries: [] };
}

function saveData(data) {
  fs.writeJsonSync(DATA_FILE, data, { spaces: 2 });
}

// تحليل الرسالة واستخراج الاسم والمراكز
function parseMessage(content) {
  const words = content.split(/\s+/);
  let username = null;
  let mainPosition = null;
  let allPositions = [];

  words.forEach(word => {
    const w = word.toUpperCase();
    if (VALID_POSITIONS.includes(w) && !mainPosition) {
      mainPosition = w;
      allPositions.push(w);
    } else if (VALID_POSITIONS.includes(w)) {
      allPositions.push(w);
    } else if (!username) {
      username = word;
    }
  });

  if (!username) return null;

  return {
    username,
    position: mainPosition || "Unknown",
    allPositions
  };
}

// إنشاء رسالتين: مرتبة وغير مرتبة
function formatMessages(entries) {
  const sortedMap = {};
  VALID_POSITIONS.forEach(pos => sortedMap[pos] = []);

  entries.forEach(e => {
    sortedMap[e.position].push(e.username);
  });

  let orderedText = "**📝 الترشيحات مرتبة حسب المراكز:**\n";
  Object.entries(sortedMap).forEach(([pos, users]) => {
    if (users.length > 0) {
      orderedText += `\n**${pos}**\n`;
      users.forEach(u => orderedText += `${u}\n`);
    }
  });

  let rawText = "**📝 جميع الترشيحات:**\n";
  entries.forEach(e => {
    rawText += `${e.username} ${e.allPositions.join(" ")}\n`;
  });

  return { orderedText, rawText };
}

// تحديث شات الإخراج
async function updateDestChannel(entries) {
  const channel = await client.channels.fetch(DEST_CHANNEL_ID);
  const messages = formatMessages(entries);

  // نرسل الرسالتين كرسالتين جديدتين
  await channel.send(messages.orderedText);
  await channel.send(messages.rawText);
}

// قراءة الرسائل القديمة والجديدة
async function processMessages() {
  const sourceChannel = await client.channels.fetch(SOURCE_CHANNEL_ID);
  const data = loadData();

  // جلب كل الرسائل القديمة
  const messages = await sourceChannel.messages.fetch({ limit: 1000 });
  messages.reverse().forEach(msg => {
    const entry = parseMessage(msg.content);
    if (entry) data.entries.push(entry);
  });

  saveData(data);
  await updateDestChannel(data.entries);
}

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (message.channel.id !== SOURCE_CHANNEL_ID) return;

  const data = loadData();
  const entry = parseMessage(message.content);
  if (!entry) return;

  data.entries.push(entry);
  saveData(data);
  await updateDestChannel(data.entries);
});

// عند تشغيل البوت، يعالج كل الرسائل القديمة
client.on("ready", async () => {
  console.log(`${client.user.tag} is online!`);
  await processMessages();
});

client.login(TOKEN);
