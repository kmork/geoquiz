/**
 * Country-entry monologues for Carmen transition captions.
 *
 * Tone rules:
 * - first-person detective voice
 * - overcommitted noir with self-aware parody
 * - the joke is usually on the narrator, not the country
 * - modern/anachronistic facts are acknowledged instead of played straight
 */

const COUNTRY_ENTRY_OVERRIDES = {
  Afghanistan: "Afghanistan. Empires keep arriving here as if the mountains are taking appointments. They usually leave as a cautionary tale, and I arrived dressed like one.",
  Andorra: "Andorra. Princes, bishops, mountain air, and a modern constitution in 1993. My inner monologue came prepared for candlelight intrigue and got handed constitutional housekeeping instead.",
  Argentina: "Argentina. Independence, generals, disappearances, and enough tragic grandeur to make my trench coat feel underdressed. I gave the streets my best hardboiled stare. The streets had seen better performances.",
  Belgium: "Belgium. Small country, long colonial shadow, and enough diplomacy to make guilt wear a necktie. Brussels looked respectable, which in my line of work is practically a written confession.",
  "Bosnia and Herzegovina": "Bosnia and Herzegovina. Empires came through, Yugoslavia broke apart, and war left the kind of silence you don't try to improve. I kept the patter low. Even my inner monologue knew when to remove its hat.",
  France: "France. Kingdom, revolution, republic, empire, republic again. The place changed regimes more often than I change bad habits, and I change those only under administrative pressure.",
  Germany: "Germany. Empire, collapse, catastrophe, division, reunification. I showed up ready to narrate history like a tough guy. History here already had the stronger jawline.",
  India: "India. Empire had its turn, then partition came in with the bill and a bloodstain nobody could send back. I reached for atmosphere and found a subcontinent that didn't need my help.",
  Ireland: "Ireland. The file starts with empire and eventually wanders into an economic boom from the 1990s. My inner monologue was built for rain, guilt, and dockside politics, not growth metrics, but the trench coat stayed on.",
  Israel: "Israel. The file moves from statehood and conflict to something called a startup nation. I was aiming for smoky postwar intrigue and got handed venture-capital vocabulary instead.",
  Japan: "Japan. Empire, defeat, reinvention. The country moved faster than my narration could keep up, which was rude, and possibly efficient.",
  Luxembourg: "Luxembourg. A duchy with banker energy and too much poise for a place that small. I came in expecting a minor-key mystery. The country handed me generational wealth with better tailoring.",
  Mexico: "Mexico. Empire, independence, revolution, and a long-running argument with power. The file came with saints, dust, and the kind of drama that makes a detective grateful he brought extra adjectives.",
  Russia: "Russia. Tsars, revolution, Soviet steel, collapse, and the old imperial reflex still twitching under the floorboards. I tried to sound ominous. The file was already doing it professionally.",
  Singapore: "Singapore. Fishing village, imperial trading post, separation in 1965, and then a leap into modern efficiency so abrupt it bruised the genre. I went looking for fog and bribed stevedores. The file handed me policy success.",
  "South Africa": "South Africa. Colony, conquest, apartheid, democracy. The record was too raw to romanticize, which meant the noir act had to stop posing and stand still for once.",
  "South Korea": "South Korea. War, dictatorship, democracy, and then a sprint into modern power that left my 1940s narration wheezing in the alley. I reached for a cigarette metaphor and got handed the future.",
  Spain: "Spain. Empire abroad, civil war at home, dictatorship after that, democracy when the century finally got tired. The country didn't need atmosphere. It needed a filing cabinet and a long exhale.",
  Sweden: "Sweden. Great-power past, long neutrality, then NATO in 2024. The file says alliance politics; my inner monologue says 1947 and a saxophone solo. We were both trying our best.",
  Switzerland: "Switzerland. Medieval alliance, armed neutrality, banking secrecy, and a level of composure that felt frankly theatrical. I hate when a country makes the trench coat look deliberate.",
  Ukraine: "Ukraine. Empires carved at it, famine scarred it, and the present tense still sounds like artillery. I kept the wisecracks off the page. Some files are already louder than noir.",
  "United Kingdom": "United Kingdom. Four nations, one union, and an empire whose fingerprints still turn up in other people's files. It carried itself like a suspect who'd made partner and billed the hours.",
  "United States": "United States. Independence in one hand, expansion in the other, and enough contradictions to keep a detective employed across several lifetimes. The country called itself new with a very straight face, which I almost admired.",
  "Vatican City": "Vatican City. Tiny state, enormous wardrobe, and a treaty from 1929 trying to keep holiness on speaking terms with property law. I arrived prepared for incense and intrigue. For once, the file cooperated.",
};

const THIN_FILE_COUNTRIES = new Set([
  'Aland', 'American Samoa', 'Anguilla', 'Aruba', 'Bermuda', 'British Indian Ocean Territory',
  'British Virgin Islands', 'Cayman Islands', 'Cook Islands', 'Curaçao', 'Falkland Islands',
  'Faroe Islands', 'French Polynesia', 'Gibraltar', 'Greenland', 'Guam', 'Guernsey',
  'Hong Kong', 'Isle of Man', 'Jersey', 'Kosovo', 'Macao', 'Montserrat', 'New Caledonia',
  'Niue', 'Norfolk Island', 'Northern Mariana Islands', 'Palestine', 'Puerto Rico',
  'Saint Barthelemy', 'Saint Helena', 'Saint Martin', 'Saint Pierre and Miquelon',
  'Sint Maarten', 'Taiwan', 'Turks and Caicos Islands', 'United States Virgin Islands',
  'Wallis and Futuna', 'Western Sahara',
]);

const TRAGIC_MARKERS = [
  'genocide', 'civil war', 'world war', 'war of independence', 'famine', 'slave trade',
  'enslaved', 'occupation', 'dictatorship', 'massive displacement', 'humanitarian crisis',
  'annexation', 'full-scale invasion', 'devastating', 'atrocities', 'heavily bombed',
];

const MODERN_MARKERS = [
  '2024', '2023', '2022', '2021', '2016', '2014', '2013', '2011', '2009', '2008', '2007',
  '2004', '1995', '1993', '1991', 'nato', 'european union', 'eu ', 'eurozone', 'startup',
  'tech', 'digital', 'banking', 'financial services', 'tourism', 'gdp', 'economy',
  'economic powerhouse', 'global hub', 'aviation', 'multiculturalism',
];

const IMPERIAL_MARKERS = [
  'empire', 'dynasty', 'kingdom', 'sultanate', 'monarchy', 'colony', 'protectorate',
  'mandate', 'independence', 'republic', 'revolution', 'union', 'federation',
];

function hashString(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function pick(arr, seed) {
  return arr[hashString(seed) % arr.length];
}

function splitSentences(historyText) {
  return String(historyText || '')
    .replace(/\s+/g, ' ')
    .replace(/\bSt\.\s/g, 'St<dot> ')
    .replace(/\bU\.S\.\s/g, 'U<dot>S<dot> ')
    .replace(/\bU\.K\.\s/g, 'U<dot>K<dot> ')
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .map(s => s.replace(/<dot>/g, '.'))
    .filter(Boolean);
}

function normalizeCountryData(country, source) {
  if (source && typeof source === 'object' && !Array.isArray(source)) {
    return {
      ...source,
      history: String(source.history || ''),
      famousFor: Array.isArray(source.famousFor) ? source.famousFor : [],
      exports: Array.isArray(source.exports) ? source.exports : [],
    };
  }
  return {
    country,
    history: String(source || ''),
    famousFor: [],
    exports: [],
  };
}

function includesAny(text, markers) {
  const lower = text.toLowerCase();
  return markers.some(marker => lower.includes(marker));
}

function detectMode(country, historyText) {
  if (!historyText || THIN_FILE_COUNTRIES.has(country)) return 'small-state-dry';
  if (includesAny(historyText, TRAGIC_MARKERS)) return 'tragic-grave';
  if (includesAny(historyText, MODERN_MARKERS)) return 'modern-anachronistic';
  if (includesAny(historyText, IMPERIAL_MARKERS)) return 'imperial-decadent';
  return 'small-state-dry';
}

function shortenSentence(sentence, maxLength = 180) {
  const clean = String(sentence || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLength) return clean;

  const cut = clean.slice(0, maxLength + 1);
  const lastComma = cut.lastIndexOf(',');
  const lastSpace = cut.lastIndexOf(' ');
  const endAt = lastComma > 80 ? lastComma : lastSpace;
  return `${clean.slice(0, endAt).replace(/[,:;]\s*$/, '')}.`;
}

function scoreHistorySentence(sentence) {
  const lower = sentence.toLowerCase();
  let score = 0;
  if (/\b(1[5-9]\d{2}|20\d{2})\b/.test(lower)) score += 5;
  if (includesAny(lower, IMPERIAL_MARKERS)) score += 4;
  if (includesAny(lower, MODERN_MARKERS)) score += 3;
  if (includesAny(lower, TRAGIC_MARKERS)) score += 3;
  if (lower.includes('independence')) score += 4;
  if (lower.includes('colon')) score += 3;
  if (lower.includes('modern') || lower.includes('became') || lower.includes('joined')) score += 2;
  if (sentence.length > 240) score -= 2;
  if (sentence.length < 45) score -= 1;
  return score;
}

function selectHistoryFacts(country, historyText, mode) {
  const sentences = splitSentences(historyText);
  if (!sentences.length) return [];

  const ranked = sentences
    .map((sentence, index) => ({
      sentence,
      index,
      score: scoreHistorySentence(sentence) + ((hashString(`${country}:${index}`) % 3) * 0.1),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const primary = ranked[0];
  const secondary = ranked.find(item => item.index !== primary.index);
  const facts = [primary, secondary].filter(Boolean).sort((a, b) => a.index - b.index);
  const maxFacts = mode === 'small-state-dry' ? 1 : 2;

  return facts.slice(0, maxFacts).map(item => shortenSentence(item.sentence));
}

function overlapsHistoryFact(item, historyFacts) {
  const itemLower = String(item || '').toLowerCase();
  const words = itemLower
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length >= 4 && !['known', 'heritage', 'tradition'].includes(word));
  return historyFacts.some(fact => {
    const factLower = fact.toLowerCase();
    if (factLower.includes(itemLower)) return true;
    const matches = words.filter(word => factLower.includes(word)).length;
    return words.length >= 2 && matches >= 2;
  });
}

function buildSupportFact(country, data, historyFacts = []) {
  const seed = `${country}:support`;
  const famousFor = data.famousFor.filter(item => item && !overlapsHistoryFact(item, historyFacts));
  const exports = data.exports.filter(Boolean);

  if (famousFor.length && (!exports.length || hashString(seed) % 3 !== 0)) {
    const picked = pick(famousFor, seed);
    return pick([
      `A margin note adds ${picked}.`,
      `The short cultural note points to ${picked}.`,
      `ACME's quick reference flags ${picked}.`,
    ], `${seed}:famous:${picked}`);
  }
  if (exports.length) {
    const picked = exports.slice(0, 2).join(' and ');
    return pick([
      `The export ledger starts with ${picked}.`,
      `The trade note begins with ${picked}.`,
      `Its export file opens on ${picked}.`,
    ], `${seed}:exports:${picked}`);
  }
  if (famousFor.length) {
    return `A margin note adds ${famousFor[0]}.`;
  }
  return '';
}

function buildNoirTag(country, mode) {
  const seed = `${country}:${mode}:tag`;
  if (mode === 'tragic-grave') {
    return pick([
      'I kept the wisecracks off the record.',
      'The file did not need embroidery.',
      'Some history asks for a lower voice.',
    ], seed);
  }
  if (mode === 'modern-anachronistic') {
    return pick([
      'My 1940s vocabulary took notes and looked nervous.',
      'The trench coat stayed on, even after the facts left my century.',
      'The genre filed a quiet complaint.',
    ], seed);
  }
  if (mode === 'imperial-decadent') {
    return pick([
      'I let the centuries do most of the talking.',
      'The old power had already supplied the shadows.',
      'My narration kept its hat in its hands.',
    ], seed);
  }
  return pick([
    'I saved the dramatic lighting for the margins.',
    'The case file stayed factual; I tried to behave.',
    'Even my inner monologue learned to keep it brief.',
  ], seed);
}

function buildThinFileMonologue(country, data) {
  const supportFact = buildSupportFact(country, data);
  const base = supportFact
    ? `${country}. ACME has a thin history file here. ${supportFact}`
    : `${country}. ACME has a thin history file here, so the background arrives in fragments rather than chapters.`;
  return `${base} I kept the noir routine in the margins.`;
}

export function buildCountryEntryMonologue(country, countryData = '') {
  if (!country) return '';
  if (COUNTRY_ENTRY_OVERRIDES[country]) return COUNTRY_ENTRY_OVERRIDES[country];

  const data = normalizeCountryData(country, countryData);
  const historyText = data.history;
  const mode = detectMode(country, historyText);
  const historyFacts = selectHistoryFacts(country, historyText, mode);

  if (!historyFacts.length || THIN_FILE_COUNTRIES.has(country)) {
    return buildThinFileMonologue(country, data);
  }

  const supportFact = buildSupportFact(country, data, historyFacts);
  const factText = historyFacts.join(' ');
  const supportText = supportFact ? ` ${supportFact}` : '';
  return `${country}. ${factText}${supportText} ${buildNoirTag(country, mode)}`;
}

export { COUNTRY_ENTRY_OVERRIDES };
