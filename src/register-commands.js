import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

const statusChoices = ['noted', 'processing', 'completed', 'cancelled'].map(s => ({ name: s, value: s }));

const order = new SlashCommandBuilder()
  .setName('order')
  .setDescription('Post an order embed with a status dropdown')
  .addUserOption(o => o.setName('buyer').setDescription('Buyer').setRequired(true))
  .addStringOption(o => o.setName('product').setDescription('Product name').setRequired(true))
  .addStringOption(o => o.setName('amount').setDescription('Amount/Price').setRequired(true))
  .addStringOption(o => o.setName('payment').setDescription('Payment method').setRequired(true)
    .addChoices(
      { name: 'GCash', value: 'gcash' },
      { name: 'PayMaya', value: 'paymaya' },
      { name: 'QRPH', value: 'qrph' },
      { name: 'MariBank', value: 'maribank' }
    ))
  .addIntegerOption(o => o.setName('quantity').setDescription('Quantity').setRequired(false))
  .addUserOption(o => o.setName('handler').setDescription('Handler'));

const edit = new SlashCommandBuilder()
  .setName('edit')
  .setDescription('Edit dropdown settings')
  .addSubcommand(sc => sc
    .setName('emoji')
    .setDescription('Set emoji for status')
    .addStringOption(o => o.setName('status').setDescription('Status').setRequired(true).addChoices(...statusChoices))
    .addStringOption(o => o.setName('emoji').setDescription('Emoji').setRequired(true)))
  .addSubcommand(sc => sc
    .setName('label')
    .setDescription('Set label for status')
    .addStringOption(o => o.setName('status').setDescription('Status').setRequired(true).addChoices(...statusChoices))
    .addStringOption(o => o.setName('label').setDescription('Label').setRequired(true)))
  .addSubcommand(sc => sc
    .setName('description')
    .setDescription('Set description for status')
    .addStringOption(o => o.setName('status').setDescription('Status').setRequired(true).addChoices(...statusChoices))
    .addStringOption(o => o.setName('description').setDescription('Description').setRequired(true)));

const paymentMethods = ['gcash','paymaya','qrph','maribank'].map(s => ({ name: s.toUpperCase(), value: s }));

const payment = new SlashCommandBuilder()
  .setName('payment')
  .setDescription('Manage payment layout and details')
  .addSubcommand(sc => sc
    .setName('set-details')
    .setDescription('Set account holder and number')
    .addStringOption(o => o.setName('method').setDescription('Payment method').setRequired(true).addChoices(...paymentMethods))
    .addStringOption(o => o.setName('name').setDescription('Account holder').setRequired(true))
    .addStringOption(o => o.setName('number').setDescription('Account number').setRequired(true))
    .addStringOption(o => o.setName('label').setDescription('Display label').setRequired(false)))
  .addSubcommand(sc => sc
    .setName('set-text')
    .setDescription('Set title and note text')
    .addStringOption(o => o.setName('method').setDescription('Payment method').setRequired(true).addChoices(...paymentMethods))
    .addStringOption(o => o.setName('title').setDescription('Title text').setRequired(false))
    .addStringOption(o => o.setName('note').setDescription('Note text').setRequired(false)))
  .addSubcommand(sc => sc
    .setName('set-emoji')
    .setDescription('Set title and note emojis')
    .addStringOption(o => o.setName('method').setDescription('Payment method').setRequired(true).addChoices(...paymentMethods))
    .addStringOption(o => o.setName('title_emoji').setDescription('Title emoji (unicode or <:name:id>)').setRequired(false))
    .addStringOption(o => o.setName('note_emoji').setDescription('Note emoji (unicode or <:name:id>)').setRequired(false)))
  .addSubcommand(sc => sc
    .setName('show')
    .setDescription('Preview payment layout')
    .addStringOption(o => o.setName('method').setDescription('Payment method').setRequired(true).addChoices(...paymentMethods)));

const templateKeysEmoji = ['queueEmoji','currencyEmoji'].map(k => ({ name: k, value: k }));
const templateKeysText = ['headerText','handlerPrefix','statusPrefix'].map(k => ({ name: k, value: k }));

const template = new SlashCommandBuilder()
  .setName('template')
  .setDescription('Edit order template texts and emojis')
  .addSubcommand(sc => sc
    .setName('set-text')
    .setDescription('Set a template text value')
    .addStringOption(o => o.setName('key').setDescription('Text key').setRequired(true).addChoices(...templateKeysText))
    .addStringOption(o => o.setName('value').setDescription('Text value').setRequired(true)))
  .addSubcommand(sc => sc
    .setName('set-emoji')
    .setDescription('Set a template emoji value')
    .addStringOption(o => o.setName('key').setDescription('Emoji key').setRequired(true).addChoices(...templateKeysEmoji))
    .addStringOption(o => o.setName('emoji').setDescription('Emoji (unicode or <:name:id>)').setRequired(true)))
  .addSubcommand(sc => sc
    .setName('show')
    .setDescription('Preview template'));

const TOKEN = process.env.BOT_TOKEN || process.env.DISCORD_TOKEN;
const APP_ID = process.env.APP_ID || process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const rest = new REST({ version: '10' }).setToken(TOKEN);
const inquire = new SlashCommandBuilder().setName('inquire').setDescription('Send inquiry menu via DM');
const join = new SlashCommandBuilder().setName('join').setDescription('Join discord calls')
  .addStringOption(o => o.setName('channel_id').setDescription('Voice channel ID').setRequired(false));
const joinVoice = new SlashCommandBuilder().setName('join-voice').setDescription('Join a voice channel')
  .addStringOption(o => o.setName('channel_id').setDescription('Voice channel ID').setRequired(false));
const leaveVoice = new SlashCommandBuilder().setName('leave-voice').setDescription('Leave voice channel');
const play = new SlashCommandBuilder().setName('play').setDescription('Play a YouTube audio in voice')
  .addStringOption(o => o.setName('url').setDescription('YouTube URL').setRequired(true));
const stop = new SlashCommandBuilder().setName('stop').setDescription('Stop audio and leave voice');
const rules = new SlashCommandBuilder().setName('rules').setDescription('Post rules with verify button');
const say = new SlashCommandBuilder().setName('say').setDescription('Send a message with a verify button')
  .addStringOption(o => o.setName('message').setDescription('Message').setRequired(true));
const sayModal = new SlashCommandBuilder().setName('say-modal').setDescription('Send a message using a multi-line text form');
const setupTicketing = new SlashCommandBuilder().setName('setup-ticketing').setDescription('Post Ticketing Booth with buttons');
const shop = new SlashCommandBuilder().setName('shop').setDescription('Start purchase flow');
const ticket = new SlashCommandBuilder().setName('ticket').setDescription('Create an order ticket')
  .addStringOption(o => o.setName('subject').setDescription('Ticket subject').setRequired(true));
const verify = new SlashCommandBuilder().setName('verify').setDescription('Send a message with an OAuth verify link button');

await rest.put(Routes.applicationGuildCommands(APP_ID, GUILD_ID), { body: [
  order.toJSON(), edit.toJSON(), payment.toJSON(), template.toJSON(),
  inquire.toJSON(), join.toJSON(), joinVoice.toJSON(), leaveVoice.toJSON(),
  play.toJSON(), stop.toJSON(), rules.toJSON(), say.toJSON(), sayModal.toJSON(),
  setupTicketing.toJSON(), shop.toJSON(), ticket.toJSON(), verify.toJSON()
] });
console.log('Commands registered.');
