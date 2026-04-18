export const SOUTH_AMERICA_COUNTRIES = [
  'Argentina',
  'Bolivia',
  'Brazil',
  'Chile',
  'Colombia',
  'Ecuador',
  'Guyana',
  'Paraguay',
  'Peru',
  'Suriname',
  'Uruguay',
  'Venezuela',
];

export const CRIMSON_FINALE_ROUTE = ['Colombia', 'Uruguay', 'Brazil', 'Argentina', 'Cuba'];

const START_EXCLUSIONS = new Set([...CRIMSON_FINALE_ROUTE]);
const CUBA_VISIBLE_FROM_STOP = 2;
const MAX_STRONG_MATCHES = 3;

const LOCATION_CATEGORIES = {
  airport: ['geography', 'river_mountain', 'fact'],
  hotel: ['famous_for', 'fact', 'geography'],
  market: ['exports', 'fact', 'geography'],
  library: ['landmarks', 'history', 'famous_for', 'fact'],
  embassy: ['geography', 'landmarks', 'fact'],
};

const CURATED_CLUES = {
  Colombia: {
    geography: [
      'The next country has shores on both the Caribbean Sea and the Pacific Ocean.',
      'The trail bends toward the northwest corner of South America, where the Andes split into three ranges.',
    ],
    landmarks: [
      'Old Caribbean walls and bright colonial streets keep showing up in the witness sketches.',
    ],
    exports: [
      'Coffee, cut flowers, and emeralds keep turning up in the cargo notes.',
    ],
    famous_for: [
      'The country in the lead is famous for coffee country, emeralds, and mountain cities.',
    ],
    fact: [
      'The capital sits high on an Andean plateau, far above the lowland heat.',
    ],
  },
  Uruguay: {
    geography: [
      'The next country is one of the continent\'s smallest, set between two much larger neighbors.',
      'Look for the country tucked along the Río de la Plata, across the water from a larger capital.',
    ],
    landmarks: [
      'A colonial quarter contested by Portuguese and Spanish powers keeps appearing in the notes.',
    ],
    exports: [
      'Beef, wool, and soybeans show up together in the shipment ledgers.',
    ],
    famous_for: [
      'The place is known for mate, beaches, and a capital on the broad river mouth.',
    ],
    fact: [
      'The lead points to a small, stable republic between two giants.',
    ],
  },
  Brazil: {
    geography: [
      'The trail points to the largest country in South America.',
      'The next country covers a huge eastern sweep of the continent and reaches deep into the Amazon basin.',
    ],
    landmarks: [
      'Rainforest, wetlands, and a famous harbor city keep appearing in the recovered sketches.',
    ],
    exports: [
      'Coffee, soybeans, iron ore, and aircraft parts keep surfacing in the market chatter.',
    ],
    famous_for: [
      'The destination is the continent\'s Portuguese-speaking giant.',
    ],
    fact: [
      'This is the only Portuguese-speaking country in South America.',
    ],
  },
  Argentina: {
    geography: [
      'The trail runs toward the long southern country with the Andes on one side and the Atlantic on the other.',
      'The next stop belongs to the Southern Cone, stretching from subtropical falls toward Patagonian ice.',
    ],
    landmarks: [
      'Glaciers, tango halls, and a great river estuary keep turning up in the records.',
    ],
    exports: [
      'Beef, wine, soybeans, and wheat are all over the shipping papers.',
    ],
    famous_for: [
      'The lead points to tango, pampas, and a capital on the Río de la Plata.',
    ],
    fact: [
      'The destination is South America\'s second-largest country by area.',
    ],
  },
};

const ACROSTIC_CLUES = {
  airport: [
    'The boarding clerk circled the first mark on each of the last four arrival stamps, then folded the manifest shut.',
    'Four confirmed stamps were copied onto a boarding slip. Only their opening letters were left unblurred.',
  ],
  hotel: [
    'The guest register listed the last four stops in order, but someone had pressed hardest on the first letter of each name.',
    'A maid found four country names trimmed down to their initials on the blotter.',
  ],
  market: [
    'A vendor found four loose initials beside a rough island outline, as if the route had become a word game.',
    'The thief bought four letter tiles and left the country names written underneath them in order.',
  ],
  library: [
    'The archive note stopped comparing borders and started comparing first letters.',
    'A margin note read: "After the fourth confirmed stamp, read the starts, not the roads."',
  ],
  embassy: [
    'A cable warned that the next lead may be hidden in the starts of the countries already confirmed.',
    'The diplomatic file treated the last four destinations like initials, not coordinates.',
  ],
};

function shuffle(values) {
  const copy = values.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pick(values) {
  if (!values.length) return null;
  return values[Math.floor(Math.random() * values.length)];
}

function clue(id, text, category = 'fact', icon = '📋') {
  return { id, text, category, icon, data: { text } };
}

export class CrimsonTrailFinaleRouteProvider {
  constructor() {
    this.id = 'crimson_trail_finale';
    this.title = 'The Crimson Trail Finale';
    this.choiceMap = Object.fromEntries(
      SOUTH_AMERICA_COUNTRIES.map(country => [
        country,
        [...SOUTH_AMERICA_COUNTRIES.filter(choice => choice !== country), 'Cuba'],
      ])
    );
  }

  isArgentinaAcrosticStop(context) {
    return context?.route?.[context.currentStop] === 'Argentina'
      && context?.route?.[context.currentStop + 1] === 'Cuba';
  }

  getBriefingHint() {
    return 'ACME note: Carmen has widened the field. South America is no longer a border trail; it is a whole desk of possible exits.';
  }

  generateRoute(numStops, context) {
    const countries = new Set(context.countries.map(c => c.country));
    const heritageCountries = new Set((context.heritageSites || []).map(site => site.country));
    const startCandidates = SOUTH_AMERICA_COUNTRIES.filter(country =>
      countries.has(country) && !START_EXCLUSIONS.has(country)
    );
    const heritageStarts = startCandidates.filter(country => heritageCountries.has(country));
    const start = pick(heritageStarts.length ? heritageStarts : startCandidates) || 'Peru';
    return [start, ...CRIMSON_FINALE_ROUTE].slice(0, numStops + 1);
  }

  getChoices(country, context = null) {
    return shuffle(this.getChoicesForClues(country, context));
  }

  getChoicesForClues(country, context = null) {
    const countrySet = context?.countrySet;
    const choices = SOUTH_AMERICA_COUNTRIES
      .filter(choice => choice !== country)
      .filter(choice => !countrySet || countrySet.has(choice));

    if ((context?.currentStop || 0) >= CUBA_VISIBLE_FROM_STOP && (!countrySet || countrySet.has('Cuba'))) {
      choices.push('Cuba');
    }

    return choices;
  }

  shouldUseClue({ clue, context }) {
    if (this.isArgentinaAcrosticStop(context)) return false;
    if (clue?.category === 'geography' && clue?.subtype === 'neighbors') return false;
    const matchCount = clue?.data?.matchCount;
    const totalChoices = clue?.data?.totalChoices;
    if (matchCount === undefined || !totalChoices) return true;
    return matchCount <= MAX_STRONG_MATCHES;
  }

  generateClues({ count, context }) {
    if (!this.isArgentinaAcrosticStop(context)) return null;
    return this._acrosticPool(context)
      .slice(0, count)
      .map(({ id, text }) => clue(id, text, 'fact', '🧩'));
  }

  getLocationClue({ locationId, context }) {
    if (!this.isArgentinaAcrosticStop(context)) return null;
    const pool = ACROSTIC_CLUES[locationId] || ACROSTIC_CLUES.library;
    return this._firstUnused(pool.map((text, i) =>
      clue(`crimson-finale-acrostic-${locationId}-${i}`, text, 'fact', '🧩')
    ), context);
  }

  getFallbackClue({ target, context }) {
    return this._curatedClue(target, ['geography', 'fact', 'famous_for'], context);
  }

  getFallbackLocationClue({ target, locationId, context }) {
    const categories = LOCATION_CATEGORIES[locationId] || ['fact'];
    return this._curatedClue(target, categories, context);
  }

  _curatedClue(target, categories, context) {
    const bank = CURATED_CLUES[target];
    if (!bank) return null;
    const candidates = [];
    for (const category of categories) {
      const items = bank[category] || [];
      for (let i = 0; i < items.length; i++) {
        candidates.push(clue(
          `crimson-finale-${target}-${category}-${i}`,
          items[i],
          'fact',
          category === 'exports' ? '📦' :
            category === 'landmarks' ? '🏛️' :
            category === 'geography' ? '🌍' : '📋',
        ));
      }
    }
    return this._firstUnused(candidates, context);
  }

  _acrosticPool(context) {
    return [
      ...Object.entries(ACROSTIC_CLUES).flatMap(([locationId, entries]) =>
        entries.map((text, i) => ({ id: `crimson-finale-acrostic-${locationId}-${i}`, text }))
      ),
      {
        id: `crimson-finale-acrostic-route-${context.currentStop}`,
        text: 'The last four confirmed countries form a clean four-letter instruction if you read only their first letters.',
      },
    ].filter(item => !context.usedClueIds.has(item.id));
  }

  _firstUnused(candidates, context) {
    return candidates.find(candidate => !context.usedClueIds.has(candidate.id)) || null;
  }
}
