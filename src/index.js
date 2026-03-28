require("dotenv").config();

const {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  ModalBuilder,
  Partials,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");
const { getGuildConfig, updateGuildConfig } = require("./storage");

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN || !CLIENT_ID) {
  console.error("DISCORD_TOKEN ve CLIENT_ID .env dosyasinda tanimli olmali.");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

const ticketTypes = {
  teknik: {
    label: "🛠️ Teknik Destek",
    emoji: "🛠️",
    description: "Hata, kurulum veya teknik sorunlar",
    color: 0x1f8b4c
  },
  siparis: {
    label: "🛒 Siparis Destegi",
    emoji: "🛒",
    description: "Siparis, odeme veya teslimat sorulari",
    color: 0xf39c12
  },
  isbirligi: {
    label: "🤝 Is Birligi",
    emoji: "🤝",
    description: "Partnerlik, reklam veya teklif gorusmeleri",
    color: 0x8e44ad
  },
  diger: {
    label: "💬 Diger",
    emoji: "💬",
    description: "Genel yardim ve diger konular",
    color: 0x3498db
  }
};

const commands = [
  new SlashCommandBuilder()
    .setName("kurulum")
    .setDescription("Destek botu ayarlarini yapar.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((option) =>
      option
        .setName("ticket_kategori")
        .setDescription("Ticket kanallarinin acilacagi kategori")
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(true)
    )
    .addChannelOption((option) =>
      option
        .setName("log_kanali")
        .setDescription("Tum destek hareketlerinin loglanacagi kanal")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addRoleOption((option) =>
      option
        .setName("yetkili_rol")
        .setDescription("Destek ekibinin gorecegi rol")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("hosgeldin_mesaji")
        .setDescription("Ticket acildiginda kanalda gosterilecek mesaj")
        .setMaxLength(500)
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName("panel")
    .setDescription("Destek panelini gonderir.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName("dmgonder")
    .setDescription("Bir kullaniciya embed olarak ozel mesaj yollar.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addUserOption((option) =>
      option.setName("uye").setDescription("Mesaj gonderilecek uye").setRequired(true)
    )
    .addStringOption((option) =>
      option.setName("baslik").setDescription("Embed basligi").setRequired(true).setMaxLength(100)
    )
    .addStringOption((option) =>
      option.setName("mesaj").setDescription("DM icerigi").setRequired(true).setMaxLength(1000)
    )
].map((command) => command.toJSON());

function createEmbed({ color = 0x5865f2, title, description, footer = "✨ Gelismis Destek Sistemi", fields = [] }) {
  const embed = new EmbedBuilder().setColor(color).setTimestamp().setFooter({ text: footer });
  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  if (fields.length) embed.addFields(fields);
  return embed;
}

function replyWithEmbed(interaction, options) {
  return interaction.reply({
    embeds: [createEmbed(options)],
    ephemeral: options.ephemeral ?? true
  });
}

function isConfigured(config) {
  return Boolean(config?.categoryId && config?.staffRoleId && config?.logChannelId);
}

function buildPanelEmbed(guild) {
  return createEmbed({
    color: 0x2b2d31,
    title: `🎫 ${guild.name} Destek Merkezi`,
    description: [
      "Asagidaki menuden destek turunu secerek ozel ticket olusturabilirsin.",
      "🧷 Her kullanici ayni kategoride tek aktif ticket acabilir.",
      "📜 Tum hareketler log kanalina embed olarak kaydedilir.",
      "⭐ Ticket kapandiginda yorum ve puan istenir."
    ].join("\n"),
    footer: "🎟️ Destek almak icin menuyu kullan",
    fields: Object.values(ticketTypes).map((type) => ({
      name: type.label,
      value: `> ${type.description}`,
      inline: true
    }))
  });
}

function buildPanelRows() {
  const select = new StringSelectMenuBuilder()
    .setCustomId("ticket-type-select")
    .setPlaceholder("🎫 Destek kategorisi sec")
    .addOptions(
      Object.entries(ticketTypes).map(([key, type]) => ({
        label: type.label,
        description: type.description,
        emoji: type.emoji,
        value: key
      }))
    );

  return [new ActionRowBuilder().addComponents(select)];
}

function buildTicketControls() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("ticket-claim").setLabel("🧑‍💼 Ustlen").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("ticket-manage-user").setLabel("👥 Uye Yonetimi").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("ticket-close").setLabel("🔒 Kapat").setStyle(ButtonStyle.Danger)
    )
  ];
}

function buildFeedbackRow(guildId, ticketId) {
  const row = new ActionRowBuilder();
  for (let i = 1; i <= 5; i += 1) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`feedback:${guildId}:${ticketId}:${i}`)
        .setLabel(`⭐ ${i}`)
        .setStyle(i >= 4 ? ButtonStyle.Success : ButtonStyle.Secondary)
    );
  }
  return row;
}

function getTicketByChannel(guildId, channelId) {
  const config = getGuildConfig(guildId);
  return config?.tickets?.[channelId] ?? null;
}

function findOpenTicket(config, userId, type) {
  return Object.values(config?.tickets ?? {}).find((ticket) => ticket.ownerId === userId && ticket.type === type);
}

function ensureStaff(interaction, config) {
  return interaction.member.roles.cache.has(config.staffRoleId);
}

function createTicketRecord(existingConfig, record) {
  const tickets = { ...(existingConfig?.tickets ?? {}), [record.channelId]: record };
  return { ...(existingConfig ?? {}), tickets };
}

function updateTicketRecord(existingConfig, channelId, updater) {
  const tickets = { ...(existingConfig?.tickets ?? {}) };
  const current = tickets[channelId];
  if (!current) return existingConfig ?? {};
  tickets[channelId] = updater(current);
  return { ...(existingConfig ?? {}), tickets };
}

function removeTicketRecord(existingConfig, channelId) {
  const tickets = { ...(existingConfig?.tickets ?? {}) };
  delete tickets[channelId];
  return { ...(existingConfig ?? {}), tickets };
}

function normalizeAction(value) {
  const normalized = value.trim().toLowerCase();
  if (["ekle", "add"].includes(normalized)) return "add";
  if (["cikar", "çıkar", "remove"].includes(normalized)) return "remove";
  return null;
}

async function safeDm(user, embed, components = []) {
  try {
    await user.send({ embeds: [embed], components });
    return true;
  } catch {
    return false;
  }
}

async function sendLog(guild, embed, files = []) {
  const config = getGuildConfig(guild.id);
  if (!config?.logChannelId) return;

  const channel = await guild.channels.fetch(config.logChannelId).catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildText) return;

  await channel.send({ embeds: [embed], files }).catch(() => null);
}

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  const route = GUILD_ID
    ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
    : Routes.applicationCommands(CLIENT_ID);

  await rest.put(route, { body: commands });
  console.log(GUILD_ID ? "Guild slash komutlari guncellendi." : "Global slash komutlari guncellendi.");
}

async function createTicket(interaction, typeKey) {
  const config = getGuildConfig(interaction.guildId);
  if (!isConfigured(config)) {
    await replyWithEmbed(interaction, {
      color: 0xe74c3c,
      title: "⚠️ Kurulum Eksik",
      description: "Bot henuz kurulmamis. Once `/kurulum` komutunu kullan."
    });
    return;
  }

  const selectedType = ticketTypes[typeKey];
  if (!selectedType) {
    await replyWithEmbed(interaction, {
      color: 0xe74c3c,
      title: "❌ Gecersiz Kategori",
      description: "Sectigin destek kategorisi tanimli degil."
    });
    return;
  }

  const existing = findOpenTicket(config, interaction.user.id, typeKey);
  if (existing) {
    await replyWithEmbed(interaction, {
      color: selectedType.color,
      title: "🎟️ Acik Ticket Bulundu",
      description: `Bu kategori icin zaten acik bir ticketin var: <#${existing.channelId}>`
    });
    return;
  }

  const category = await interaction.guild.channels.fetch(config.categoryId).catch(() => null);
  if (!category) {
    await replyWithEmbed(interaction, {
      color: 0xe74c3c,
      title: "📁 Kategori Bulunamadi",
      description: "Ticket kategorisi bulunamadi. `/kurulum` ile tekrar ayarlayin."
    });
    return;
  }

  const safeName = interaction.user.username.toLowerCase().replace(/[^a-z0-9-_]/g, "").slice(0, 12) || "uye";
  const channel = await interaction.guild.channels.create({
    name: `${typeKey}-${safeName}`,
    type: ChannelType.GuildText,
    parent: category.id,
    permissionOverwrites: [
      { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      {
        id: interaction.user.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
      },
      {
        id: config.staffRoleId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.ManageMessages
        ]
      }
    ]
  });

  updateGuildConfig(interaction.guildId, (current) =>
    createTicketRecord(current, {
      channelId: channel.id,
      ownerId: interaction.user.id,
      type: typeKey,
      claimedBy: null,
      createdAt: Date.now(),
      status: "open"
    })
  );

  await channel.send({
    content: `📣 <@&${config.staffRoleId}> ${interaction.user}`,
    embeds: [
      createEmbed({
        color: selectedType.color,
        title: `${selectedType.emoji} Yeni Destek Talebi`,
        description: [
          `${interaction.user} icin yeni destek kanali olusturuldu.`,
          "",
          `💡 ${config.welcomeMessage || "Ekibimiz en kisa surede seninle ilgilenecek."}`,
          "",
          "🧰 Yetkililer asagidaki butonlarla islemleri yonetebilir."
        ].join("\n"),
        footer: "📌 Destek islemleri bu kanal uzerinden yurutulur",
        fields: [
          { name: "👤 Talep Sahibi", value: interaction.user.tag, inline: true },
          { name: "🏷️ Kategori", value: selectedType.label, inline: true },
          { name: "📍 Durum", value: "🟢 Acik", inline: true }
        ]
      })
    ],
    components: buildTicketControls()
  });

  await sendLog(
    interaction.guild,
    createEmbed({
      color: selectedType.color,
      title: "📜 Ticket Acildi",
      footer: "🗂️ Destek hareket kaydi",
      fields: [
        { name: "👤 Kullanici", value: `${interaction.user.tag} (${interaction.user.id})`, inline: false },
        { name: "🏷️ Kategori", value: selectedType.label, inline: true },
        { name: "📌 Kanal", value: `<#${channel.id}>`, inline: true }
      ]
    })
  );

  await replyWithEmbed(interaction, {
    color: selectedType.color,
    title: "✅ Ticket Hazir",
    description: `Destek talebin olusturuldu: ${channel}`
  });
}

async function sendPanel(interaction) {
  const config = getGuildConfig(interaction.guildId);
  if (!isConfigured(config)) {
    await replyWithEmbed(interaction, {
      color: 0xe74c3c,
      title: "⚠️ Kurulum Gerekli",
      description: "Once `/kurulum` komutunu kullanman gerekiyor."
    });
    return;
  }

  await interaction.channel.send({
    embeds: [buildPanelEmbed(interaction.guild)],
    components: buildPanelRows()
  });

  await replyWithEmbed(interaction, {
    color: 0x57f287,
    title: "📨 Panel Gonderildi",
    description: "Destek paneli bu kanala basariyla gonderildi."
  });
}

async function sendDirectMessage(interaction) {
  const user = interaction.options.getUser("uye", true);
  const title = interaction.options.getString("baslik", true);
  const message = interaction.options.getString("mesaj", true);

  const delivered = await safeDm(
    user,
    createEmbed({
      color: 0x5865f2,
      title: `✉️ ${title}`,
      description: message,
      footer: `📩 ${interaction.guild.name} tarafindan gonderildi`
    })
  );

  if (!delivered) {
    await replyWithEmbed(interaction, {
      color: 0xe74c3c,
      title: "❌ DM Gonderilemedi",
      description: "Kullanicinin ozel mesajlari kapali olabilir."
    });
    return;
  }

  await sendLog(
    interaction.guild,
    createEmbed({
      color: 0x5865f2,
      title: "📨 Yonetici DM Gonderdi",
      footer: "📝 DM kaydi",
      fields: [
        { name: "👤 Gonderen", value: interaction.user.tag, inline: true },
        { name: "🎯 Alici", value: user.tag, inline: true },
        { name: "📰 Baslik", value: title, inline: false },
        { name: "💬 Mesaj", value: message.slice(0, 1024), inline: false }
      ]
    })
  );

  await replyWithEmbed(interaction, {
    color: 0x57f287,
    title: "✅ DM Gonderildi",
    description: `${user.tag} kullanicisina embed mesaj iletildi.`
  });
}

async function claimTicket(interaction, ticket, config) {
  if (!ensureStaff(interaction, config)) {
    await replyWithEmbed(interaction, {
      color: 0xe74c3c,
      title: "⛔ Yetki Yok",
      description: "Bu islemi sadece yetkili ekip kullanabilir."
    });
    return;
  }

  updateGuildConfig(interaction.guildId, (current) =>
    updateTicketRecord(current, interaction.channelId, (currentTicket) => ({
      ...currentTicket,
      claimedBy: interaction.user.id
    }))
  );

  await interaction.reply({
    embeds: [
      createEmbed({
        color: 0x3498db,
        title: "🧑‍💼 Ticket Ustlenildi",
        description: `${interaction.user} bu destek talebini ustlendi.`,
        footer: "👨‍🔧 Yetkili islemi"
      })
    ]
  });

  await sendLog(
    interaction.guild,
    createEmbed({
      color: 0x3498db,
      title: "📜 Ticket Ustlenildi",
      footer: "🧑‍💼 Personel hareketi",
      fields: [
        { name: "📌 Kanal", value: `<#${ticket.channelId}>`, inline: true },
        { name: "👤 Yetkili", value: interaction.user.tag, inline: true }
      ]
    })
  );
}

async function showUserManagementModal(interaction) {
  const modal = new ModalBuilder().setCustomId("ticket-user-management-modal").setTitle("👥 Uye Yonetimi");

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("action")
        .setLabel("Islem")
        .setPlaceholder("ekle veya cikar")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("userId")
        .setLabel("Kullanici ID")
        .setPlaceholder("Islem uygulanacak uye ID")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    )
  );

  await interaction.showModal(modal);
}

async function closeTicket(interaction, ticket, config) {
  if (!ensureStaff(interaction, config)) {
    await replyWithEmbed(interaction, {
      color: 0xe74c3c,
      title: "⛔ Yetki Yok",
      description: "Bu islemi sadece yetkili ekip kullanabilir."
    });
    return;
  }

  const owner = await client.users.fetch(ticket.ownerId).catch(() => null);
  const messages = await interaction.channel.messages.fetch({ limit: 100 }).catch(() => null);
  const transcriptText = messages
    ? [...messages.values()]
        .reverse()
        .map((msg) => `[${new Date(msg.createdTimestamp).toLocaleString("tr-TR")}] ${msg.author.tag}: ${msg.content || "[ek/icerik]"}`)
        .join("\n")
    : "Transkript alinamadi.";

  const transcript = new AttachmentBuilder(Buffer.from(transcriptText, "utf8"), {
    name: `ticket-${interaction.channel.name}.txt`
  });

  const dmSent = owner
    ? await safeDm(
        owner,
        createEmbed({
          color: 0xe74c3c,
          title: "🔒 Destek Talebin Kapatildi",
          description: `${interaction.guild.name} sunucusundaki destek talebin personel tarafindan kapatildi.`,
          footer: "⭐ Asagidan destek deneyimini puanlayabilirsin",
          fields: [{ name: "🎫 Ticket", value: interaction.channel.name, inline: true }]
        }),
        [buildFeedbackRow(interaction.guildId, ticket.channelId)]
      )
    : false;

  await sendLog(
    interaction.guild,
    createEmbed({
      color: 0xe74c3c,
      title: "📜 Ticket Kapatildi",
      footer: "📁 Transkript eklendi",
      fields: [
        { name: "🎫 Kanal", value: interaction.channel.name, inline: true },
        { name: "👤 Kullanici", value: `<@${ticket.ownerId}>`, inline: true },
        { name: "🔐 Kapatan", value: interaction.user.tag, inline: true },
        { name: "✉️ DM", value: dmSent ? "✅ Gonderildi" : "❌ Gonderilemedi", inline: true }
      ]
    }),
    [transcript]
  );

  updateGuildConfig(interaction.guildId, (current) => removeTicketRecord(current, interaction.channelId));

  await interaction.reply({
    embeds: [
      createEmbed({
        color: 0xe74c3c,
        title: "🗑️ Ticket Kapatiliyor",
        description: "Kanal kisa bir sure sonra silinecek."
      })
    ]
  });

  await interaction.channel.delete("Ticket kapatildi").catch(() => null);
}

async function handleUserPermissionModal(interaction) {
  const ticket = getTicketByChannel(interaction.guildId, interaction.channelId);
  const config = getGuildConfig(interaction.guildId);

  if (!ticket || !config) {
    await replyWithEmbed(interaction, {
      color: 0xe74c3c,
      title: "❌ Ticket Kaydi Yok",
      description: "Bu kanal aktif bir ticket olarak kayitli degil."
    });
    return;
  }

  if (!ensureStaff(interaction, config)) {
    await replyWithEmbed(interaction, {
      color: 0xe74c3c,
      title: "⛔ Yetki Yok",
      description: "Bu islemi sadece yetkili ekip kullanabilir."
    });
    return;
  }

  const action = normalizeAction(interaction.fields.getTextInputValue("action"));
  if (!action) {
    await replyWithEmbed(interaction, {
      color: 0xe74c3c,
      title: "⚠️ Gecersiz Islem",
      description: "Islem alanina sadece `ekle` veya `cikar` yaz."
    });
    return;
  }

  const userId = interaction.fields.getTextInputValue("userId").trim();
  const member = await interaction.guild.members.fetch(userId).catch(() => null);
  if (!member) {
    await replyWithEmbed(interaction, {
      color: 0xe74c3c,
      title: "🔎 Uye Bulunamadi",
      description: "Bu ID ile uye bulunamadi."
    });
    return;
  }

  if (action === "add") {
    await interaction.channel.permissionOverwrites.edit(member.id, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true
    });
  } else {
    await interaction.channel.permissionOverwrites.delete(member.id).catch(() => null);
  }

  const added = action === "add";
  await interaction.reply({
    embeds: [
      createEmbed({
        color: added ? 0x57f287 : 0xf39c12,
        title: added ? "➕ Uye Eklendi" : "➖ Uye Cikarildi",
        description: `${member.user.tag} icin ticket erisimi guncellendi.`
      })
    ]
  });

  await sendLog(
    interaction.guild,
    createEmbed({
      color: 0x95a5a6,
      title: "📜 Ticket Yetki Guncellemesi",
      footer: "👥 Kanal izin hareketi",
      fields: [
        { name: "📌 Kanal", value: `<#${interaction.channelId}>`, inline: true },
        { name: "👤 Uye", value: member.user.tag, inline: true },
        { name: "🛠️ Islem", value: added ? "➕ Eklendi" : "➖ Cikarildi", inline: true },
        { name: "👮 Yapan", value: interaction.user.tag, inline: true }
      ]
    })
  );
}

async function handleFeedback(interaction, guildId, ticketId, rating) {
  const config = getGuildConfig(guildId);
  if (!config) {
    await interaction.reply({
      embeds: [
        createEmbed({
          color: 0xe74c3c,
          title: "⚠️ Sunucu Ayari Bulunamadi",
          description: "Bu puanlama kaydedilemedi."
        })
      ],
      ephemeral: true
    });
    return;
  }

  updateGuildConfig(guildId, (current) => {
    const feedback = [...(current.feedback ?? [])];
    feedback.push({
      ticketId,
      guildId,
      userId: interaction.user.id,
      rating: Number(rating),
      createdAt: Date.now()
    });
    return { ...current, feedback };
  });

  await interaction.update({
    embeds: [
      createEmbed({
        color: 0x2ecc71,
        title: "⭐ Geri Bildirim Kaydedildi",
        description: `Tesekkurler. Destek surecini ${rating}/5 olarak puanladin.`,
        footer: "💚 Yorumun ekibe iletildi"
      })
    ],
    components: []
  });

  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) return;

  await sendLog(
    guild,
    createEmbed({
      color: 0x2ecc71,
      title: "📜 Kullanici Yorumu Alindi",
      footer: "⭐ Memnuniyet kaydi",
      fields: [
        { name: "👤 Kullanici", value: interaction.user.tag, inline: true },
        { name: "🎫 Ticket", value: ticketId, inline: true },
        { name: "⭐ Puan", value: `${rating}/5`, inline: true }
      ]
    })
  );
}

client.once(Events.ClientReady, (readyClient) => {
  console.log(`${readyClient.user.tag} aktif.`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === "kurulum") {
        const category = interaction.options.getChannel("ticket_kategori", true);
        const logChannel = interaction.options.getChannel("log_kanali", true);
        const staffRole = interaction.options.getRole("yetkili_rol", true);
        const welcomeMessage =
          interaction.options.getString("hosgeldin_mesaji") ||
          "Talebin alindi. Ekibimiz seninle burada ilgilenecek.";

        updateGuildConfig(interaction.guildId, (current) => ({
          ...current,
          categoryId: category.id,
          logChannelId: logChannel.id,
          staffRoleId: staffRole.id,
          welcomeMessage,
          tickets: current.tickets ?? {},
          feedback: current.feedback ?? []
        }));

        await interaction.reply({
          embeds: [
            createEmbed({
              color: 0x57f287,
              title: "⚙️ Destek Sistemi Kuruldu",
              footer: "🛠️ Sunucu ayarlari kaydedildi",
              fields: [
                { name: "📁 Ticket Kategorisi", value: `<#${category.id}>`, inline: true },
                { name: "📜 Log Kanali", value: `<#${logChannel.id}>`, inline: true },
                { name: "🛡️ Yetkili Rol", value: `<@&${staffRole.id}>`, inline: true }
              ]
            })
          ],
          ephemeral: true
        });
        return;
      }

      if (interaction.commandName === "panel") {
        await sendPanel(interaction);
        return;
      }

      if (interaction.commandName === "dmgonder") {
        await sendDirectMessage(interaction);
      }
      return;
    }

    if (interaction.isStringSelectMenu() && interaction.customId === "ticket-type-select") {
      await createTicket(interaction, interaction.values[0]);
      return;
    }

    if (interaction.isButton()) {
      const ticket = getTicketByChannel(interaction.guildId, interaction.channelId);
      const config = getGuildConfig(interaction.guildId);

      if (interaction.customId === "ticket-claim" && ticket && config) {
        await claimTicket(interaction, ticket, config);
        return;
      }

      if (interaction.customId === "ticket-manage-user") {
        await showUserManagementModal(interaction);
        return;
      }

      if (interaction.customId === "ticket-close" && ticket && config) {
        await closeTicket(interaction, ticket, config);
        return;
      }

      if (interaction.customId.startsWith("feedback:")) {
        const [, guildId, ticketId, rating] = interaction.customId.split(":");
        await handleFeedback(interaction, guildId, ticketId, rating);
      }
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId === "ticket-user-management-modal") {
      await handleUserPermissionModal(interaction);
    }
  } catch (error) {
    console.error(error);

    if (!interaction.isRepliable()) return;

    const payload = {
      embeds: [
        createEmbed({
          color: 0xe74c3c,
          title: "❌ Islem Basarisiz",
          description: "Islem sirasinda beklenmeyen bir hata olustu."
        })
      ],
      ephemeral: true
    };

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(payload).catch(() => null);
    } else {
      await interaction.reply(payload).catch(() => null);
    }
  }
});

(async () => {
  await registerCommands();
  await client.login(TOKEN);
})();
