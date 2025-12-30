import fs from 'node:fs/promises';
import path from 'node:path';

const FILE_PATH = path.join(process.cwd(), 'data', 'config.json');

export const DEFAULT_STATUSES = {
  noted: { label: 'Noted', description: 'Order has been noted', emoji: '📝' },
  processing: { label: 'Processing', description: 'Order is being processed', emoji: '⚙️' },
  completed: { label: 'Completed', description: 'Order has been completed', emoji: '✅' }
};

export const DEFAULT_PAYMENTS = {
  gcash: { label: 'GCash', name: '', number: '', title: 'payment details', titleEmoji: '🧾', note: 'no receipt = no payment', noteEmoji: '🍰' },
  paymaya: { label: 'PayMaya', name: '', number: '', title: 'payment details', titleEmoji: '🧾', note: 'no receipt = no payment', noteEmoji: '🍰' },
  qrph: { label: 'QRPH', name: '', number: '', title: 'payment details', titleEmoji: '🧾', note: 'no receipt = no payment', noteEmoji: '🍰' },
  maribank: { label: 'MariBank', name: '', number: '', title: 'payment details', titleEmoji: '🧾', note: 'no receipt = no payment', noteEmoji: '🍰' }
};

export const DEFAULT_TEMPLATE = {
  headerText: '.  order  confirmed  by . . .',
  queueEmoji: '🐇',
  currencyEmoji: '₵',
  handlerPrefix: '♡  handler :',
  statusPrefix: '•  order  status :'
};

export async function readConfig() {
  try {
    const raw = await fs.readFile(FILE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      statuses: { ...DEFAULT_STATUSES, ...(parsed.statuses || {}) },
      payments: { ...DEFAULT_PAYMENTS, ...(parsed.payments || {}) },
      template: { ...DEFAULT_TEMPLATE, ...(parsed.template || {}) }
    };
  } catch {
    return { statuses: DEFAULT_STATUSES, payments: DEFAULT_PAYMENTS, template: DEFAULT_TEMPLATE };
  }
}

export async function writeConfig(cfg) {
  await fs.mkdir(path.dirname(FILE_PATH), { recursive: true });
  await fs.writeFile(FILE_PATH, JSON.stringify(cfg, null, 2));
}

export function parseEmoji(input) {
  if (!input) return null;
  const mention = input.match(/^<a?:([^:>]+):(\d+)>$/);
  if (mention) return { name: mention[1], id: mention[2], animated: input.startsWith('<a:') };
  const triple = input.match(/^(\d+):([^:]+):(true|false)$/);
  if (triple) return { id: triple[1], name: triple[2], animated: triple[3] === 'true' };
  return input;
}

export async function getStatusOptions() {
  const cfg = await readConfig();
  return Object.entries(cfg.statuses).map(([value, o]) => ({
    label: o.label,
    description: o.description,
    value,
    emoji: parseEmoji(o.emoji)
  }));
}

export async function getPayment(method) {
  const cfg = await readConfig();
  const p = cfg.payments[method] || DEFAULT_PAYMENTS[method] || { label: method, name: '', number: '', title: 'payment details', titleEmoji: '🧾', note: '', noteEmoji: '' };
  return {
    ...p,
    titleEmojiParsed: parseEmoji(p.titleEmoji),
    noteEmojiParsed: parseEmoji(p.noteEmoji)
  };
}

export async function setPayment(method, fields) {
  const cfg = await readConfig();
  cfg.payments[method] = { ...(cfg.payments[method] || DEFAULT_PAYMENTS[method] || {}), ...fields };
  await writeConfig(cfg);
  return cfg.payments[method];
}

export async function getTemplate() {
  const cfg = await readConfig();
  return cfg.template || DEFAULT_TEMPLATE;
}

export async function setTemplate(fields) {
  const cfg = await readConfig();
  cfg.template = { ...(cfg.template || DEFAULT_TEMPLATE), ...fields };
  await writeConfig(cfg);
  return cfg.template;
}
