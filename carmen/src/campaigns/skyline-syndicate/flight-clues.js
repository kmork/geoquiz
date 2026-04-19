export function getFlightDistanceBand(distanceKm) {
  if (!distanceKm) return null;
  if (distanceKm >= 5000) return 'long-haul';
  if (distanceKm >= 1500) return 'regional';
  return 'short-hop';
}

export function getGatewayConnectivityBand(connectionCount) {
  if (!Number.isFinite(connectionCount)) return null;
  if (connectionCount >= 25) return 'major gateway';
  if (connectionCount >= 10) return 'well-connected gateway';
  if (connectionCount >= 5) return 'limited gateway';
  return 'thin gateway';
}

function formatMinuteDelta(deltaMinutes) {
  const abs = Math.abs(deltaMinutes);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  if (hours && minutes) {
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ${minutes} minutes`;
  }
  if (hours) return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  return `${minutes} minutes`;
}

function describeClockShift(deltaMinutes) {
  if (!Number.isFinite(deltaMinutes)) return null;
  if (deltaMinutes > 0) return `${formatMinuteDelta(deltaMinutes)} ahead of departure`;
  if (deltaMinutes < 0) return `${formatMinuteDelta(deltaMinutes)} behind departure`;
  return 'on the same legal clock as departure';
}

export function buildFlightDistanceClue(routeMeta, choices = []) {
  if (!routeMeta?.distanceKm) return null;
  const band = getFlightDistanceBand(routeMeta.distanceKm);
  if (!band) return null;
  const matchCount = choices.filter(choice => choice.band === band).length;
  const text = `The flight desk tagged the next lead as a ${band} capital connection.`;
  return {
    id: `flight-distance-${routeMeta.from}-${routeMeta.to}`,
    icon: '✈️',
    category: 'flight',
    text,
    data: {
      text,
      band,
      distanceKm: Math.round(routeMeta.distanceKm),
      matchCount,
      totalChoices: choices.length,
    },
  };
}

export function buildFlightClockClue(routeMeta, choices = []) {
  if (!Number.isFinite(routeMeta?.clockDeltaMinutes)) return null;
  const description = describeClockShift(routeMeta.clockDeltaMinutes);
  if (!description) return null;
  const matchCount = choices.filter(choice => choice.clockDeltaMinutes === routeMeta.clockDeltaMinutes).length;
  const text = `The legal time-zone record puts the next capital ${description}.`;
  return {
    id: `flight-clock-${routeMeta.from}-${routeMeta.to}`,
    icon: '🕰',
    category: 'flight',
    text,
    data: {
      text,
      clockDeltaMinutes: routeMeta.clockDeltaMinutes,
      fromUtcOffsetMinutes: routeMeta.fromUtcOffsetMinutes,
      toUtcOffsetMinutes: routeMeta.toUtcOffsetMinutes,
      fromTimeZone: routeMeta.fromTimeZone,
      toTimeZone: routeMeta.toTimeZone,
      matchCount,
      totalChoices: choices.length,
    },
  };
}

function describeLatitudeBand(lat) {
  if (lat > 66.5) return 'above the Arctic Circle';
  if (lat > 23.4) return 'north of the Tropic of Cancer';
  if (lat > 0) return 'between the equator and the Tropic of Cancer';
  if (lat > -23.4) return 'between the equator and the Tropic of Capricorn';
  if (lat > -66.5) return 'south of the Tropic of Capricorn';
  return 'below the Antarctic Circle';
}

function describeHemisphere(fromLat, toLat) {
  if (fromLat >= 0 && toLat < 0) return 'crossed into the Southern Hemisphere';
  if (fromLat < 0 && toLat >= 0) return 'crossed into the Northern Hemisphere';
  if (toLat >= 0) return 'stayed in the Northern Hemisphere';
  return 'stayed in the Southern Hemisphere';
}

export function buildHemisphereClue(fromGateway, toGateway, choices = []) {
  if (!Number.isFinite(fromGateway?.capitalLat) || !Number.isFinite(toGateway?.capitalLat)) return null;
  const crossing = fromGateway.capitalLat >= 0 !== toGateway.capitalLat >= 0;
  const hemisphere = describeHemisphere(fromGateway.capitalLat, toGateway.capitalLat);
  const matchCount = choices.filter(c => c.sameHemisphereMatch === crossing).length;
  const text = `The flight ${hemisphere}.`;
  return {
    id: `flight-hemisphere-${fromGateway.country}-${toGateway.country}`,
    icon: '🌍',
    category: 'flight',
    text,
    data: { text, crossing, matchCount, totalChoices: choices.length },
  };
}

export function buildLatitudeClue(toGateway, choices = []) {
  if (!Number.isFinite(toGateway?.capitalLat)) return null;
  const band = describeLatitudeBand(toGateway.capitalLat);
  const matchCount = choices.filter(c => c.band === band).length;
  const text = `The next capital sits ${band}.`;
  return {
    id: `flight-latitude-${toGateway.country}`,
    icon: '🌍',
    category: 'flight',
    text,
    data: { text, band, matchCount, totalChoices: choices.length },
  };
}

export function buildCapitalInitialClue(toGateway, choices = []) {
  if (!toGateway?.capital) return null;
  const initial = toGateway.capital[0].toUpperCase();
  const matchCount = choices.filter(c => c.initial === initial).length;
  const text = `The boarding stub shows the destination capital starts with the letter ${initial}.`;
  return {
    id: `flight-capital-initial-${toGateway.country}`,
    icon: '🔤',
    category: 'flight',
    text,
    data: { text, initial, matchCount, totalChoices: choices.length },
  };
}

export function buildContinentClue(fromContinent, toContinent, toCountry, choices = []) {
  if (!fromContinent || !toContinent) return null;
  const crosses = fromContinent !== toContinent;
  if (crosses) {
    const matchCount = choices.filter(c => c.continent === toContinent).length;
    const text = `The air trail crosses into ${toContinent}.`;
    return {
      id: `flight-continent-${toCountry}`,
      icon: '🗺️',
      category: 'flight',
      text,
      data: { text, continent: toContinent, crosses, matchCount, totalChoices: choices.length },
    };
  }
  const matchCount = choices.filter(c => c.continent === toContinent).length;
  const text = `The next lead stays within ${toContinent}.`;
  return {
    id: `flight-continent-${toCountry}`,
    icon: '🗺️',
    category: 'flight',
    text,
    data: { text, continent: toContinent, crosses, matchCount, totalChoices: choices.length },
  };
}

export function buildLandlockedClue(targetCountryData, choices = []) {
  if (!targetCountryData || targetCountryData.landlocked === undefined) return null;
  const landlocked = !!targetCountryData.landlocked;
  const matchCount = choices.filter(c => c.landlocked === landlocked).length;
  const text = landlocked
    ? 'The destination country has no coastline — cargo arrived by air only.'
    : 'The destination country has a coastline.';
  return {
    id: `flight-landlocked-${targetCountryData.country}`,
    icon: '🏔️',
    category: 'flight',
    text,
    data: { text, landlocked, matchCount, totalChoices: choices.length },
  };
}

const CARGO_TEMPLATES = [
  'The crate was relabeled as',
  'The cargo manifest listed the contents as',
  'Customs paperwork referenced',
  'The freight tag declared',
  'The sealed container was logged as',
];

export function buildCargoClue(targetCountryData, choices = []) {
  const exports = targetCountryData?.exports;
  if (!exports || exports.length === 0) return null;
  const exportItem = exports[Math.floor(Math.random() * exports.length)];
  const template = CARGO_TEMPLATES[Math.floor(Math.random() * CARGO_TEMPLATES.length)];
  const text = `${template} ${exportItem}.`;
  return {
    id: `flight-cargo-${targetCountryData.country}-${exportItem}`,
    icon: '📦',
    category: 'flight',
    text,
    data: { text, exportItem, country: targetCountryData.country },
  };
}

export function buildAirportCodeClue(toGateway, revealFirst, choices = []) {
  const iata = toGateway?.airport?.iata;
  if (!iata || iata.length !== 3) return null;
  const letter = revealFirst ? iata[0] : iata[2];
  const position = revealFirst ? 'starting with' : 'ending in';
  const matchCount = choices.filter(c => c.letter === letter).length;
  const text = `The gate stamp shows an arrival code ${position} ${letter}.`;
  return {
    id: `flight-airport-code-${toGateway.country}-${position}-${letter}`,
    icon: '🏷️',
    category: 'flight',
    text,
    data: { text, letter, revealFirst, iata, matchCount, totalChoices: choices.length },
  };
}

// ── Visual clue builders ──────────────────────────────────────────

function shuffleLetters(arr) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const SCRAMBLE_INTROS = [
  'A crumpled note was stuffed behind the seat. The letters were all wrong.',
  'Someone left a torn boarding pass. The destination was scrambled.',
  'A napkin with hastily written letters — rearranged, unreadable at first glance.',
  'The gate receipt had a name on it, but the letters were jumbled.',
];

export function buildScrambleClue(toGateway) {
  const capital = toGateway?.capital;
  if (!capital || capital.length < 5) return null;

  const letters = [];
  const fixed = [];
  const letterIndices = [];
  for (let i = 0; i < capital.length; i++) {
    const ch = capital[i];
    if (ch === ' ' || ch === '-' || ch === "'" || ch === '.') {
      letters.push(ch);
      fixed.push(true);
    } else {
      letters.push(ch.toUpperCase());
      fixed.push(false);
      letterIndices.push(i);
    }
  }

  // Shuffle only non-fixed letters, ensure different from original
  const originalLetters = letterIndices.map(i => letters[i]);
  let shuffled;
  let attempts = 0;
  do {
    shuffled = shuffleLetters(originalLetters);
    attempts++;
  } while (shuffled.join('') === originalLetters.join('') && attempts < 50);

  const result = letters.slice();
  letterIndices.forEach((idx, i) => { result[idx] = shuffled[i]; });

  const text = SCRAMBLE_INTROS[Math.floor(Math.random() * SCRAMBLE_INTROS.length)];
  return {
    id: `visual-scramble-${toGateway.country}`,
    icon: '🧩',
    category: 'visual',
    text,
    data: { text, visualType: 'scramble', letters: result, fixed, answer: capital.toUpperCase() },
  };
}

const OUTLINE_INTROS = [
  'A torn page from an atlas. No labels, just the shape of a country.',
  'Someone ripped a map and left this behind. Just a silhouette.',
  'A folded paper with a country outline sketched in pencil. No name.',
  'The page was torn from a reference book. Only the shape remains.',
];

export function buildOutlineClue(toGateway) {
  if (!toGateway?.country) return null;
  const text = OUTLINE_INTROS[Math.floor(Math.random() * OUTLINE_INTROS.length)];
  return {
    id: `visual-outline-${toGateway.country}`,
    icon: '🗺️',
    category: 'visual',
    text,
    data: { text, visualType: 'outline', targetCountry: toGateway.country },
  };
}

const FLAG_INTROS = [
  'A torn flag pinned to a market stall. Only part of it remains.',
  'Someone left a ripped banner behind. The colors are faded but recognizable.',
  'A fragment of a national flag, stuffed into a crate. Weathered and torn.',
  'Half a flag, folded into a newspaper. The edges are singed.',
];

export function buildFlagClue(toGateway) {
  if (!toGateway?.country) return null;
  const text = FLAG_INTROS[Math.floor(Math.random() * FLAG_INTROS.length)];
  return {
    id: `visual-flag-${toGateway.country}`,
    icon: '🏳️',
    category: 'visual',
    text,
    data: { text, visualType: 'flag', targetCountry: toGateway.country },
  };
}

export function buildGatewayConnectivityClue(gatewayMeta, choices = []) {
  const band = getGatewayConnectivityBand(gatewayMeta?.connectionCount);
  if (!band) return null;
  const matchCount = choices.filter(choice => choice.band === band).length;
  const text = `The destination capital is known as a ${band} for air traffic.`;
  return {
    id: `flight-gateway-${gatewayMeta.country}-${band}`,
    icon: '🛫',
    category: 'flight',
    text,
    data: {
      text,
      band,
      connectionCount: gatewayMeta.connectionCount,
      matchCount,
      totalChoices: choices.length,
    },
  };
}
