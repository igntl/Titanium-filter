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

const TOKEN = process.env.TOKEN;
const SOURCE_CHANNEL_ID = "1496211516020490260"; // روم الإدخال
const DEST_CHANNEL_ID = "1519325101479297176";   // روم الإخراج
const DATA_FILE = "./filterData.json";

const VALID_POSITIONS = ["RF","CF","CM","CDM","ST","CB","RB","LB","RLB","LRB","GK"];

function loadData() {
  return fs.existsSync(DATA_FILE) ? fs.readJsonSync(DATA_FILE) : { entries: [] };
}

function saveData(data) {
  fs.writeJsonSync(DATA_FILE, data, { spaces: 2 });
}

function parseMessage(content) {
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
  return { username, position: position || "Unknown", allPositions };
}

async function updateDestChannel(channel, data) {
  const sortedMap = {};
  VALID_POSITIONS.forEach(pos => sortedMap[pos] = []);
  data.entries.forEach(e => sortedMap[e.position].push(e.username));

  let orderedText = "**📝 الترشيحات مرتبة حسب المراكز:**\n";
  Object.entries(sortedMap).forEach(([pos, users]) => {
    if (users.length > 0) {
      orderedText += `\n**${pos}**\n`;
      users.forEach(u => orderedText += `${u}\n`);
    }
  });

  let rawText = "**📝 جميع الترشيحات:**\n";
  data.entries.forEach(e => rawText += `${e.username} ${e.allPositions.join(" ")}\n`);

  await channel.send(orderedText);
  await channel.send(rawText);
}

// ====== جلب جميع الرسائل القديمة بدون حد ======
async function fetchAllMessages(channel) {
  let allMessages = [];
  let lastId = null;
  while (true) {
    const options = { limit: 100 };
    if (lastId) options.before = lastId;

    const messages = await channel.messages.fetch(options);
    if (!messages.size) break;

    allMessages.push(...messages.values());
    lastId = messages.last().id;
  }
  return allMessages.reverse(); // من الأقدم للأحدث
}

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // ======= أمر !filter =======
  if (message.content.toLowerCase() === "!filter") {
    const sourceChannel = await client.channels.fetch(SOURCE_CHANNEL_ID);
    const destChannel = await client.channels.fetch(DEST_CHANNEL_ID);

    const allMessages = await fetchAllMessages(sourceChannel);
    const data = { entries: [] };

    allMessages.forEach(msg => {
      if (!msg.author.bot) {
        const entry = parseMessage(msg.content);
        if (entry) data.entries.push(entry);
      }
    });

    saveData(data);
    await updateDestChannel(destChannel, data);
    message.delete().catch(() => {});
    return;
  }

  // أي رسالة جديدة في روم الإدخال
  if (message.channel.id === SOURCE_CHANNEL_ID) {
    const entry = parseMessage(message.content);
    if (!entry) return;

    const data = loadData();
    data.entries.push(entry);
    saveData(data);

    const destChannel = await client.channels.fetch(DEST_CHANNEL_ID);
    await updateDestChannel(destChannel, data);

    message.delete().catch(() => {});
  }
});

client.login(TOKEN);
