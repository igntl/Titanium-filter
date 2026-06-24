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
const SOURCE_CHANNEL_ID = "1496211516020490260"; // الشات اللي يكتب فيه الاعضاء
const DEST_CHANNEL_ID = "1519325101479297176";  // الشات اللي يرسل فيه البوت
// ============================

const VALID_POSITIONS = ["RF", "CF", "CM", "CDM", "ST", "CB", "RB", "LB", "RLB", "LRB", "GK"];
const DATA_FILE = "./filterData.json";

// تحميل البيانات
function loadData() {
  return fs.existsSync(DATA_FILE) ? fs.readJsonSync(DATA_FILE) : { entries: [] };
}

// حفظ البيانات
function saveData(data) {
  fs.writeJsonSync(DATA_FILE, data, { spaces: 2 });
}

// تحليل كل رسالة
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
      username = word;
    }
  });

  if (!username) return null;
  return { username, position: position || "Unknown", allPositions };
}

// تحديث القناة الهدف
async function updateDestChannel(channel, data) {
  const sortedMap = {};
  VALID_POSITIONS.forEach(pos => sortedMap[pos] = []);
  data.entries.forEach(e => {
    if (!sortedMap[e.position]) sortedMap[e.position] = [];
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
  data.entries.forEach(e => rawText += `${e.username} ${e.allPositions.join(" ")}\n`);

  // تقسيم الرسائل الطويلة لتجنب خطأ 2000 حرف
  const sendChunks = async (text) => {
    const chunks = text.match(/[\s\S]{1,1900}/g);
    for (const chunk of chunks) await channel.send(chunk);
  }

  await sendChunks(orderedText);
  await sendChunks(rawText);
}

// قراءة كل الرسائل القديمة والجديدة
async function processAllMessages() {
  const sourceChannel = await client.channels.fetch(SOURCE_CHANNEL_ID);
  let data = loadData();

  let lastId;
  while (true) {
    const options = { limit: 100 };
    if (lastId) options.before = lastId;
    const messages = await sourceChannel.messages.fetch(options);
    if (!messages.size) break;

    messages.reverse().forEach(msg => {
      if (msg.author.bot) return;
      const entry = parseMessage(msg.content);
      if (!entry) return;
      data.entries.push(entry);
    });

    lastId = messages.first().id;
  }

  saveData(data);

  const destChannel = await client.channels.fetch(DEST_CHANNEL_ID);
  await updateDestChannel(destChannel, data);
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
});

// عند تشغيل البوت، معالجة كل الرسائل القديمة
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await processAllMessages();
});

client.login(TOKEN);
