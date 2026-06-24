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

const TOKEN = process.env.TOKEN;
const SOURCE_CHANNEL_ID = "1496211516020490260";
const DEST_CHANNEL_ID = "1519325101479297176";

const DATA_FILE = "./filterData.json";
const VALID_POSITIONS = ["RF", "CF", "CM", "CDM", "ST", "CB", "RB", "LB", "RLB", "LRB", "GK"];

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
    const w = word.toUpperCase();
    if (VALID_POSITIONS.includes(w)) {
      if (!position) position = w;
      allPositions.push(w);
    } else if (!username && /^[A-Za-z0-9|]+$/.test(word)) {
      username = word;
    }
  });

  if (!username || allPositions.length === 0) return null;
  return { username, position, allPositions };
}

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

  // إرسال الرسائل على دفعات لتجنب الكراش
  const messages = [orderedText, rawText];
  for (const msg of messages) {
    if (msg.length > 0) await channel.send(msg);
  }
}

async function fetchAllMessages(channel) {
  let allMessages = [];
  let lastId = null;

  while (true) {
    const options = { limit: 100 };
    if (lastId) options.before = lastId;

    const messages = await channel.messages.fetch(options);
    if (messages.size === 0) break;

    allMessages = allMessages.concat(Array.from(messages.values()));
    lastId = messages.last().id;
  }

  return allMessages.reverse(); // ترتيب من الأقدم للأحدث
}

client.on("messageCreate", async message => {
  if (message.author.bot) return;

  // أمر فلترة كل الرسائل القديمة
  if (message.content.toLowerCase() === "!filter") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return;
    message.delete().catch(() => {});

    const sourceChannel = await client.channels.fetch(SOURCE_CHANNEL_ID);
    const destChannel = await client.channels.fetch(DEST_CHANNEL_ID);

    const messages = await fetchAllMessages(sourceChannel);
    const data = loadData();

    for (const msg of messages) {
      if (msg.author.bot) continue;
      const entry = parseMessage(msg.content);
      if (!entry) continue;
      data.entries.push(entry);
    }

    saveData(data);
    await updateDestChannel(destChannel, data);
    return;
  }

  // معالجة الرسائل الجديدة في روم المصدر
  if (message.channel.id !== SOURCE_CHANNEL_ID) return;

  const entry = parseMessage(message.content);
  if (!entry) return;

  const data = loadData();
  data.entries.push(entry);
  saveData(data);

  const destChannel = await client.channels.fetch(DEST_CHANNEL_ID);
  await updateDestChannel(destChannel, data);
});

client.login(TOKEN);
