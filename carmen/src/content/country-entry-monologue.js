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
  'annexation', 'full-scale invasion', 'devastating', 'atrocities',
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
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean);
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

function detectModernTopic(historyText) {
  const lower = historyText.toLowerCase();
  if (lower.includes('nato') || lower.includes('european union') || lower.includes('eurozone')) {
    return 'alliance paperwork from the future';
  }
  if (lower.includes('startup') || lower.includes('tech') || lower.includes('digital')) {
    return 'modern success stories with suspiciously good bandwidth';
  }
  if (lower.includes('banking') || lower.includes('financial services')) {
    return 'banking language';
  }
  if (lower.includes('tourism')) {
    return 'tourism statistics';
  }
  if (/\b20(0\d|1\d|2[0-4])\b/.test(lower)) {
    return 'a date far too recent for my emotional arrangement';
  }
  return 'this century';
}

function buildLead(country, historyText, mode) {
  const lower = historyText.toLowerCase();

  if (!historyText || THIN_FILE_COUNTRIES.has(country)) {
    return `${country}. Thin file, expensive shadows, and just enough silence to make me overnarrate on instinct.`;
  }
  if (mode === 'tragic-grave') {
    if (lower.includes('genocide')) {
      return `${country}. The file came stamped with genocide and the kind of memory that refuses to sit quietly.`;
    }
    if (lower.includes('slave trade') || lower.includes('enslaved')) {
      return `${country}. The record carries slavery and extraction in ink that still hasn't dried morally.`;
    }
    if (lower.includes('civil war') || lower.includes('war')) {
      return `${country}. War had already done the lighting here, and better than I ever could.`;
    }
    if (lower.includes('dictatorship') || lower.includes('authoritarian')) {
      return `${country}. Power stayed too long, left bruises on the wallpaper, and called it order.`;
    }
    return `${country}. The history file read like evidence, not ambience.`;
  }
  if (mode === 'modern-anachronistic') {
    if (lower.includes('nato') || lower.includes('european union') || lower.includes('eurozone')) {
      return `${country}. The file starts in old history and ends in membership forms with a better haircut than mine.`;
    }
    if (lower.includes('startup') || lower.includes('tech') || lower.includes('digital')) {
      return `${country}. I came in ready for moody geopolitics and the file answered with modern efficiency and dangerous competence.`;
    }
    if (lower.includes('banking') || lower.includes('financial services')) {
      return `${country}. The history wandered into banking, which is never good news for a man trying to sound like 1947.`;
    }
    return `${country}. The facts kept sliding out of period and into the future while I was still buttoning the trench coat.`;
  }
  if (mode === 'imperial-decadent') {
    if (lower.includes('empire') || lower.includes('dynasty')) {
      return `${country}. Empires had their turn here, which meant the wallpaper still behaved like it had titles.`;
    }
    if (lower.includes('colony') || lower.includes('protectorate') || lower.includes('mandate')) {
      return `${country}. Empire once kept a desk here, and history never fully cleared out the drawers.`;
    }
    if (lower.includes('independence') || lower.includes('republic') || lower.includes('revolution')) {
      return `${country}. Independence showed up eventually, usually carrying broken furniture and a revised flag.`;
    }
    return `${country}. Old power still lingered in the wallpaper, charging rent by the century.`;
  }
  if (lower.includes('smallest') || lower.includes('tiny')) {
    return `${country}. Small country, oversized mood, and paperwork dressed like statecraft.`;
  }
  return `${country}. The file was short, the atmosphere cooperative, and I committed to the bit immediately.`;
}

function buildFollowup(country, historyText, mode) {
  const seed = `${country}:${mode}`;
  if (mode === 'tragic-grave') {
    return pick([
      'I kept the wisecracks off the record. Even my inner monologue knew when to lower its voice.',
      'The trench coat wanted melodrama. The history insisted on plain respect.',
      'I let the country keep the last word. It had earned it.',
    ], seed);
  }
  if (mode === 'modern-anachronistic') {
    const topic = detectModernTopic(historyText);
    return pick([
      `Then the file wandered into ${topic}. My inner monologue was built for fog, bribed porters, and another century entirely.`,
      `I reached for a cigarette metaphor and got handed ${topic} instead. The genre filed a complaint.`,
      `The trench coat stayed on, even when the facts started sounding like tomorrow's newspaper and better public policy.`,
    ], seed);
  }
  if (mode === 'imperial-decadent') {
    return pick([
      'I gave the place my best hardboiled stare. It answered with several centuries of superior production design.',
      'I tightened the trench coat and tried to look equal to the occasion. The occasion had, naturally, seen empires.',
      'I arrived ready to narrate history. The country had already hired better writers.',
    ], seed);
  }
  return pick([
    'The file was short, the shadows were cooperative, and I overcommitted to the performance immediately.',
    'Small place, big atmosphere. Naturally I behaved as if a saxophone section had followed me in.',
    'I was prepared to call it understated. Then I remembered understatement has never been my department.',
  ], seed);
}

export function buildCountryEntryMonologue(country, historyText = '') {
  if (!country) return '';
  if (COUNTRY_ENTRY_OVERRIDES[country]) return COUNTRY_ENTRY_OVERRIDES[country];

  const mode = detectMode(country, historyText);
  const lead = buildLead(country, historyText, mode);
  const followup = buildFollowup(country, historyText, mode);
  return `${lead} ${followup}`;
}

export { COUNTRY_ENTRY_OVERRIDES };
