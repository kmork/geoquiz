/**
 * Carmen Logic — "Where in the World?" game engine.
 *
 * Pure game logic: route generation, clue selection, scoring, state machine.
 * No DOM access.
 */

const DIFFICULTY = {
  rookie:    { stops: 4, lives: 5, cluesPerStop: 3, extraClues: Infinity, investigations: 4, totalHours: 72 },
  detective: { stops: 6, lives: 3, cluesPerStop: 2, extraClues: 2, investigations: 3, totalHours: 72 },
  ace:       { stops: 8, lives: 2, cluesPerStop: 1, extraClues: 1, investigations: 2, totalHours: 64 },
};

const INVESTIGATION_COST_HOURS = 3; // hours per investigation
const TRAVEL_COST_HOURS = 5;        // hours per travel between stops
const EXTRA_CLUE_COST_HOURS = 2;    // hours per extra clue

// Investigation locations and which clue types they provide
const LOCATIONS = [
  { id: 'airport',  emoji: '✈️', name: 'Airport',  clueTypes: ['geography'] },
  { id: 'hotel',    emoji: '🏨', name: 'Hotel',    clueTypes: ['fact'] },
  { id: 'market',   emoji: '🏪', name: 'Market',   clueTypes: ['fact', 'river_mountain'] },
  { id: 'library',  emoji: '📚', name: 'Library',  clueTypes: ['empire', 'heritage'] },
  { id: 'embassy',  emoji: '🏛️', name: 'Embassy',  clueTypes: ['heritage', 'geography'] },
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

// Thief names for flavor
const THIEF_NAMES = [
  'Carmen Sandiego', 'Viktor Voss', 'Natasha Petrova', 'El Zorro',
  'The Shadow', 'Lady Crimson', 'Phantom Fox', 'Raven',
  'Scarlet Cipher', 'Dr. Atlas', 'The Cartographer', 'Velvet Mask',
];

// Suspect profiles for the warrant system
const SUSPECTS = [
  { name: 'Carmen Sandiego', hair: 'black', accessory: 'red trench coat', hobby: 'tango dancing', vehicle: 'red convertible' },
  { name: 'Viktor Voss', hair: 'blond', accessory: 'monocle', hobby: 'chess', vehicle: 'submarine' },
  { name: 'Natasha Petrova', hair: 'red', accessory: 'fur hat', hobby: 'ice skating', vehicle: 'snowmobile' },
  { name: 'El Zorro', hair: 'black', accessory: 'mask', hobby: 'fencing', vehicle: 'black stallion' },
  { name: 'The Shadow', hair: 'unknown', accessory: 'dark cloak', hobby: 'magic tricks', vehicle: 'motorcycle' },
  { name: 'Lady Crimson', hair: 'auburn', accessory: 'ruby necklace', hobby: 'opera singing', vehicle: 'luxury yacht' },
  { name: 'Phantom Fox', hair: 'silver', accessory: 'fox brooch', hobby: 'origami', vehicle: 'hang glider' },
  { name: 'Raven', hair: 'black', accessory: 'feathered hat', hobby: 'bird watching', vehicle: 'hot air balloon' },
  { name: 'Scarlet Cipher', hair: 'red', accessory: 'coded tattoo', hobby: 'cryptography', vehicle: 'sports car' },
  { name: 'Dr. Atlas', hair: 'gray', accessory: 'vintage compass', hobby: 'cartography', vehicle: 'seaplane' },
  { name: 'The Cartographer', hair: 'brown', accessory: 'leather satchel', hobby: 'mountaineering', vehicle: 'jeep' },
  { name: 'Velvet Mask', hair: 'platinum', accessory: 'velvet gloves', hobby: 'ballroom dancing', vehicle: 'limousine' },
];

const SUSPECT_ATTRIBUTES = ['hair', 'accessory', 'hobby', 'vehicle'];

const SUSPECT_CLUE_TEMPLATES = {
  hair: (val) => `A witness saw someone with ${val} hair leaving the scene.`,
  accessory: (val) => `The suspect was spotted wearing a ${val}.`,
  hobby: (val) => `An informant says the thief is known for ${val}.`,
  vehicle: (val) => `The getaway vehicle was described as a ${val}.`,
};

// Informant prefixes for clue presentation
const INFORMANTS = [
  { emoji: '🚕', prefix: 'A taxi driver told you' },
  { emoji: '🏨', prefix: 'The hotel concierge mentioned' },
  { emoji: '👮', prefix: 'A local officer reported' },
  { emoji: '🧑‍🍳', prefix: 'A street food vendor said' },
  { emoji: '📰', prefix: 'A newspaper seller whispered' },
  { emoji: '🧳', prefix: 'A fellow traveler shared' },
  { emoji: '🏛️', prefix: 'An embassy attaché noted' },
  { emoji: '🧑‍✈️', prefix: 'An airline attendant revealed' },
  { emoji: '📚', prefix: 'A librarian recalled' },
  { emoji: '🎭', prefix: 'A street performer hinted' },
  { emoji: '🛍️', prefix: 'A market vendor confided' },
  { emoji: '⛵', prefix: 'A harbor captain observed' },
  { emoji: '🧑‍🔬', prefix: 'A museum guide explained' },
  { emoji: '🗞️', prefix: 'An old journalist mentioned' },
  { emoji: '👨‍🏫', prefix: 'A university professor noted' },
  { emoji: '🔔', prefix: 'A church bell-ringer said' },
  { emoji: '🏪', prefix: 'A shopkeeper overheard' },
  { emoji: '🚂', prefix: 'A train conductor recalled' },
];

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
    // Pick the actual suspect (thief)
    this.suspect = SUSPECTS[Math.floor(Math.random() * SUSPECTS.length)];
    this.thiefName = '???'; // Unknown until identified
    this.currentStop = 0;
    this.score = 0;
    this.lives = this.diff.lives;
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
    this._revealedAttrs = [];

    // Time tracking (in-game hours)
    this.hoursRemaining = this.diff.totalHours;
    this.timeExpired = false;
  }

  /** Generate route and return the intro data. */
  start() {
    this.reset();
    this.route = this._generateRoute(this.diff.stops);
    this.artifact = this._pickArtifact(this.route[0]);
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

    // Wrong guess
    this.wrongGuessesThisStop++;
    this.totalWrongGuesses++;
    this.lives--;
    this.score = Math.max(0, this.score - 25);

    if (this.lives <= 0) {
      this.gameOver = true;
      this.won = false;
      return {
        correct: false,
        gameOver: true,
        won: false,
        country,
        correctCountry: target,
        progress: this.getProgress(),
      };
    }

    return {
      correct: false,
      gameOver: false,
      country,
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
      lives: this.lives,
      maxLives: this.diff.lives,
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

  /** Get the next suspect identity clue for this stop (one per stop). Returns null if all revealed. */
  getSuspectClue() {
    if (this._suspectClueIndex >= this._suspectClueAttrs.length) return null;
    const attr = this._suspectClueAttrs[this._suspectClueIndex];
    this._suspectClueIndex++;
    const value = this.suspect[attr];
    this._revealedAttrs.push({ attr, value });
    return {
      text: SUSPECT_CLUE_TEMPLATES[attr](value),
      icon: '🔍',
      attr,
      value,
    };
  }

  /** Get a lineup of 4 suspects for the final stop (includes the real one). */
  getSuspectLineup() {
    const others = SUSPECTS.filter(s => s.name !== this.suspect.name);
    // Pick 3 random others
    const shuffled = others.sort(() => Math.random() - 0.5).slice(0, 3);
    const lineup = [...shuffled, this.suspect].sort(() => Math.random() - 0.5);
    return lineup;
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

    // Try each clue type the location provides
    for (const clueType of location.clueTypes) {
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
      }
      if (clue && !this.usedClueIds.has(clue.id)) {
        this.usedClueIds.add(clue.id);
        return clue;
      }
    }

    // Fallback: try any available clue
    const fallbackGenerators = [
      () => this._clueFromFact(target),
      () => this._clueFromGeography(target, neighborChoices),
      () => this._clueFromHeritage(target),
      () => this._clueFromRiverOrMountain(target),
      () => this._clueFromEmpire(target),
    ];
    for (const gen of fallbackGenerators) {
      const clue = gen();
      if (clue && !this.usedClueIds.has(clue.id)) {
        this.usedClueIds.add(clue.id);
        return clue;
      }
    }

    return null;
  }

  // ─── Informants ──────────────────────────────────────────────

  /** Pick a random informant for a clue. */
  getInformant() {
    return INFORMANTS[Math.floor(Math.random() * INFORMANTS.length)];
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
