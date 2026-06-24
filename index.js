client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // أمر لتشغيل فلترة كل الرسائل القديمة
  if (message.content.toLowerCase() === "!filter") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return message.reply("❌ ما عندك صلاحية لاستخدام هذا الأمر");
    }

    const sourceChannel = await client.channels.fetch(SOURCE_CHANNEL_ID);
    const destChannel = await client.channels.fetch(DEST_CHANNEL_ID);

    let messages = [];
    let lastId;

    while (true) {
      const options = { limit: 100 };
      if (lastId) options.before = lastId;
      const fetched = await sourceChannel.messages.fetch(options);
      if (fetched.size === 0) break;

      messages = messages.concat(Array.from(fetched.values()));
      lastId = fetched.last().id;
    }

    const data = loadData();

    for (const msg of messages.reverse()) { // ترتيب من الأقدم للأحدث
      if (msg.author.bot) continue;
      const entry = parseMessage(msg.content);
      if (!entry) continue;
      data.entries.push(entry);
    }

    saveData(data);
    await updateDestChannel(destChannel, data);

    // حذف الأمر من الشات تلقائياً
    message.delete().catch(() => {});
    return;
  }

  // باقي الكود للتعامل مع الرسائل الجديدة في روم المصدر
  if (message.channel.id !== SOURCE_CHANNEL_ID) return;

  const entry = parseMessage(message.content);
  if (!entry) return;

  const data = loadData();
  data.entries.push(entry);
  saveData(data);

  const destChannel = await client.channels.fetch(DEST_CHANNEL_ID);
  await updateDestChannel(destChannel, data);
});
