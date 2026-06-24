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
    username: usernameParts.join(" "),
    position: positions[0],
    allPositions: positions
  };
}

async function sendFilteredMessages(channel, data) {
  const sortedMap = {};
  VALID_POSITIONS.forEach(pos => sortedMap[pos] = []);
  data.entries.forEach(e => {
    sortedMap[e.position].push(e.username);
  });

  let orderedText = "**📝 الترشيحات مرتبة حسب المراكز:**\n";
  Object.entries(sortedMap).forEach(([pos, users]) => {
    if (users.length > 0) {
      orderedText += `\n**${pos}**\n${users.join("\n")}\n`;
    }
  });

  let rawText = "**📝 جميع الترشيحات:**\n";
  data.entries.forEach(e => {
    rawText += `${e.username} ${e.allPositions.join(" ")}\n`;
  });

  // إرسال الرسائل في شات الإخراج
  await channel.send(orderedText);
  await channel.send(rawText);
}

async function fetchAllMessages(channel) {
  let allMessages = [];
  let lastId = null;

  while (true) {
    const options = { limit: 100 };
    if (lastId) options.before = lastId;

    const batch = await channel.messages.fetch(options);
    if (!batch.size) break;

    allMessages = allMessages.concat(Array.from(batch.values()));
    lastId = batch.last().id;
  }

  return allMessages.reverse();
}

client.on("messageCreate", async message => {
  if (message.author.bot) return;

  // أمر لتشغيل البوت على كل الرسائل القديمة
  if (message.content.toLowerCase() === "!filter") {
    const member = message.member;
    if (!member.permissions.has("ManageMessages")) return;

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
    await sendFilteredMessages(destChannel, data);

    await message.reply("✅ تمت فلترة جميع الرسائل وإرسالها في شات الإخراج.");
    return;
  }

  // معالجة الرسائل الجديدة
  if (message.channel.id !== SOURCE_CHANNEL_ID) return;

  const entry = parseMessage(message.content);
  if (!entry) return;

  const data = loadData();
  data.entries.push(entry);
  saveData(data);

  const destChannel = await client.channels.fetch(DEST_CHANNEL_ID);
  await sendFilteredMessages(destChannel, data);
});

client.login(TOKEN);
