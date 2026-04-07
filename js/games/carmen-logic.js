/**
 * Carmen Logic — "Where in the World?" game engine.
 *
 * Pure game logic: route generation, clue selection, scoring, state machine.
 * No DOM access.
 */

const DIFFICULTY = {
  rookie:    { stops: 4, cluesPerStop: 3, extraClues: Infinity, investigations: 4, totalHours: 72 },
  detective: { stops: 6, cluesPerStop: 2, extraClues: 2, investigations: 3, totalHours: 72 },
  ace:       { stops: 8, cluesPerStop: 1, extraClues: 1, investigations: 2, totalHours: 64 },
};

const INVESTIGATION_COST_HOURS = 3; // hours per investigation
const TRAVEL_COST_HOURS = 5;        // hours per travel between stops
const EXTRA_CLUE_COST_HOURS = 2;    // hours per extra clue

// Investigation locations: clue types + location-specific informants
// Each location only gives clues that thematically match the setting.
const LOCATIONS = [
  { id: 'airport',  emoji: '✈️', name: 'Airport',  clueTypes: ['geography', 'river_mountain'], informants: [
    { emoji: '🧑‍✈️', prefix: 'An airline attendant revealed' },
    { emoji: '🧳', prefix: 'A fellow traveler shared' },
    { emoji: '🚕', prefix: 'A taxi driver outside told you' },
  ]},
  { id: 'hotel',    emoji: '🏨', name: 'Hotel',    clueTypes: ['famous_for', 'fact'], informants: [
    { emoji: '🏨', prefix: 'The hotel concierge mentioned' },
    { emoji: '🛎️', prefix: 'A bellhop whispered' },
    { emoji: '🧹', prefix: 'A housekeeper recalled' },
  ]},
  { id: 'market',   emoji: '🏪', name: 'Market',   clueTypes: ['exports', 'fact', 'river_mountain'], informants: [
    { emoji: '🛍️', prefix: 'A market vendor confided' },
    { emoji: '🧑‍🍳', prefix: 'A street food vendor said' },
    { emoji: '🏪', prefix: 'A shopkeeper overheard' },
  ]},
  { id: 'library',  emoji: '📚', name: 'Library',  clueTypes: ['empire', 'heritage', 'famous_for', 'fact'], informants: [
    { emoji: '📚', prefix: 'A librarian recalled' },
    { emoji: '👨‍🏫', prefix: 'A professor noted' },
    { emoji: '🗞️', prefix: 'An old journalist mentioned' },
  ]},
  { id: 'embassy',  emoji: '🏛️', name: 'Embassy',  clueTypes: ['heritage', 'geography'], informants: [
    { emoji: '🏛️', prefix: 'An embassy attaché noted' },
    { emoji: '👮', prefix: 'A local officer reported' },
    { emoji: '🧑‍💼', prefix: 'A diplomat mentioned' },
  ]},
];

// Demonym patterns for country-name redaction
const DEMONYM_MAP = {
  'Afghanistan': ['Afghan'],
  'Albania': ['Albanian'],
  'Algeria': ['Algerian'],
  'Argentina': ['Argentine', 'Argentinian'],
  'Armenia': ['Armenian'],
  'Australia': ['Australian'],
  'Austria': ['Austrian'],
  'Azerbaijan': ['Azerbaijani', 'Azeri'],
  'Bangladesh': ['Bangladeshi'],
  'Belarus': ['Belarusian'],
  'Belgium': ['Belgian'],
  'Bolivia': ['Bolivian'],
  'Bosnia and Herzegovina': ['Bosnian', 'Herzegovinian'],
  'Brazil': ['Brazilian'],
  'Bulgaria': ['Bulgarian'],
  'Cambodia': ['Cambodian'],
  'Cameroon': ['Cameroonian'],
  'Canada': ['Canadian'],
  'Chile': ['Chilean'],
  'China': ['Chinese'],
  'Colombia': ['Colombian'],
  'Congo': ['Congolese'],
  'Costa Rica': ['Costa Rican'],
  'Croatia': ['Croatian'],
  'Cuba': ['Cuban'],
  'Cyprus': ['Cypriot'],
  'Czech Republic': ['Czech'],
  'Democratic Republic of the Congo': ['Congolese'],
  'Denmark': ['Danish', 'Dane'],
  'Dominican Republic': ['Dominican'],
  'Ecuador': ['Ecuadorian'],
  'Egypt': ['Egyptian'],
  'El Salvador': ['Salvadoran'],
  'Estonia': ['Estonian'],
  'Ethiopia': ['Ethiopian'],
  'Finland': ['Finnish', 'Finn'],
  'France': ['French'],
  'Georgia': ['Georgian'],
  'Germany': ['German'],
  'Ghana': ['Ghanaian'],
  'Greece': ['Greek'],
  'Guatemala': ['Guatemalan'],
  'Honduras': ['Honduran'],
  'Hungary': ['Hungarian'],
  'Iceland': ['Icelandic'],
  'India': ['Indian'],
  'Indonesia': ['Indonesian'],
  'Iran': ['Iranian', 'Persian'],
  'Iraq': ['Iraqi'],
  'Ireland': ['Irish'],
  'Israel': ['Israeli'],
  'Italy': ['Italian'],
  'Jamaica': ['Jamaican'],
  'Japan': ['Japanese'],
  'Jordan': ['Jordanian'],
  'Kazakhstan': ['Kazakh'],
  'Kenya': ['Kenyan'],
  'Kuwait': ['Kuwaiti'],
  'Kyrgyzstan': ['Kyrgyz'],
  'Laos': ['Laotian', 'Lao'],
  'Latvia': ['Latvian'],
  'Lebanon': ['Lebanese'],
  'Libya': ['Libyan'],
  'Lithuania': ['Lithuanian'],
  'Malaysia': ['Malaysian'],
  'Mexico': ['Mexican'],
  'Moldova': ['Moldovan'],
  'Mongolia': ['Mongolian'],
  'Montenegro': ['Montenegrin'],
  'Morocco': ['Moroccan'],
  'Mozambique': ['Mozambican'],
  'Myanmar': ['Burmese', 'Myanmar'],
  'Nepal': ['Nepali', 'Nepalese'],
  'Netherlands': ['Dutch', 'Netherlander'],
  'New Zealand': ['New Zealand'],
  'Nicaragua': ['Nicaraguan'],
  'Nigeria': ['Nigerian'],
  'North Korea': ['North Korean'],
  'North Macedonia': ['Macedonian'],
  'Norway': ['Norwegian'],
  'Oman': ['Omani'],
  'Pakistan': ['Pakistani'],
  'Panama': ['Panamanian'],
  'Paraguay': ['Paraguayan'],
  'Peru': ['Peruvian'],
  'Philippines': ['Filipino', 'Philippine'],
  'Poland': ['Polish', 'Pole'],
  'Portugal': ['Portuguese'],
  'Qatar': ['Qatari'],
  'Romania': ['Romanian'],
  'Russia': ['Russian'],
  'Saudi Arabia': ['Saudi'],
  'Senegal': ['Senegalese'],
  'Serbia': ['Serbian'],
  'Slovakia': ['Slovak'],
  'Slovenia': ['Slovenian'],
  'Somalia': ['Somali'],
  'South Africa': ['South African'],
  'South Korea': ['South Korean', 'Korean'],
  'Spain': ['Spanish'],
  'Sri Lanka': ['Sri Lankan'],
  'Sudan': ['Sudanese'],
  'Sweden': ['Swedish', 'Swede'],
  'Switzerland': ['Swiss'],
  'Syria': ['Syrian'],
  'Taiwan': ['Taiwanese'],
  'Tajikistan': ['Tajik'],
  'Tanzania': ['Tanzanian'],
  'Thailand': ['Thai'],
  'Tunisia': ['Tunisian'],
  'Turkey': ['Turkish', 'Turk'],
  'Turkmenistan': ['Turkmen'],
  'Uganda': ['Ugandan'],
  'Ukraine': ['Ukrainian'],
  'United Arab Emirates': ['Emirati'],
  'United Kingdom': ['British', 'UK'],
  'United States': ['American', 'US', 'U.S.'],
  'Uruguay': ['Uruguayan'],
  'Uzbekistan': ['Uzbek'],
  'Venezuela': ['Venezuelan'],
  'Vietnam': ['Vietnamese'],
  'Yemen': ['Yemeni'],
  'Zambia': ['Zambian'],
  'Zimbabwe': ['Zimbabwean'],
};

// Suspect profiles for the warrant system
export const SUSPECTS = [
  // Original suspects
  { name: 'Carmen Sandiego', hair: 'black', accessory: 'red trench coat', hobby: 'tango dancing', vehicle: 'red convertible',
    origin: 'Buenos Aires, Argentina', knownRegions: ['South America', 'Europe', 'Asia'],
    geoFact: 'Once corrected a customs officer that the Danube flows through 10 countries, not 9.',
    quirk: 'Cannot resist correcting geography mistakes', img: 'carmen/img/carmen-sandiego.png' },
  { name: 'Viktor Voss', hair: 'blond', accessory: 'monocle', hobby: 'chess', vehicle: 'submarine',
    origin: 'Vienna, Austria', knownRegions: ['Europe', 'North America'],
    geoFact: 'Won a chess tournament in every landlocked country in Europe.',
    quirk: 'Speaks in chess metaphors when cornered', img: 'carmen/img/Viktor Voss.png' },
  { name: 'Natasha Petrova', hair: 'red', accessory: 'fur hat', hobby: 'ice skating', vehicle: 'snowmobile',
    origin: 'Saint Petersburg, Russia', knownRegions: ['Europe', 'Asia'],
    geoFact: 'Claims to have skated across Lake Baikal, the deepest lake on Earth.',
    quirk: 'Leaves ice shavings at every crime scene', img: 'carmen/img/Natasha Petrova.png' },
  { name: 'El Zorro', hair: 'black', accessory: 'mask', hobby: 'fencing', vehicle: 'black stallion',
    origin: 'Seville, Spain', knownRegions: ['Europe', 'South America'],
    geoFact: 'Has visited every country along the Mediterranean coast — all 21 of them.',
    quirk: 'Carves a Z into museum walls before vanishing', img: 'carmen/img/El Zorro.png' },
  { name: 'The Shadow', hair: 'unknown', accessory: 'dark cloak', hobby: 'magic tricks', vehicle: 'motorcycle',
    origin: 'Unknown', knownRegions: ['Asia', 'Africa'],
    geoFact: 'Rumored to have crossed the Sahara — the world\'s largest hot desert — on foot.',
    quirk: 'Never photographed; witnesses disagree on all details', img: 'carmen/img/The Shadow.png' },
  { name: 'Lady Crimson', hair: 'auburn', accessory: 'ruby necklace', hobby: 'opera singing', vehicle: 'luxury yacht',
    origin: 'Monte Carlo, Monaco', knownRegions: ['Europe', 'Oceania'],
    geoFact: 'Her yacht has docked in ports of all 6 island nations of the Caribbean that border the Atlantic.',
    quirk: 'Only steals during a full moon', img: 'carmen/img/Lady Crimson.png' },
  { name: 'Phantom Fox', hair: 'silver', accessory: 'fox brooch', hobby: 'origami', vehicle: 'hang glider',
    origin: 'Kyoto, Japan', knownRegions: ['Asia', 'Oceania'],
    geoFact: 'Folds origami of each country she visits — Japan has 6,852 islands to fold.',
    quirk: 'Leaves an origami fox at the scene' },
  { name: 'Raven', hair: 'black', accessory: 'feathered hat', hobby: 'bird watching', vehicle: 'hot air balloon',
    origin: 'Quito, Ecuador', knownRegions: ['South America', 'Africa'],
    geoFact: 'Spotted a condor at 6,000m in the Andes — the longest continental mountain range.',
    quirk: 'Only operates at dawn or dusk', img: 'carmen/img/Raven.png' },
  { name: 'Scarlet Cipher', hair: 'red', accessory: 'coded tattoo', hobby: 'cryptography', vehicle: 'sports car',
    origin: 'Berlin, Germany', knownRegions: ['Europe', 'North America'],
    geoFact: 'Her coded messages reference the prime meridian — 0° longitude through Greenwich.',
    quirk: 'Encrypts ransom notes in geographic coordinates' },
  { name: 'Dr. Atlas', hair: 'gray', accessory: 'vintage compass', hobby: 'cartography', vehicle: 'seaplane',
    origin: 'Lisbon, Portugal', knownRegions: ['Europe', 'Africa', 'South America'],
    geoFact: 'Mapped every capital city within 500km of the equator.',
    quirk: 'Refuses to use GPS — only paper maps and compass', img: 'carmen/img/Dr. Atlas.png' },
  { name: 'The Cartographer', hair: 'brown', accessory: 'leather satchel', hobby: 'mountaineering', vehicle: 'jeep',
    origin: 'Kathmandu, Nepal', knownRegions: ['Asia', 'Africa'],
    geoFact: 'Has summited peaks on all seven continents — the Seven Summits challenge.',
    quirk: 'Takes a soil sample from every country visited', img: 'carmen/img/The Cartographer.png' },
  { name: 'Velvet Mask', hair: 'platinum', accessory: 'velvet gloves', hobby: 'ballroom dancing', vehicle: 'limousine',
    origin: 'Paris, France', knownRegions: ['Europe', 'North America'],
    geoFact: 'Once waltzed through the Hall of Mirrors at Versailles during a heist.',
    quirk: 'Always wears gloves — never leaves fingerprints', img: 'carmen/img/Velvet Mask.png' },

  // Added suspects (balanced overlap)
  { name: 'Raven Noir', hair: 'black', accessory: 'feathered hat', hobby: 'bird watching', vehicle: 'balloon',
    origin: 'Bogotá, Colombia', knownRegions: ['South America', 'North America'],
    geoFact: 'Colombia has more bird species than any other country — over 1,900.',
    quirk: 'Communicates through bird calls' },
  { name: 'Professor Paradox', hair: 'white', accessory: 'pocket watch', hobby: 'time theory', vehicle: 'experimental car',
    origin: 'Geneva, Switzerland', knownRegions: ['Europe', 'Asia'],
    geoFact: 'Studies time zones obsessively — China spans 5 geographic zones but uses only one.',
    quirk: 'Wears watches set to different time zones', img: 'carmen/img/Professor Paradox.png' },
  { name: 'Luna Nocturne', hair: 'silver', accessory: 'moon pendant', hobby: 'stargazing', vehicle: 'glider',
    origin: 'Reykjavik, Iceland', knownRegions: ['Europe', 'North America'],
    geoFact: 'Chases the northern lights — visible from Iceland due to its position near the Arctic Circle.',
    quirk: 'Only active during new moon phases', img: 'carmen/img/Luna Nocturne.png' },
  { name: 'Count Obsidian', hair: 'black', accessory: 'obsidian ring', hobby: 'antiquities', vehicle: 'helicopter',
    origin: 'Istanbul, Turkey', knownRegions: ['Europe', 'Asia', 'Africa'],
    geoFact: 'Istanbul straddles two continents — Europe and Asia — divided by the Bosphorus.',
    quirk: 'Collects volcanic glass from eruption sites' },
  { name: 'Ivy Virelli', hair: 'green', accessory: 'vine bracelet', hobby: 'botany', vehicle: 'bicycle',
    origin: 'Florence, Italy', knownRegions: ['Europe', 'South America'],
    geoFact: 'Studies the Amazon rainforest — it produces about 20% of the world\'s oxygen.',
    quirk: 'Grows rare plants in hidden greenhouses worldwide' },
  { name: 'Echo', hair: 'unknown', accessory: 'voice modulator', hobby: 'sound engineering', vehicle: 'drone',
    origin: 'Unknown', knownRegions: ['Asia', 'Oceania'],
    geoFact: 'Recorded echoes in the deepest canyon on Earth — the Yarlung Tsangpo Grand Canyon in Tibet.',
    quirk: 'Identity completely unknown; communicates only through distorted audio' },
  { name: 'The Locksmith', hair: 'brown', accessory: 'keychain', hobby: 'lockpicking', vehicle: 'van',
    origin: 'Prague, Czech Republic', knownRegions: ['Europe'],
    geoFact: 'Claims to have picked locks in every capital city of the EU\'s 27 member states.',
    quirk: 'Collects antique keys from every country' },
  { name: 'Captain Marlowe', hair: 'gray', accessory: 'captain hat', hobby: 'navigation', vehicle: 'cargo ship',
    origin: 'Liverpool, United Kingdom', knownRegions: ['Europe', 'Africa', 'Asia'],
    geoFact: 'Sailed through the Strait of Malacca — one of the busiest shipping lanes in the world.',
    quirk: 'Navigates by stars; refuses modern instruments', img: 'carmen/img/Captain Marlowe.png' },
  { name: 'Nova Vex', hair: 'red', accessory: 'visor', hobby: 'astronomy', vehicle: 'jet',
    origin: 'Houston, United States', knownRegions: ['North America', 'South America'],
    geoFact: 'Built an observatory in the Atacama Desert, Chile — driest place on Earth.',
    quirk: 'Names heists after constellations' },
  { name: 'Saffron Silk', hair: 'auburn', accessory: 'silk fan', hobby: 'tea ceremonies', vehicle: 'rickshaw',
    origin: 'Jaipur, India', knownRegions: ['Asia', 'Africa'],
    geoFact: 'Traveled the ancient Silk Road — 6,400 km from China to the Mediterranean.',
    quirk: 'Leaves a saffron thread at every scene' },

  { name: 'Silk Serpent', hair: 'black', accessory: 'gold earrings', hobby: 'dance', vehicle: 'motorbike',
    origin: 'Bangkok, Thailand', knownRegions: ['Asia', 'Oceania'],
    geoFact: 'Thailand is the only Southeast Asian country never colonized by a European power.',
    quirk: 'Vanishes into night markets without a trace', img: 'carmen/img/Silk Serpent.png' },
  { name: 'Crimson Dagger', hair: 'red', accessory: 'dagger', hobby: 'dueling', vehicle: 'motorcycle',
    origin: 'Marrakech, Morocco', knownRegions: ['Africa', 'Europe'],
    geoFact: 'Morocco is only 14 km from Spain across the Strait of Gibraltar.',
    quirk: 'Challenges rivals to duels before escaping' },
  { name: 'Golden Lynx', hair: 'blond', accessory: 'necklace', hobby: 'jewelry', vehicle: 'sports car',
    origin: 'Antwerp, Belgium', knownRegions: ['Europe', 'Africa'],
    geoFact: 'Antwerp handles 84% of the world\'s rough diamond trade.',
    quirk: 'Only steals gems — never gold' },
  { name: 'Ivory Whisper', hair: 'white', accessory: 'gloves', hobby: 'piano', vehicle: 'car',
    origin: 'Salzburg, Austria', knownRegions: ['Europe'],
    geoFact: 'Salzburg sits on the border with Germany — the Salzach River divides the two countries.',
    quirk: 'Plays a short piece on any piano found at the scene' },
  { name: 'Neon Specter', hair: 'green', accessory: 'visor', hobby: 'hacking', vehicle: 'motorbike',
    origin: 'Seoul, South Korea', knownRegions: ['Asia', 'North America'],
    geoFact: 'South Korea has the fastest average internet speed in the world.',
    quirk: 'Hacks digital billboards to taunt investigators' },
  { name: 'Scarlet Swan', hair: 'red', accessory: 'necklace', hobby: 'ballet', vehicle: 'car',
    origin: 'Moscow, Russia', knownRegions: ['Europe', 'Asia'],
    geoFact: 'Performed at the Bolshoi Theatre — Moscow sits on the Moskva River at 55°N latitude.',
    quirk: 'Leaves ballet slippers as a calling card' },

  { name: 'Midnight Owl', hair: 'black', accessory: 'glasses', hobby: 'reading', vehicle: 'bicycle',
    origin: 'Oxford, United Kingdom', knownRegions: ['Europe'],
    geoFact: 'The Thames flows through Oxford before reaching London — 346 km total length.',
    quirk: 'Steals only first editions; returns photocopies' },
  { name: 'Dusty Nomad', hair: 'brown', accessory: 'hat', hobby: 'traveling', vehicle: 'jeep',
    origin: 'Ulaanbaatar, Mongolia', knownRegions: ['Asia', 'Africa'],
    geoFact: 'Mongolia is the most sparsely populated country — about 2 people per km².',
    quirk: 'Never stays in one country for more than 48 hours', img: 'carmen/img/Dusty Nomad.png' },
  { name: 'Silver Comet', hair: 'silver', accessory: 'watch', hobby: 'running', vehicle: 'jet',
    origin: 'Nairobi, Kenya', knownRegions: ['Africa', 'Europe'],
    geoFact: 'Kenya\'s Great Rift Valley stretches 6,000 km from Lebanon to Mozambique.',
    quirk: 'Outruns any pursuer on foot' },
  { name: 'Velvet Raven', hair: 'black', accessory: 'cloak', hobby: 'poetry', vehicle: 'boat',
    origin: 'Dublin, Ireland', knownRegions: ['Europe', 'North America'],
    geoFact: 'Ireland is called the Emerald Isle — it rains on average 225 days per year.',
    quirk: 'Leaves handwritten poems at crime scenes' },
  { name: 'Amber Fox', hair: 'auburn', accessory: 'brooch', hobby: 'collecting', vehicle: 'car',
    origin: 'Gdańsk, Poland', knownRegions: ['Europe'],
    geoFact: 'The Baltic coast near Gdańsk has the world\'s largest amber deposits — 40 million years old.',
    quirk: 'Collects amber from every Baltic country' },

  { name: 'Storm Herald', hair: 'gray', accessory: 'coat', hobby: 'meteorology', vehicle: 'plane',
    origin: 'Reykjavik, Iceland', knownRegions: ['Europe', 'North America'],
    geoFact: 'Iceland sits on the Mid-Atlantic Ridge — where the Eurasian and North American plates diverge.',
    quirk: 'Strikes only during storms for cover' },
  { name: 'Crimson Mirage', hair: 'red', accessory: 'scarf', hobby: 'illusion', vehicle: 'train',
    origin: 'Cairo, Egypt', knownRegions: ['Africa', 'Asia'],
    geoFact: 'The Nile is the longest river in Africa at 6,650 km — passing through 11 countries.',
    quirk: 'Creates diversions using mirrors and light' },
  { name: 'Onyx Panther', hair: 'black', accessory: 'mask', hobby: 'stealth', vehicle: 'motorcycle',
    origin: 'Lagos, Nigeria', knownRegions: ['Africa', 'Europe'],
    geoFact: 'Nigeria is Africa\'s most populous country with over 220 million people.',
    quirk: 'Has never set off a single alarm' },
  { name: 'Golden Seraph', hair: 'blond', accessory: 'pendant', hobby: 'history', vehicle: 'ship',
    origin: 'Athens, Greece', knownRegions: ['Europe', 'Asia'],
    geoFact: 'Greece has more archaeological museums than any other country in the world.',
    quirk: 'Only targets artifacts from ancient civilizations', img: 'carmen/img/Golden Seraph.png' },
  { name: 'Ivory Phantom', hair: 'white', accessory: 'cloak', hobby: 'acting', vehicle: 'car',
    origin: 'Venice, Italy', knownRegions: ['Europe', 'South America'],
    geoFact: 'Venice is built on 118 small islands connected by over 400 bridges.',
    quirk: 'Masters disguises — changes identity at every border' },

  { name: 'Emerald Kite', hair: 'green', accessory: 'ring', hobby: 'kite flying', vehicle: 'glider',
    origin: 'Lahore, Pakistan', knownRegions: ['Asia'],
    geoFact: 'Pakistan contains K2, the second-highest mountain on Earth at 8,611m.',
    quirk: 'Uses kites to scout locations from above' },
  { name: 'Shadow Lynx', hair: 'black', accessory: 'gloves', hobby: 'tracking', vehicle: 'jeep',
    origin: 'Windhoek, Namibia', knownRegions: ['Africa'],
    geoFact: 'Namibia\'s Skeleton Coast is one of the world\'s most treacherous shorelines.',
    quirk: 'Can track any person across any terrain' },
  { name: 'Copper Sparrow', hair: 'auburn', accessory: 'hat', hobby: 'writing', vehicle: 'bicycle',
    origin: 'Havana, Cuba', knownRegions: ['North America', 'South America'],
    geoFact: 'Cuba is the largest island in the Caribbean — 1,250 km from tip to tip.',
    quirk: 'Publishes crime memoirs under a pen name' },
  { name: 'Ghost Mariner', hair: 'gray', accessory: 'compass', hobby: 'sailing', vehicle: 'ship',
    origin: 'Bergen, Norway', knownRegions: ['Europe', 'North America'],
    geoFact: 'Norway\'s coastline is over 25,000 km long — or 100,000 km including fjords.',
    quirk: 'Ship appears and vanishes like a phantom in fog' },
  { name: 'Velvet Cipher', hair: 'black', accessory: 'tattoo', hobby: 'cryptography', vehicle: 'car',
    origin: 'Tallinn, Estonia', knownRegions: ['Europe', 'Asia'],
    geoFact: 'Estonia is one of the most digitally advanced nations — 99% of government services are online.',
    quirk: 'Leaves encrypted clues that take weeks to decode' },
];

const THIEF_NAMES = SUSPECTS.map(s => s.name);

const SUSPECT_ATTRIBUTES = ['hair', 'accessory', 'hobby', 'vehicle'];

const ATTRIBUTE_GROUPS = {
  hair: {
    dark:    ['black', 'brown'],
    light:   ['blond', 'auburn', 'platinum'],
    unusual: ['green', 'silver', 'white', 'gray', 'unknown'],
    red:     ['red'],
  },
  accessory: {
    headwear:  ['fur hat', 'feathered hat', 'captain hat', 'hat'],
    eyewear:   ['monocle', 'visor', 'glasses'],
    jewelry:   ['ruby necklace', 'moon pendant', 'obsidian ring', 'necklace', 'gold earrings', 'pendant', 'ring', 'vine bracelet', 'brooch', 'fox brooch'],
    outerwear: ['red trench coat', 'dark cloak', 'velvet gloves', 'gloves', 'cloak', 'coat', 'scarf'],
    gadget:    ['coded tattoo', 'vintage compass', 'leather satchel', 'pocket watch', 'voice modulator', 'keychain', 'watch', 'compass', 'tattoo'],
    other:     ['mask', 'dagger', 'silk fan'],
  },
  hobby: {
    physical:  ['tango dancing', 'ice skating', 'fencing', 'ballroom dancing', 'dance', 'dueling', 'ballet', 'running', 'stealth', 'tracking'],
    cerebral:  ['chess', 'cryptography', 'time theory', 'hacking', 'lockpicking', 'sound engineering', 'navigation'],
    artistic:  ['opera singing', 'origami', 'poetry', 'piano', 'acting', 'writing', 'illusion', 'magic tricks'],
    outdoors:  ['bird watching', 'cartography', 'mountaineering', 'botany', 'stargazing', 'astronomy', 'kite flying', 'sailing', 'meteorology', 'traveling'],
    collector: ['antiquities', 'jewelry', 'tea ceremonies', 'collecting', 'reading', 'history'],
  },
  vehicle: {
    air:  ['hang glider', 'hot air balloon', 'seaplane', 'balloon', 'glider', 'helicopter', 'drone', 'jet', 'plane'],
    land: ['red convertible', 'black stallion', 'motorcycle', 'jeep', 'limousine', 'experimental car', 'van', 'motorbike', 'car', 'bicycle', 'rickshaw', 'sports car', 'train'],
    sea:  ['submarine', 'luxury yacht', 'cargo ship', 'boat', 'ship', 'snowmobile'],
  },
};

function getAttributeGroup(attr, value) {
  const groups = ATTRIBUTE_GROUPS[attr];
  if (!groups) return null;
  for (const [groupName, members] of Object.entries(groups)) {
    if (members.includes(value)) return groupName;
  }
  return null;
}

const SUSPECT_CLUE_TEMPLATES_VAGUE = {
  hair: (group) => ({
    dark: 'A witness noticed the suspect had dark hair.',
    light: 'A witness described the suspect as having light-colored hair.',
    unusual: 'A witness said the suspect had unusual hair — not a natural color.',
    red: 'A witness recalls the suspect had reddish hair.',
  })[group] || `A witness said the suspect had ${group} hair.`,

  accessory: (group) => ({
    headwear: 'The suspect was seen wearing some kind of distinctive hat.',
    eyewear: 'The suspect was wearing something over their eyes.',
    jewelry: 'A bystander noticed the suspect was wearing jewelry.',
    outerwear: 'The suspect was wrapped in notable outerwear.',
    gadget: 'The suspect was carrying a notable accessory or gadget.',
    other: 'The suspect had something unusual on them.',
  })[group] || `The suspect had some kind of ${group}.`,

  hobby: (group) => ({
    physical: 'An informant says the thief is into physical activities or performance.',
    cerebral: 'The thief is reportedly a thinker — into puzzles or technical skills.',
    artistic: 'Sources say the thief has artistic or creative interests.',
    outdoors: 'The thief apparently enjoys outdoor or nature-related activities.',
    collector: 'Word is the thief is a collector or scholar of some kind.',
  })[group] || `The thief reportedly enjoys ${group} activities.`,

  vehicle: (group) => ({
    air: 'The getaway involved something that flies.',
    land: 'The thief escaped by land vehicle.',
    sea: 'The thief was last seen heading toward the water.',
  })[group] || `The getaway was by ${group}.`,
};

const SUSPECT_CLUE_TEMPLATES_SPECIFIC = {
  hair:      (val) => `A witness positively identified the suspect as having ${val} hair.`,
  accessory: (val) => `The suspect was confirmed to be wearing a ${val}.`,
  hobby:     (val) => `A reliable source confirms the thief is known for ${val}.`,
  vehicle:   (val) => `The getaway vehicle has been identified as a ${val}.`,
};

// Thief taunts by game phase
const THIEF_TAUNTS = {
  early: [
    "You'll never catch me!",
    "I'm always three steps ahead, detective.",
    "Is that the best ACME has to offer?",
    "By the time you read this, I'll be long gone.",
    "Better luck next country!",
    "Catch me if you can!",
  ],
  mid: [
    "Still following me? How persistent.",
    "I have to admit, you're better than the last detective.",
    "Getting warmer... or are you?",
    "You're closer than I expected. Don't get used to it.",
    "Not bad, detective. But I have a few tricks left.",
    "Enjoy the scenery — I certainly am.",
  ],
  late: [
    "How are you still on my trail?!",
    "Fine, you're good. But I'm better.",
    "I can hear your footsteps... getting closer.",
    "This isn't over yet, detective!",
    "You've earned my respect. But not my surrender.",
  ],
  wrongGuess: [
    "Ha! Wrong turn, detective!",
    "You just wasted precious time. Thanks!",
    "That's not where I went. Try again!",
    "Cold, very cold!",
    "My grandmother could track better than you!",
  ],
};

export class CarmenGameLogic {
  /**
   * @param {Object} config
   * @param {Array}  config.countries    — window.DATA entries (with neighbors)
   * @param {Object} config.facts        — { countryName: [{fact, category}] }
   * @param {Array}  config.heritageSites — [{siteName, country, hint, ...}]
   * @param {Array}  config.rivers       — [{name, countries, hint}]
   * @param {Array}  config.mountains    — [{name, countries, hint}]
   * @param {Array}  config.empires      — [{name, countries, description}]
   * @param {string} config.difficulty   — 'rookie' | 'detective' | 'ace'
   */
  constructor(config) {
    this.countries = config.countries;
    this.facts = config.facts || {};
    this.heritageSites = config.heritageSites || [];
    this.rivers = config.rivers || [];
    this.mountains = config.mountains || [];
    this.empires = config.empires || [];
    this.diffKey = config.difficulty || 'detective';
    this.diff = DIFFICULTY[this.diffKey] || DIFFICULTY.detective;
    this.caseNumber = config.caseNumber || 1;
    this.totalCases = config.totalCases || 10;
    this.campaignPhase =
      this.caseNumber >= 10 ? 'finale' :
      this.caseNumber >= 7 ? 'pursuit' :
      this.caseNumber >= 4 ? 'whispers' : 'prelude';

    // Build lookups
    this.countrySet = new Set(this.countries.map(c => c.country));
    this.countryMap = Object.fromEntries(this.countries.map(c => [c.country, c]));
    this.neighborsMap = Object.fromEntries(
      this.countries.map(c => [c.country, (c.neighbors || []).filter(n => this.countrySet.has(n))])
    );

    // Heritage sites indexed by country
    this.heritagByCountry = {};
    for (const site of this.heritageSites) {
      if (!this.heritagByCountry[site.country]) this.heritagByCountry[site.country] = [];
      this.heritagByCountry[site.country].push(site);
    }

    // Rivers/mountains indexed by country
    this.riversByCountry = {};
    for (const r of this.rivers) {
      for (const c of r.countries) {
        if (!this.riversByCountry[c]) this.riversByCountry[c] = [];
        this.riversByCountry[c].push(r);
      }
    }
    this.mountainsByCountry = {};
    for (const m of this.mountains) {
      for (const c of m.countries) {
        if (!this.mountainsByCountry[c]) this.mountainsByCountry[c] = [];
        this.mountainsByCountry[c].push(m);
      }
    }
    this.empiresByCountry = {};
    for (const e of this.empires) {
      for (const c of e.countries) {
        if (!this.empiresByCountry[c]) this.empiresByCountry[c] = [];
        this.empiresByCountry[c].push(e);
      }
    }

    // State
    this.reset();
  }

  reset() {
    this.route = [];
    this.artifact = null;
    this.suspect = null;
    this.thiefName = '???'; // Unknown until identified
    this.currentStop = 0;
    this.score = 0;
    this.extraCluesUsed = 0;
    this.wrongGuessesThisStop = 0;
    this.totalWrongGuesses = 0;
    this.firstTryStops = 0;
    this.usedClueIds = new Set();
    this.gameStartTime = Date.now();
    this.stopStartTime = null;
    this.gameOver = false;
    this.won = false;

    // Shuffle suspect attributes for clue distribution across stops
    this._suspectClueAttrs = [...SUSPECT_ATTRIBUTES].sort(() => Math.random() - 0.5);
    this._suspectClueIndex = 0;
    this._suspectClueStop = -1;
    this._revealedAttrs = [];
    this._pendingSpecificClue = null;

    // Time tracking (in-game hours)
    this.hoursRemaining = this.diff.totalHours;
    this.timeExpired = false;
  }

  /** Generate route and return the intro data. */
  start() {
    this.reset();
    this.route = this._generateRoute(this.diff.stops);
    this.artifact = this._pickArtifact(this.route[0]);

    // Finale: Carmen Sandiego herself is the thief.
    if (this.campaignPhase === 'finale') {
      const carmen = SUSPECTS.find(s => s.name === 'Carmen Sandiego');
      if (carmen) this.suspect = carmen;
    }
    if (!this.suspect) {
      // Exclude Carmen from the pool in pre-finale cases — she's only hinted at.
      const pool = SUSPECTS.filter(s => s.name !== 'Carmen Sandiego');
      const routeContinents = new Set(
        this.route.map(c => this.countryMap[c]?.continent).filter(Boolean)
      );
      const regionMatch = pool.filter(s =>
        s.knownRegions?.some(r => routeContinents.has(r))
      );
      const candidates = regionMatch.length > 0 ? regionMatch : pool;
      this.suspect = candidates[Math.floor(Math.random() * candidates.length)];
    }

    this.stopStartTime = Date.now();

    const clues = this._generateClues(this.route[1], this.diff.cluesPerStop);
    const neighbors = this._getNeighborChoices(this.route[0]);

    return {
      thiefName: this.thiefName,
      artifact: this.artifact,
      startCountry: this.route[0],
      targetCountry: this.route[1],
      clues,
      neighbors,
      progress: this.getProgress(),
      caseNumber: this.caseNumber,
      totalCases: this.totalCases,
      campaignPhase: this.campaignPhase,
    };
  }

  /** Player guesses where the thief went. */
  guess(country) {
    if (this.gameOver) return { correct: false, gameOver: true };

    const target = this.route[this.currentStop + 1];
    const correct = country === target;

    if (correct) {
      const timeTaken = (Date.now() - this.stopStartTime) / 1000;
      if (this.wrongGuessesThisStop === 0) this.firstTryStops++;
      const stopScore = this._calculateStopScore(
        this.wrongGuessesThisStop === 0, timeTaken, this.extraCluesUsed
      );
      this.score += stopScore;
      this.currentStop++;
      this.wrongGuessesThisStop = 0;
      this.extraCluesUsed = 0;
      this.stopStartTime = Date.now();

      // Check if thief caught
      if (this.currentStop >= this.route.length - 1) {
        this.gameOver = true;
        this.won = true;
        // Perfect game bonus
        if (this.firstTryStops === this.route.length - 1) {
          this.score += 200;
        }
        return {
          correct: true,
          gameOver: true,
          won: true,
          stopScore,
          country: target,
          progress: this.getProgress(),
        };
      }

      // Next stop
      const nextTarget = this.route[this.currentStop + 1];
      const clues = this._generateClues(nextTarget, this.diff.cluesPerStop);
      const neighbors = this._getNeighborChoices(this.route[this.currentStop]);

      return {
        correct: true,
        gameOver: false,
        stopScore,
        country: target,
        nextCountry: this.route[this.currentStop],
        clues,
        neighbors,
        progress: this.getProgress(),
      };
    }

    // Wrong guess — player travels there and discovers a dead end
    this.wrongGuessesThisStop++;
    this.totalWrongGuesses++;
    this.score = Math.max(0, this.score - 25);

    // Return neighbors of the correct stop + the correct stop itself (to go back)
    const currentCountry = this.route[this.currentStop];
    const neighbors = this._getNeighborChoices(currentCountry);
    if (!neighbors.includes(currentCountry)) neighbors.push(currentCountry);

    return {
      correct: false,
      gameOver: false,
      country,
      fromCountry: currentCountry,
      neighbors,
      progress: this.getProgress(),
    };
  }

  /** Request an extra clue for the current stop. */
  requestExtraClue() {
    if (this.gameOver) return null;

    const totalExtra = this.extraCluesUsed;
    if (totalExtra >= this.diff.extraClues) return null;

    const target = this.route[this.currentStop + 1];
    const clues = this._generateClues(target, 1);
    if (clues.length === 0) return null;

    this.extraCluesUsed++;
    this.score = Math.max(0, this.score - 20);
    return clues[0];
  }

  getProgress() {
    return {
      stop: this.currentStop,
      totalStops: this.route.length - 1,
      score: this.score,
      route: this.route.slice(0, this.currentStop + 1),
    };
  }

  getResults() {
    const elapsed = (Date.now() - this.gameStartTime) / 1000;
    const maxScore = (this.route.length - 1) * 150 + 200; // max per stop + perfect bonus
    return {
      won: this.won,
      score: this.score,
      maxScore,
      time: elapsed,
      accuracy: Math.round((this.firstTryStops / (this.route.length - 1)) * 100),
      stopsCompleted: this.currentStop,
      totalStops: this.route.length - 1,
      totalWrongGuesses: this.totalWrongGuesses,
      route: this.route,
    };
  }

  // ─── Route Generation ────────────────────────────────────────

  _generateRoute(numStops) {
    // Pick start country: must have heritage site + neighbors
    const heritageCountries = [...new Set(this.heritageSites.map(s => s.country))]
      .filter(c => this.countrySet.has(c) && (this.neighborsMap[c] || []).length >= 2);

    let bestRoute = [];

    // Try multiple times to get a full-length route
    for (let attempt = 0; attempt < 20; attempt++) {
      const start = heritageCountries[Math.floor(Math.random() * heritageCountries.length)];
      const route = [start];
      const visited = new Set([start]);

      for (let i = 0; i < numStops; i++) {
        const current = route[route.length - 1];
        const candidates = (this.neighborsMap[current] || [])
          .filter(n => !visited.has(n) && (this.neighborsMap[n] || []).length >= 1);

        if (candidates.length === 0) break;

        // Prefer countries with more facts and more neighbors (for future steps)
        const scored = candidates.map(c => ({
          country: c,
          weight: ((this.facts[c] || []).length + 1)
            * ((this.neighborsMap[c] || []).length)
        }));
        scored.sort((a, b) => b.weight - a.weight);

        // Weighted random from top candidates
        const top = scored.slice(0, Math.min(5, scored.length));
        const totalW = top.reduce((s, x) => s + x.weight, 0);
        let r = Math.random() * totalW;
        let pick = top[0].country;
        for (const item of top) {
          r -= item.weight;
          if (r <= 0) { pick = item.country; break; }
        }

        route.push(pick);
        visited.add(pick);
      }

      if (route.length > bestRoute.length) bestRoute = route;
      if (bestRoute.length >= numStops + 1) break;
    }

    return bestRoute;
  }

  _pickArtifact(country) {
    const sites = this.heritagByCountry[country];
    if (sites && sites.length > 0) {
      return sites[Math.floor(Math.random() * sites.length)];
    }
    return { siteName: 'a priceless artifact', country, hint: '' };
  }

  // ─── Neighbor Choices ────────────────────────────────────────

  _getNeighborChoices(country) {
    const neighbors = (this.neighborsMap[country] || []).slice();
    // Shuffle
    for (let i = neighbors.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [neighbors[i], neighbors[j]] = [neighbors[j], neighbors[i]];
    }
    return neighbors;
  }

  /** Get neighbor choices for the current stop (plus the stop itself for going back). */
  getNeighborChoicesForCurrentStop() {
    const current = this.route[this.currentStop];
    const neighbors = this._getNeighborChoices(current);
    if (!neighbors.includes(current)) neighbors.push(current);
    return neighbors;
  }

  // ─── Clue Generation ────────────────────────────────────────

  _generateClues(country, count) {
    // Gather the neighbor choices for this stop so we can filter unhelpful clues
    const currentCountry = this.route[this.currentStop];
    const neighborChoices = this.neighborsMap[currentCountry] || [];

    const clues = [];
    const generators = [
      () => this._clueFromFact(country),
      () => this._clueFromGeography(country, neighborChoices),
      () => this._clueFromHeritage(country),
      () => this._clueFromRiverOrMountain(country),
      () => this._clueFromEmpire(country),
      () => this._clueFromFamousFor(country),
      () => this._clueFromExports(country),
    ];

    // Shuffle generators for variety
    for (let i = generators.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [generators[i], generators[j]] = [generators[j], generators[i]];
    }

    for (const gen of generators) {
      if (clues.length >= count) break;
      const clue = gen();
      if (clue && !this.usedClueIds.has(clue.id)) {
        this.usedClueIds.add(clue.id);
        clues.push(clue);
      }
    }

    // If we still need more, try facts again (multiple facts per country)
    if (clues.length < count) {
      const facts = this.facts[country] || [];
      for (const f of facts) {
        if (clues.length >= count) break;
        const id = `fact-${country}-${f.fact.slice(0, 30)}`;
        if (this.usedClueIds.has(id)) continue;
        const redacted = this._redactCountryName(f.fact, country);
        if (redacted === f.fact || !redacted.includes(country)) {
          this.usedClueIds.add(id);
          clues.push({ id, text: redacted, icon: this._iconForCategory(f.category), category: f.category });
        }
      }
    }

    // Last resort: geography clues are always available
    if (clues.length < count) {
      const geoClues = this._allGeographyClues(country);
      for (const c of geoClues) {
        if (clues.length >= count) break;
        if (!this.usedClueIds.has(c.id)) {
          this.usedClueIds.add(c.id);
          clues.push(c);
        }
      }
    }

    return clues;
  }

  _clueFromFact(country) {
    const facts = this.facts[country] || [];
    if (facts.length === 0) return null;

    // Pick a random fact
    const shuffled = [...facts].sort(() => Math.random() - 0.5);
    for (const f of shuffled) {
      const id = `fact-${country}-${f.fact.slice(0, 30)}`;
      if (this.usedClueIds.has(id)) continue;
      const redacted = this._redactCountryName(f.fact, country);
      // Only use if the country name doesn't appear in the redacted text
      if (!this._containsCountryName(redacted, country)) {
        return { id, text: redacted, icon: this._iconForCategory(f.category), category: f.category };
      }
    }
    return null;
  }

  _clueFromGeography(country, neighborChoices = []) {
    const clues = this._allGeographyClues(country, neighborChoices);
    const shuffled = clues.sort(() => Math.random() - 0.5);
    for (const c of shuffled) {
      if (!this.usedClueIds.has(c.id)) return c;
    }
    return null;
  }

  /**
   * Build geography clues, but only include ones that actually help
   * distinguish the target from the other neighbor choices.
   */
  _allGeographyClues(country, neighborChoices = []) {
    const c = this.countryMap[country];
    if (!c) return [];
    const clues = [];

    // Only include continent clue if neighbors span multiple continents
    const neighborContinents = new Set(
      neighborChoices.map(n => this.countryMap[n]?.continent).filter(Boolean)
    );
    if (neighborContinents.size > 1) {
      clues.push({
        id: `geo-continent-${country}`,
        text: `This country is in ${c.continent}.`,
        icon: '🌍', category: 'geography'
      });
    }

    // Only include landlocked clue if it distinguishes from some neighbors
    if (c.landlocked) {
      const allLandlocked = neighborChoices.every(n => this.countryMap[n]?.landlocked);
      if (!allLandlocked) {
        clues.push({
          id: `geo-landlocked-${country}`,
          text: 'This country is landlocked.',
          icon: '🌍', category: 'geography'
        });
      }
    }

    if (c.capitals && c.capitals[0]) {
      const cap = c.capitals[0];
      clues.push({
        id: `geo-capital-letter-${country}`,
        text: `The capital starts with the letter "${cap[0]}".`,
        icon: '🏛️', category: 'geography'
      });
    }

    // Population — only if it helps narrow down (target's bracket differs from at least one neighbor)
    if (c.population) {
      const bracket = this._popBracket(c.population);
      const neighborBrackets = neighborChoices.map(n => this._popBracket(this.countryMap[n]?.population));
      if (neighborBrackets.some(b => b !== bracket)) {
        clues.push({
          id: `geo-pop-${country}`,
          text: `This country has a population of ${bracket}.`,
          icon: '👥', category: 'geography'
        });
      }
    }

    const nbrCount = (this.neighborsMap[country] || []).length;
    if (nbrCount > 0) {
      clues.push({
        id: `geo-neighbors-${country}`,
        text: `This country borders ${nbrCount} ${nbrCount === 1 ? 'country' : 'countries'}.`,
        icon: '🌍', category: 'geography'
      });
    }

    if (c.highestPeak) {
      clues.push({
        id: `geo-peak-${country}`,
        text: `The highest point here is ${c.highestPeak.name} at ${c.highestPeak.elev.toLocaleString()}m.`,
        icon: '⛰️', category: 'geography'
      });
    }

    return clues;
  }

  _popBracket(pop) {
    if (!pop) return 'unknown';
    if (pop > 100_000_000) return 'over 100 million';
    if (pop > 50_000_000) return 'over 50 million';
    if (pop > 20_000_000) return 'over 20 million';
    if (pop > 10_000_000) return 'over 10 million';
    if (pop > 1_000_000) return 'over 1 million';
    return 'under 1 million';
  }

  _clueFromHeritage(country) {
    const sites = this.heritagByCountry[country] || [];
    if (sites.length === 0) return null;

    const shuffled = [...sites].sort(() => Math.random() - 0.5);
    for (const site of shuffled) {
      const id = `heritage-${country}-${site.siteName}`;
      if (this.usedClueIds.has(id)) continue;
      const text = this._redactCountryName(
        `A famous site here: ${site.hint}.`, country
      );
      if (!this._containsCountryName(text, country)) {
        return { id, text, icon: '🏛️', category: 'landmarks' };
      }
    }
    return null;
  }

  _clueFromRiverOrMountain(country) {
    const features = [
      ...(this.riversByCountry[country] || []).map(r => ({ ...r, type: 'river' })),
      ...(this.mountainsByCountry[country] || []).map(m => ({ ...m, type: 'mountain' })),
    ];
    if (features.length === 0) return null;

    const shuffled = features.sort(() => Math.random() - 0.5);
    for (const f of shuffled) {
      const id = `feature-${f.type}-${f.name}`;
      if (this.usedClueIds.has(id)) continue;
      const label = f.type === 'river' ? 'river' : 'mountain range';
      return {
        id,
        text: `The ${f.name} ${label} passes through this country.`,
        icon: f.type === 'river' ? '🏞️' : '⛰️',
        category: 'geography'
      };
    }
    return null;
  }

  _clueFromEmpire(country) {
    const empires = this.empiresByCountry[country] || [];
    if (empires.length === 0) return null;

    const shuffled = [...empires].sort(() => Math.random() - 0.5);
    for (const e of shuffled) {
      const id = `empire-${e.name || e.id}`;
      if (this.usedClueIds.has(id)) continue;
      return {
        id,
        text: `This country was once part of the ${e.name} (${e.yearLabel}).`,
        icon: '👑', category: 'history'
      };
    }
    return null;
  }

  _clueFromFamousFor(country) {
    const items = this.countryMap[country]?.famousFor;
    if (!items || items.length === 0) return null;

    const templates = [
      item => `This place is known for ${item}.`,
      item => `The destination is famous for ${item}.`,
      item => `You'll find ${item} in this country.`,
    ];

    const shuffled = items.map((item, i) => ({ item, i })).sort(() => Math.random() - 0.5);
    for (const { item, i } of shuffled) {
      const id = `famous-${country}-${i}`;
      if (this.usedClueIds.has(id)) continue;
      const template = templates[Math.floor(Math.random() * templates.length)];
      const text = this._redactCountryName(template(item), country);
      if (this._containsCountryName(text, country)) continue;
      return { id, text, icon: '🌟', category: 'culture' };
    }
    return null;
  }

  _clueFromExports(country) {
    const items = this.countryMap[country]?.exports;
    if (!items || items.length === 0) return null;

    const templates = [
      list => `This country is a major exporter of ${list}.`,
      list => `Key exports from here include ${list}.`,
      list => `The local economy runs on ${list}.`,
    ];

    // Pick 2-3 items randomly; use all if ≤2
    let subset;
    if (items.length <= 2) {
      subset = [...items];
    } else {
      const shuffled = [...items].sort(() => Math.random() - 0.5);
      subset = shuffled.slice(0, 2 + Math.floor(Math.random() * 2)); // 2 or 3
    }

    const sorted = [...subset].sort();
    const id = `exports-${country}-${sorted.join(',')}`;
    if (this.usedClueIds.has(id)) return null;

    // Format as "a, b, and c"
    let list;
    if (subset.length === 1) list = subset[0];
    else if (subset.length === 2) list = `${subset[0]} and ${subset[1]}`;
    else list = `${subset.slice(0, -1).join(', ')}, and ${subset[subset.length - 1]}`;

    const template = templates[Math.floor(Math.random() * templates.length)];
    const text = this._redactCountryName(template(list), country);
    if (this._containsCountryName(text, country)) return null;
    return { id, text, icon: '📦', category: 'economy' };
  }

  // ─── Country Name Redaction ──────────────────────────────────

  _redactCountryName(text, country) {
    let result = text;
    // Replace the country name itself (case-insensitive, word boundary)
    const escaped = country.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), 'this country');

    // Replace demonyms
    const demonyms = DEMONYM_MAP[country] || [];
    for (const dem of demonyms) {
      const esc = dem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp(`\\b${esc}\\b`, 'gi'), 'local');
    }

    return result;
  }

  _containsCountryName(text, country) {
    const lower = text.toLowerCase();
    if (lower.includes(country.toLowerCase())) return true;
    // Check demonyms aren't still there
    const demonyms = DEMONYM_MAP[country] || [];
    for (const dem of demonyms) {
      if (lower.includes(dem.toLowerCase())) return true;
    }
    return false;
  }

  _iconForCategory(category) {
    const map = {
      culture: '🎭',
      landmarks: '🏛️',
      history: '📜',
      geography: '🌍',
      nature: '🌿',
      politics: '⚖️',
      economy: '💰',
    };
    return map[category] || '📋';
  }

  // ─── Time Management ─────────────────────────────────────────

  /** Spend in-game hours. Returns false if time ran out. */
  spendTime(hours) {
    this.hoursRemaining = Math.max(0, this.hoursRemaining - hours);
    if (this.hoursRemaining <= 0) {
      this.timeExpired = true;
      this.gameOver = true;
      this.won = false;
    }
    return !this.timeExpired;
  }

  /** Cost for investigating a location. */
  getInvestigationCost() { return INVESTIGATION_COST_HOURS; }

  /** Cost for traveling to next stop. */
  getTravelCost() { return TRAVEL_COST_HOURS; }

  /** Cost for requesting an extra clue. */
  getExtraClueCost() { return EXTRA_CLUE_COST_HOURS; }

  /** Get current time state. */
  getTimeState() {
    return {
      hoursRemaining: this.hoursRemaining,
      totalHours: this.diff.totalHours,
      expired: this.timeExpired,
    };
  }

  // ─── Suspect / Warrant System ────────────────────────────────

  /** Get the next suspect identity clue for this stop (vague). Returns null if all revealed. */
  getSuspectClue() {
    if (this._suspectClueIndex >= this._suspectClueAttrs.length) return null;
    // Don't give a new clue if we already gave one for this stop (e.g. player flew back)
    if (this._suspectClueStop === this.currentStop) return null;
    this._suspectClueStop = this.currentStop;
    const attr = this._suspectClueAttrs[this._suspectClueIndex];
    this._suspectClueIndex++;
    const value = this.suspect[attr];
    const group = getAttributeGroup(attr, value);

    const clueId = `suspect-${this.currentStop}-${attr}`;
    this._pendingSpecificClue = { clueId, attr, value, group };
    this._revealedAttrs.push({ attr, value: group, vague: true });

    return {
      text: SUSPECT_CLUE_TEMPLATES_VAGUE[attr](group),
      icon: '🔍',
      attr,
      group,
      clueId,
      canInvestigate: true,
    };
  }

  /** Spend time to refine the latest vague suspect clue into a specific one. */
  investigateSuspectClue() {
    if (!this._pendingSpecificClue) return null;
    const { clueId, attr, value } = this._pendingSpecificClue;
    this._pendingSpecificClue = null;

    // Upgrade the revealed attr from vague to specific
    const entry = this._revealedAttrs.find(e => e.attr === attr && e.vague);
    if (entry) {
      entry.value = value;
      entry.vague = false;
    }

    return {
      text: SUSPECT_CLUE_TEMPLATES_SPECIFIC[attr](value),
      icon: '🔎',
      attr,
      value,
      clueId,
    };
  }

  /** Time cost for investigating a suspect clue further. */
  getSuspectInvestigateCost() {
    return EXTRA_CLUE_COST_HOURS;
  }

  /** Get a lineup of 4 suspects (includes the real one). Decoys match vague clues. */
  getSuspectLineup() {
    const real = this.suspect;
    const others = SUSPECTS.filter(s => s.name !== real.name);

    const specificAttrs = new Set(
      this._revealedAttrs.filter(e => !e.vague).map(e => e.attr)
    );
    const vagueEntries = this._revealedAttrs.filter(e => e.vague);

    // Score candidates: prefer those matching the real suspect on both vague
    // AND specific attributes — forces the player to gather multiple confirmed
    // clues before they can confidently identify the thief
    const scored = others.map(s => {
      let score = 0;
      for (const { attr, value: groupName } of vagueEntries) {
        const candidateGroup = getAttributeGroup(attr, s[attr]);
        if (candidateGroup === groupName) score += 10;
      }
      // Prefer decoys that also match confirmed attributes (harder lineup)
      for (const attr of specificAttrs) {
        if (s[attr] === real[attr]) score += 15;
      }
      score += Math.random() * 2;
      return { suspect: s, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const decoys = scored.slice(0, 3).map(s => s.suspect);
    return [...decoys, real].sort(() => Math.random() - 0.5);
  }

  /** Check if the player identified the correct suspect. */
  identifySuspect(name) {
    return name === this.suspect.name;
  }

  /** Get revealed suspect attributes for the dossier. */
  getRevealedSuspectAttrs() {
    return this._revealedAttrs;
  }

  // ─── Investigation Locations ─────────────────────────────────

  /** Get available locations for the current stop. */
  getLocations() {
    return LOCATIONS;
  }

  /** Get the max investigations allowed per stop. */
  getMaxInvestigations() {
    return this.diff.investigations;
  }

  /** Investigate a location — returns a clue for that location type, or null. */
  investigateLocation(locationId) {
    if (this.gameOver) return null;

    const location = LOCATIONS.find(l => l.id === locationId);
    if (!location) return null;

    const target = this.route[this.currentStop + 1];
    const currentCountry = this.route[this.currentStop];
    const neighborChoices = this.neighborsMap[currentCountry] || [];

    // Try each clue type the location provides (thematically matched)
    // Shuffle so repeated visits to the same location type vary
    const shuffledTypes = [...location.clueTypes].sort(() => Math.random() - 0.5);
    for (const clueType of shuffledTypes) {
      let clue = null;
      switch (clueType) {
        case 'geography':
          clue = this._clueFromGeography(target, neighborChoices);
          break;
        case 'fact':
          clue = this._clueFromFact(target);
          break;
        case 'heritage':
          clue = this._clueFromHeritage(target);
          break;
        case 'river_mountain':
          clue = this._clueFromRiverOrMountain(target);
          break;
        case 'empire':
          clue = this._clueFromEmpire(target);
          break;
        case 'famous_for':
          clue = this._clueFromFamousFor(target);
          break;
        case 'exports':
          clue = this._clueFromExports(target);
          break;
      }
      if (clue && !this.usedClueIds.has(clue.id)) {
        this.usedClueIds.add(clue.id);
        return clue;
      }
    }

    // No leads at this location for this destination
    return null;
  }

  // ─── Informants ──────────────────────────────────────────────

  /** Pick a random informant matching the given location. */
  getInformant(locationId) {
    const location = LOCATIONS.find(l => l.id === locationId);
    if (location && location.informants.length > 0) {
      return location.informants[Math.floor(Math.random() * location.informants.length)];
    }
    // Fallback for non-location clues (e.g. suspect clues)
    return { emoji: '🔍', prefix: 'A witness reported' };
  }

  // ─── Thief Taunts ──────────────────────────────────────────

  /** Get a taunt appropriate for the current game state. */
  getTaunt(wrongGuess = false) {
    if (wrongGuess) {
      return this._pickRandom(THIEF_TAUNTS.wrongGuess);
    }
    const progress = this.currentStop / (this.route.length - 1);
    if (progress < 0.4) return this._pickRandom(THIEF_TAUNTS.early);
    if (progress < 0.75) return this._pickRandom(THIEF_TAUNTS.mid);
    return this._pickRandom(THIEF_TAUNTS.late);
  }

  _pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ─── Scoring ────────────────────────────────────────────────

  _calculateStopScore(firstTry, timeSeconds) {
    let score = 100;
    if (firstTry) score += 50;
    return score;
  }
}
