import 'dotenv/config';
import { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, PermissionsBitField } from 'discord.js';
import { readConfig, writeConfig, getStatusOptions, getPayment, setPayment, getTemplate, setTemplate } from './config/store.js';
import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, NoSubscriberBehavior, getVoiceConnection } from '@discordjs/voice';
import ytdl from 'ytdl-core';

// Always register commands if not explicitly disabled
if (process.env.AUTO_REGISTER !== 'false') {
  await import('./register-commands.js');
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const TOKEN = process.env.BOT_TOKEN || process.env.DISCORD_TOKEN;
const ORDER_CHANNEL_ID = process.env.ORDER_LIST_CHANNEL_ID || process.env.ORDER_CHANNEL_ID;
const DEFAULT_VOICE_IDS = (process.env.VOICE_CHANNEL_IDS || '').split(',').filter(Boolean);
const connections = new Map();
const players = new Map();

let STATUS_OPTIONS_CACHE = await getStatusOptions();

function makeStatusSelect(currentValue = 'noted') {
  const options = STATUS_OPTIONS_CACHE.map(opt => ({
    ...opt,
    default: opt.value === currentValue
  }));

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('order-status')
      .setPlaceholder('Update Queue Status')
      .addOptions(options)
      .setMinValues(1)
      .setMaxValues(1)
  );
}

function makeOrderEmbed({ buyer, handler, product, amount, payment, quantity = 1, statusLabel }) {
  const timestamp = Math.floor(Date.now() / 1000);
  const description = [
    `\u200b\u2003\u2003𐙚  ﹕  ⸝⸝   𝒐rder 𝒄onfirmed 𝒃y ﹒  ᵎᵎ   <:d04:1448466067809767506>`,
    ``,
    `\u200b\u2003\u2003\u2003\u2003\u2003\u2003⊹﹒ ${buyer}  <:b01:1453989929276149812>`,
    `\u200b\u2003\u2003\u2003\u2003\u2003\u2003⊹﹒﹝wuantity﹞ ${quantity} ${product}  𑁯 𓂅`,
    `\u200b\u2003\u2003\u2003\u2003\u2003\u2003⊹﹒  ${amount}  viα  ${payment}   ♡`,
    ``,
    `\u200b\u2003\u2003\u2003\u2003𑣲 ࣪ ˖   𝒉αndler﹕${handler} ﹒ <:d28:1453988844247453696>`,
    `\u200b\u2003\u2003\u2003<a:e13:1448479464974581973>    𝒐rder 𝒔tαtus﹕__${statusLabel}__ <t:${timestamp}:R>  .ᐟ`
  ].join('\n');

  return new EmbedBuilder()
    .setColor(0xE3A7FF)
    .setAuthor({ name: 'n n  choco  ꩜ APP' })
    .setDescription(description);
}

client.once('clientReady', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (!interaction.isChatInputCommand() && !interaction.isStringSelectMenu()) return;

    if (interaction.isChatInputCommand() && interaction.commandName === 'order') {
      const buyer = interaction.options.getUser('buyer');
      const product = interaction.options.getString('product');
      const amount = interaction.options.getString('amount');
      const payment = interaction.options.getString('payment');
      const quantity = interaction.options.getInteger('quantity') ?? 1;
      const handler = interaction.options.getUser('handler') ?? interaction.user;

      const embed = makeOrderEmbed({
        buyer: buyer,
        handler: handler,
        product,
        amount,
        payment,
        quantity,
        statusLabel: 'waiting'
      });

      if (ORDER_CHANNEL_ID) {
        const channel = await interaction.client.channels.fetch(ORDER_CHANNEL_ID).catch(() => null);
        if (channel) {
          const sent = await channel.send({ embeds: [embed], components: [makeStatusSelect('noted')] });
          await interaction.reply({ content: `Order posted: ${sent.url}`, ephemeral: true });
          return;
        }
      }
      await interaction.reply({ embeds: [embed], components: [makeStatusSelect('noted')] });
      return;
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'order-status') {
      const value = interaction.values[0];
      const labelMap = { noted: 'waiting', processing: 'processing', completed: 'completed', cancelled: 'cancelled' };
      const message = await interaction.message.fetch();
      const oldEmbed = message.embeds[0];
      let description = oldEmbed.description;
      
      // Regex to replace status - simplified to be more robust
      // Matches "𝒐rder 𝒔tαtus﹕__" followed by anything until "__"
      const statusRegex = /(𝒐rder 𝒔tαtus﹕__)(.*?)(__ <t:)/;
      
      if (statusRegex.test(description)) {
          description = description.replace(statusRegex, `$1${labelMap[value]}$3`);
      } else {
          // Fallback if regex fails (e.g. slight formatting differences)
          console.log('Status regex mismatch:', description);
      }

      const embed = new EmbedBuilder()
        .setColor(0xE3A7FF)
        .setAuthor({ name: 'n n  choco  ꩜ APP' })
        .setDescription(description);

      await interaction.update({ embeds: [embed], components: [makeStatusSelect(value)] });
      return;
    }

    // ... rest of the handlers (edit, inquire, etc)


  if (interaction.isChatInputCommand() && interaction.commandName === 'edit') {
    const member = interaction.member;
    const allowed = member?.permissions?.has(PermissionsBitField.Flags.ManageGuild);
    if (!allowed) {
      await interaction.reply({ content: 'You need Manage Server permission to use /edit.', ephemeral: true });
      return;
    }
    const sub = interaction.options.getSubcommand();
    const status = interaction.options.getString('status');
    const cfg = await readConfig();
    const target = cfg.statuses[status];
    if (!target) {
      await interaction.reply({ content: `Unknown status: ${status}`, ephemeral: true });
      return;
    }
    if (sub === 'emoji') {
      const emojiInput = interaction.options.getString('emoji');
      target.emoji = emojiInput;
    } else if (sub === 'label') {
      const label = interaction.options.getString('label');
      target.label = label;
    } else if (sub === 'description') {
      const desc = interaction.options.getString('description');
      target.description = desc;
    }
    await writeConfig(cfg);
    STATUS_OPTIONS_CACHE = await getStatusOptions();
    await interaction.reply({ content: `Updated ${status} ${sub}.`, ephemeral: true });
    return;
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'inquire') {
    const embed = new EmbedBuilder().setColor(0x9b59b6).setTitle('Inquiry Menu').setDescription('Please send your inquiry here.');
    try {
      await interaction.user.send({ embeds: [embed] });
      await interaction.reply({ content: 'Sent you a DM.', ephemeral: true });
    } catch {
      await interaction.reply({ content: 'Cannot send DM.', ephemeral: true });
    }
    return;
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'join' || (interaction.isChatInputCommand() && interaction.commandName === 'join-voice')) {
    const channelId = interaction.options.getString('channel_id') || DEFAULT_VOICE_IDS[0];
    const guild = interaction.guild;
    if (!channelId) {
      await interaction.reply({ content: 'No voice channel configured.', ephemeral: true });
      return;
    }
    const connection = joinVoiceChannel({ channelId, guildId: guild.id, adapterCreator: guild.voiceAdapterCreator });
    connections.set(guild.id, connection);
    const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } });
    players.set(guild.id, player);
    connection.subscribe(player);
    await interaction.reply({ content: 'Joined voice.', ephemeral: true });
    return;
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'leave-voice') {
    const conn = getVoiceConnection(interaction.guild.id) || connections.get(interaction.guild.id);
    if (conn) conn.destroy();
    players.delete(interaction.guild.id);
    await interaction.reply({ content: 'Left voice.', ephemeral: true });
    return;
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'play') {
    const url = interaction.options.getString('url');
    const player = players.get(interaction.guild.id);
    const conn = getVoiceConnection(interaction.guild.id);
    if (!player || !conn) {
      await interaction.reply({ content: 'Join a voice channel first.', ephemeral: true });
      return;
    }
    const stream = ytdl(url, { filter: 'audioonly', quality: 'highestaudio', highWaterMark: 1 << 25 });
    const resource = createAudioResource(stream);
    player.play(resource);
    await interaction.reply({ content: 'Playing.', ephemeral: true });
    return;
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'stop') {
    const player = players.get(interaction.guild.id);
    if (player) player.stop();
    const conn = getVoiceConnection(interaction.guild.id);
    if (conn) conn.destroy();
    await interaction.reply({ content: 'Stopped.', ephemeral: true });
    return;
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'rules') {
    const channelId = process.env.RULES_CHANNEL_ID;
    const link = process.env.VERIFY_REDIRECT_URL || '';
    const embed = new EmbedBuilder().setColor(0x2ecc71).setTitle('Server Rules').setDescription('Please read and verify.');
    const btnRow = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder().setCustomId('noop').setPlaceholder('Actions').addOptions({ label: 'Verify', description: 'Open verify link', value: link || 'verify' })
    );
    if (channelId) {
      const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
      if (channel) {
        await channel.send({ embeds: [embed], components: [btnRow] });
        await interaction.reply({ content: 'Rules posted.', ephemeral: true });
        return;
      }
    }
    await interaction.reply({ embeds: [embed], components: [btnRow], ephemeral: true });
    return;
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'say') {
    const message = interaction.options.getString('message');
    const link = process.env.VERIFY_REDIRECT_URL || '';
    const embed = new EmbedBuilder().setColor(0x3498db).setDescription(message);
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'say-modal') {
    await interaction.reply({ content: 'Open a modal is not supported in this minimal build.', ephemeral: true });
    return;
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'setup-ticketing') {
    await interaction.reply({ content: 'Ticketing booth posted.', ephemeral: true });
    return;
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'shop') {
    const embed = new EmbedBuilder()
      .setColor(0xE3A7FF)
      .setTitle('Shop Rules & Verification')
      .setDescription('Please read the rules below and verify to proceed with your order.\n\n1. No refunds.\n2. Be patient.\n3. Respect staff.');
    
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('shop-flow')
        .setPlaceholder('Select an action')
        .addOptions([
          { label: 'Verify', description: 'Agree to rules and start order', value: 'verify', emoji: '✅' }
        ])
    );

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    return;
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'shop-flow') {
    const value = interaction.values[0];

    if (value === 'verify') {
      const embed = new EmbedBuilder()
        .setColor(0xE3A7FF)
        .setTitle('Select Order Type')
        .setDescription('What would you like to order today?');

      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('shop-flow')
          .setPlaceholder('Choose a product')
          .addOptions([
            { label: 'Nitro', description: 'Discord Nitro', value: 'product_nitro', emoji: '💎' },
            { label: 'Robux', description: 'Roblox Currency', value: 'product_robux', emoji: '💰' },
            { label: 'V-Bucks', description: 'Fortnite Currency', value: 'product_vbucks', emoji: '🎮' },
            { label: 'Other', description: 'Something else', value: 'product_other', emoji: '📦' }
          ])
      );
      
      await interaction.update({ embeds: [embed], components: [row] });
      return;
    }

    if (value.startsWith('product_')) {
      const product = value.replace('product_', '');
      const embed = new EmbedBuilder()
        .setColor(0xE3A7FF)
        .setTitle('Transaction Process')
        .setDescription(`You selected **${product.toUpperCase()}**.\n\n**Please Note:**\n• **40 Pesos** will be deducted for the refund fee.\n• Please ensure you agree to this before proceeding.`);

      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('shop-flow')
          .setPlaceholder('Select an action')
          .addOptions([
            { label: 'Proceed to Payment', description: 'I agree to the fee', value: `confirm_${product}`, emoji: '➡️' }
          ])
      );

      await interaction.update({ embeds: [embed], components: [row] });
      return;
    }

    if (value.startsWith('confirm_')) {
      const product = value.replace('confirm_', '');
      const embed = new EmbedBuilder()
        .setColor(0xE3A7FF)
        .setTitle('Select Payment Method')
        .setDescription(`Processing order for **${product.toUpperCase()}**. How would you like to pay?`);

      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('shop-flow')
          .setPlaceholder('Choose payment method')
          .addOptions([
            { label: 'GCash', value: 'payment_gcash', emoji: '💳' },
            { label: 'PayMaya', value: 'payment_paymaya', emoji: '💳' },
            { label: 'QRPH', value: 'payment_qrph', emoji: '📲' },
            { label: 'MariBank', value: 'payment_maribank', emoji: '🏦' }
          ])
      );

      await interaction.update({ embeds: [embed], components: [row] });
      return;
    }

    if (value.startsWith('payment_')) {
      const method = value.replace('payment_', '');
      const p = await getPayment(method);
      const lines = [
        `${p.titleEmoji ? p.titleEmoji : '🧾'}  ${p.title || 'payment details'}`,
        `${p.label.toUpperCase()} ${[p.number, p.name].filter(Boolean).join(' ')}`.trim(),
        `${p.noteEmoji ? p.noteEmoji : '🍰'}  ${p.note || ''}`.trim()
      ].join('\n');

      const embed = new EmbedBuilder()
        .setColor(0xE3A7FF)
        .setTitle('Payment Details')
        .setDescription(lines)
        .setFooter({ text: 'Please send a screenshot of your payment to the staff.' });

      // End the flow (remove components)
      await interaction.update({ embeds: [embed], components: [] });
      return;
    }
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'ticket') {
    const subject = interaction.options.getString('subject');
    await interaction.reply({ content: `Created ticket: ${subject}`, ephemeral: true });
    return;
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'verify') {
    const link = process.env.VERIFY_REDIRECT_URL || '';
    await interaction.reply({ content: link ? `Verify here: ${link}` : 'No verify link configured.', ephemeral: true });
    return;
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'payment') {
    const member = interaction.member;
    const allowed = member?.permissions?.has(PermissionsBitField.Flags.ManageGuild);
    if (!allowed) {
      await interaction.reply({ content: 'You need Manage Server permission to use /payment.', ephemeral: true });
      return;
    }
    const sub = interaction.options.getSubcommand();
    const method = interaction.options.getString('method');
    if (sub === 'set-details') {
      const name = interaction.options.getString('name') || '';
      const number = interaction.options.getString('number') || '';
      const label = interaction.options.getString('label') || undefined;
      await setPayment(method, { name, number, ...(label ? { label } : {}) });
      const p = await getPayment(method);
      await interaction.reply({ content: `Updated ${method} details to: ${p.label} ${p.number} ${p.name}`, ephemeral: true });
      return;
    }
    if (sub === 'set-text') {
      const title = interaction.options.getString('title') || undefined;
      const note = interaction.options.getString('note') || undefined;
      await setPayment(method, { ...(title ? { title } : {}), ...(note ? { note } : {}) });
      const p = await getPayment(method);
      await interaction.reply({ content: `Updated ${method} text. Title: ${p.title} • Note: ${p.note}`, ephemeral: true });
      return;
    }
    if (sub === 'set-emoji') {
      const titleEmoji = interaction.options.getString('title_emoji') || undefined;
      const noteEmoji = interaction.options.getString('note_emoji') || undefined;
      await setPayment(method, { ...(titleEmoji ? { titleEmoji } : {}), ...(noteEmoji ? { noteEmoji } : {}) });
      const p = await getPayment(method);
      await interaction.reply({ content: `Updated ${method} emojis. Title: ${p.titleEmoji} • Note: ${p.noteEmoji}`, ephemeral: true });
      return;
    }
    if (sub === 'show') {
      const p = await getPayment(method);
      const lines = [
        `${p.titleEmoji ? p.titleEmoji : '🧾'}  ${p.title || 'payment details'}`,
        `${p.label.toUpperCase()} ${[p.number, p.name].filter(Boolean).join(' ')}`.trim(),
        `${p.noteEmoji ? p.noteEmoji : '🍰'}  ${p.note || ''}`.trim()
      ].join('\n');
      await interaction.reply({ content: lines, ephemeral: true });
      return;
    }
  }

  if (interaction.isChatInputCommand() && interaction.commandName === 'template') {
    const member = interaction.member;
    const allowed = member?.permissions?.has(PermissionsBitField.Flags.ManageGuild);
    if (!allowed) {
      await interaction.reply({ content: 'You need Manage Server permission to use /template.', ephemeral: true });
      return;
    }
    const sub = interaction.options.getSubcommand();
    if (sub === 'set-text') {
      const key = interaction.options.getString('key');
      const value = interaction.options.getString('value');
      const updated = await setTemplate({ [key]: value });
      await interaction.reply({ content: `Updated template ${key} to: ${updated[key]}`, ephemeral: true });
      return;
    }
    if (sub === 'set-emoji') {
      const key = interaction.options.getString('key');
      const emoji = interaction.options.getString('emoji');
      const updated = await setTemplate({ [key]: emoji });
      await interaction.reply({ content: `Updated template ${key} emoji to: ${emoji}`, ephemeral: true });
      return;
    }
    if (sub === 'show') {
      const t = await getTemplate();
      const preview = [
        t.headerText,
        `↪  @ user   #♡  :  queue  :  ${t.queueEmoji}`,
        `${t.currencyEmoji} 13  d₵  effx  ʚ゜`,
        `${t.handlerPrefix}  @ staff`,
        `${t.statusPrefix} order  done`
      ].join('\n');
      await interaction.reply({ content: preview, ephemeral: true });
      return;
    }
  }
  } catch (error) {
    console.error('Interaction error:', error);
    if (interaction.isRepliable() && !interaction.replied) {
      await interaction.reply({ content: 'An error occurred while executing this command.', ephemeral: true });
    }
  }
});
