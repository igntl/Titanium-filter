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

// ===== إعداد القيم =====
const TOKEN = process.env.TOKEN;
const SOURCE_CHANNEL_ID = "1496211516020490260"; // شات الترشيحات
const DEST_CHANNEL_ID = "1519325101479297176";   // شات الاخراج
const DATA_FILE = "./filterData.json";

// المراكز المسموح بها
const VALID_POSITIONS = ["RF","CF","CM","CDM","ST","CB","RB","LB","RLB","LRB","GK"];

function loadData() {
  return fs.existsSync(DATA_FILE) ? fs.readJsonSync(DATA_FILE) : { entries: [] };
}

function saveData(data) {
  fs.writeJsonSync(DATA_FILE, data, { spaces: 2 });
}

// تحليل محتوى الرسالة
function parseMessage(content) {
  const words = content.split(/\s+/).filter(w => w.trim() !== "");
  let usernameParts = [];
  let positions = [];

  words.forEach(word => {
    const upper = word.toUpperCase();
    if (VALID_POSITIONS.includes(upper)) {
      positions.push(upper);
    } else {
      usernameParts.push(word);
    }
  });

  if (usernameParts.length === 0 || positions.length === 0) return null;

  return {
    username: usernameParts.join(" "),  // دمج الأسماء الكاملة
    position: positions[0],            // أول مركز فقط للرسالة المنظمة
    allPositions: positions            // جميع المراكز للرسالة العادية
  };
}

// تحديث شات الاخراج
async function updateDestChannel(channel, data) {
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

  let rawText = "**📝 جميع الترشيحات:**\n";
  data.entries.forEach(e => {
    rawText += `${e.username} ${e.allPositions.join(" ")}\n`;
  });

  await channel.send(orderedText);
  await channel.send(rawText);
}

async function processAllMessages() {
  const sourceChannel = await client.channels.fetch(SOURCE_CHANNEL_ID);
  const destChannel = await client.channels.fetch(DEST_CHANNEL_ID);
  const data = loadData();

  let messages = [];
  let lastId;

  while (true) {
    const options = { limit: 100 };
    if (lastId) options.before = lastId;

    const batch = await sourceChannel.messages.fetch(options);
    if (batch.size === 0) break;

    messages = messages.concat(Array.from(batch.values()).reverse());
    lastId = batch.last().id;
  }

  messages.forEach(msg => {
    if (msg.author.bot) return;
    const entry = parseMessage(msg.content);
    if (entry) data.entries.push(entry);
  });

  saveData(data);
  await updateDestChannel(destChannel, data);
}

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (message.content.toLowerCase() === "!filter") {
    await processAllMessages();
    message.reply("✅ تم تصفية جميع الرسائل وإرسال النتائج بالشات الاخراج.");
  }
});

client.login(TOKEN);
