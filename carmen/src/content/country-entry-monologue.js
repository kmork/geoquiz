/**
 * Build a short noir inner monologue for arriving in a new country.
 *
 * Content source is the country's `history` field from countries.json.
 * The result should feel authored, concise, and grounded in that text.
 */

const HISTORY_KEYWORDS = [
  'empire',
  'war',
  'independence',
  'independent',
  'colon',
  'kingdom',
  'revolution',
  'civil war',
  'unified',
  'reunif',
  'trade',
  'ancient',
  'invad',
  'crisis',
  'reform',
  'protectorate',
  'democracy',
];

const PREFACES = [
  'The file said enough.',
  'You could feel it before the wheels stopped.',
  'Places like this never really bury the past.',
  'The past still has a pulse here.',
];

function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) - hash) + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function splitSentences(text) {
  return String(text || '')
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map(part => part.trim())
    .filter(Boolean);
}

function scoreSentence(sentence) {
  const lower = sentence.toLowerCase();
  let score = 0;

  for (const keyword of HISTORY_KEYWORDS) {
    if (lower.includes(keyword)) score += 4;
  }

  const lengthDelta = Math.abs(sentence.length - 110);
  score += Math.max(0, 24 - Math.floor(lengthDelta / 6));

  if (/\d{4}/.test(sentence)) score += 2;
  if (sentence.length < 45) score -= 3;
  if (sentence.length > 180) score -= 4;

  return score;
}

function pickHistoryBeat(country, historyText) {
  const sentences = splitSentences(historyText);
  if (sentences.length === 0) return '';

  const best = [...sentences].sort((a, b) => scoreSentence(b) - scoreSentence(a))[0];
  const escapedCountry = country.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  return best
    .replace(new RegExp(`^${escapedCountry}\\b`, 'i'), 'It')
    .replace(/\s+/g, ' ')
    .trim();
}

function trimLine(text, maxLength = 180) {
  if (text.length <= maxLength) return text;
  const truncated = text.slice(0, maxLength - 1);
  const cutoff = truncated.lastIndexOf(' ');
  return `${(cutoff > 80 ? truncated.slice(0, cutoff) : truncated).trim()}…`;
}

export function buildCountryEntryMonologue(country, historyText) {
  const beat = pickHistoryBeat(country, historyText);
  if (!beat) return '';

  const preface = PREFACES[hashString(country) % PREFACES.length];
  return trimLine(`${country}. ${preface} ${beat}`);
}
