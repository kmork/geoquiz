import { SKYLINE_SYNDICATE } from './flight-campaign-config.js';
import {
  buildAirportCodeClue,
  buildCapitalInitialClue,
  buildCargoClue,
  buildContinentClue,
  buildFlightClockClue,
  buildFlightDistanceClue,
  buildGatewayConnectivityClue,
  buildHemisphereClue,
  buildLandlockedClue,
  buildLatitudeClue,
  buildScrambleClue,
  buildOutlineClue,
  buildFlagClue,
  getFlightDistanceBand,
  getGatewayConnectivityBand,
} from './flight-clues.js';

const MAX_VISIBLE_CHOICES = 8;
const VISUAL_CLUE_CHANCE = 0.4;

const CASE_CLUE_PRIORITY = [
  null,
  ['distance', 'continent', 'capitalInitial', 'hemisphere', 'cargo', 'gateway', 'clock', 'landlocked'],
  ['distance', 'continent', 'capitalInitial', 'cargo', 'hemisphere', 'gateway', 'clock', 'landlocked'],
  ['distance', 'continent', 'hemisphere', 'capitalInitial', 'cargo', 'gateway', 'clock', 'landlocked'],
  ['clock', 'distance', 'continent', 'cargo', 'hemisphere', 'gateway', 'capitalInitial', 'landlocked'],
  ['clock', 'cargo', 'distance', 'continent', 'hemisphere', 'gateway', 'airportCode', 'capitalInitial', 'landlocked'],
  ['clock', 'distance', 'continent', 'cargo', 'hemisphere', 'gateway', 'airportCode', 'capitalInitial', 'landlocked'],
  ['gateway', 'hemisphere', 'distance', 'continent', 'cargo', 'clock', 'airportCode', 'capitalInitial', 'landlocked'],
  ['gateway', 'distance', 'hemisphere', 'continent', 'cargo', 'clock', 'airportCode', 'capitalInitial', 'landlocked'],
  ['gateway', 'distance', 'hemisphere', 'continent', 'clock', 'cargo', 'airportCode', 'capitalInitial', 'landlocked'],
  ['distance', 'gateway', 'clock', 'hemisphere', 'continent', 'cargo', 'capitalInitial', 'airportCode', 'landlocked'],
];

const LOCATION_CLUE_PRIORITY = {
  airport: {
    default: ['distance', 'scramble', 'hemisphere', 'continent', 'clock', 'gateway'],
    5: ['distance', 'hemisphere', 'airportCode', 'continent', 'clock', 'gateway', 'scramble'],
    7: ['gateway', 'hemisphere', 'distance', 'continent', 'clock', 'airportCode', 'scramble'],
    10: ['distance', 'gateway', 'clock', 'hemisphere', 'continent', 'scramble', 'airportCode'],
  },
  hotel: {
    default: ['clock', 'capitalInitial', 'cargo', 'gateway', 'landlocked'],
    1: ['capitalInitial', 'distance', 'cargo', 'clock', 'gateway', 'landlocked'],
    4: ['clock', 'capitalInitial', 'cargo', 'gateway', 'landlocked'],
    7: ['gateway', 'clock', 'capitalInitial', 'cargo', 'landlocked'],
    10: ['clock', 'gateway', 'capitalInitial', 'cargo', 'landlocked'],
  },
  embassy: {
    default: ['continent', 'hemisphere', 'clock', 'landlocked', 'gateway'],
    7: ['hemisphere', 'gateway', 'continent', 'clock', 'landlocked'],
    10: ['hemisphere', 'continent', 'clock', 'gateway', 'landlocked'],
  },
  library: {
    default: ['capitalInitial', 'outline', 'gateway', 'hemisphere', 'landlocked'],
    1: ['capitalInitial', 'outline', 'hemisphere', 'gateway', 'landlocked'],
    7: ['gateway', 'outline', 'hemisphere', 'capitalInitial', 'landlocked'],
    10: ['hemisphere', 'outline', 'capitalInitial', 'gateway', 'landlocked'],
  },
  market: {
    default: ['cargo', 'flag', 'landlocked', 'continent', 'distance', 'gateway'],
    1: ['cargo', 'flag', 'continent', 'distance', 'landlocked', 'gateway'],
    7: ['gateway', 'flag', 'cargo', 'landlocked', 'continent', 'distance'],
    10: ['distance', 'gateway', 'clock', 'flag', 'continent', 'cargo', 'landlocked'],
  },
};

export const CASE_PATTERN_TYPES = [
  null,              // index 0 unused
  'same-continent',  // case 1
  'same-hemisphere', // case 2
  'distance-band',   // case 3
  'same-continent',  // case 4
  'gateway-band',    // case 5
  'distance-band',   // case 6
  'gateway-band',    // case 7
  'same-hemisphere', // case 8
  'distance-band',   // case 9
  'same-continent',  // case 10
];
const EARTH_RADIUS_KM = 6371;

function toRad(degrees) {
  return degrees * Math.PI / 180;
}

function haversineKm(a, b) {
  if (!Number.isFinite(a?.lat) || !Number.isFinite(a?.lon) ||
      !Number.isFinite(b?.lat) || !Number.isFinite(b?.lon)) {
    return null;
  }
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

function getTimeZoneOffsetMinutes(timeZone, date = new Date()) {
  if (!timeZone) return null;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    const asUtc = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second),
    );
    return Math.round((asUtc - date.getTime()) / 60000);
  } catch {
    return null;
  }
}

function shuffle(values) {
  const copy = values.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickWeighted(scored) {
  const total = scored.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of scored) {
    roll -= item.weight;
    if (roll <= 0) return item.country;
  }
  return scored[0]?.country || null;
}

function getCasePriority(table, caseNumber) {
  const key = caseNumber >= 10 ? 10 : caseNumber >= 7 ? 7 : caseNumber >= 5 ? 5 : caseNumber >= 4 ? 4 : 1;
  return table[key] || table.default || [];
}

export class CapitalFlightRouteProvider {
  constructor(routeData = {}) {
    this.id = SKYLINE_SYNDICATE.routeKind;
    this.title = SKYLINE_SYNDICATE.title;
    this.routeData = routeData;
    this.choiceScores = {};
    this.gatewayByCountry = this._buildGatewayMap(routeData);
    this.routeMetaByPair = this._buildRouteMetaMap(routeData);
    this.choiceMap = this._buildChoiceMap(routeData);
  }

  _buildGatewayMap(routeData) {
    return Object.fromEntries(
      (routeData.gateways || [])
        .filter(gateway => gateway?.country)
        .map(gateway => [gateway.country, gateway])
    );
  }

  _buildRouteMetaMap(routeData) {
    const map = {};
    for (const edge of routeData.routes || []) {
      if (!edge?.from || !edge?.to) continue;
      const meta = this._withDistance(edge);
      map[`${edge.from}::${edge.to}`] = meta;
      if (edge.bidirectional !== false) {
        map[`${edge.to}::${edge.from}`] = { ...meta, from: edge.to, to: edge.from };
      }
    }
    return map;
  }

  _buildChoiceMap(routeData) {
    const map = {};
    const scores = {};
    for (const edge of routeData.routes || []) {
      if (!edge?.from || !edge?.to) continue;
      if (!map[edge.from]) map[edge.from] = new Set();
      if (!map[edge.to]) map[edge.to] = new Set();
      if (!scores[edge.from]) scores[edge.from] = {};
      if (!scores[edge.to]) scores[edge.to] = {};

      const confidenceScore =
        edge.confidence === 'historical_openflights' ? 100 :
        edge.confidence === 'current_provider' ? 90 :
        edge.confidence === 'inferred_fallback' ? 40 :
        60;
      const score = confidenceScore + Math.min(50, edge.routeCount || 1);

      map[edge.from].add(edge.to);
      scores[edge.from][edge.to] = Math.max(scores[edge.from][edge.to] || 0, score);
      if (edge.bidirectional !== false) map[edge.to].add(edge.from);
      if (edge.bidirectional !== false) {
        scores[edge.to][edge.from] = Math.max(scores[edge.to][edge.from] || 0, score);
      }
    }
    this.choiceScores = scores;
    return Object.fromEntries(
      Object.entries(map).map(([country, choices]) => [
        country,
        [...choices].sort((a, b) =>
          (scores[country][b] || 0) - (scores[country][a] || 0) || a.localeCompare(b)
        ),
      ])
    );
  }

  _withDistance(edge) {
    const fromGateway = this.gatewayByCountry[edge.from];
    const toGateway = this.gatewayByCountry[edge.to];
    const distanceKm = edge.distanceKm || haversineKm(
      fromGateway ? { lat: fromGateway.capitalLat, lon: fromGateway.capitalLon } : null,
      toGateway ? { lat: toGateway.capitalLat, lon: toGateway.capitalLon } : null,
    );
    return {
      ...edge,
      ...(distanceKm ? { distanceKm } : {}),
    };
  }

  getRouteMeta(from, to) {
    return this.routeMetaByPair[`${from}::${to}`] || null;
  }

  getDistanceChoiceSummaries(from, choices = []) {
    return choices
      .map(country => {
        const meta = this.getRouteMeta(from, country);
        const band = getFlightDistanceBand(meta?.distanceKm);
        return band ? { country, band, distanceKm: meta.distanceKm } : null;
      })
      .filter(Boolean);
  }

  getCapitalTimeZone(country, context = null) {
    return context?.countryMap?.[country]?.capitalTimeZone ||
      context?.countryMap?.[country]?.timeZones?.[0] ||
      null;
  }

  getClockMeta(from, to, context = null) {
    const fromTimeZone = this.getCapitalTimeZone(from, context);
    const toTimeZone = this.getCapitalTimeZone(to, context);
    const date = context?.clockReferenceDate || new Date();
    const fromUtcOffsetMinutes = getTimeZoneOffsetMinutes(fromTimeZone, date);
    const toUtcOffsetMinutes = getTimeZoneOffsetMinutes(toTimeZone, date);
    if (!Number.isFinite(fromUtcOffsetMinutes) || !Number.isFinite(toUtcOffsetMinutes)) return null;
    return {
      from,
      to,
      fromTimeZone,
      toTimeZone,
      fromUtcOffsetMinutes,
      toUtcOffsetMinutes,
      clockDeltaMinutes: toUtcOffsetMinutes - fromUtcOffsetMinutes,
    };
  }

  getClockChoiceSummaries(from, choices = [], context = null) {
    return choices
      .map(country => {
        const meta = this.getClockMeta(from, country, context);
        return Number.isFinite(meta?.clockDeltaMinutes)
          ? { country, clockDeltaMinutes: meta.clockDeltaMinutes }
          : null;
      })
      .filter(Boolean);
  }

  getGatewayConnectivityMeta(country) {
    const connectionCount = this.getChoiceCount(country);
    const band = getGatewayConnectivityBand(connectionCount);
    return band ? { country, connectionCount, band } : null;
  }

  getGatewayChoiceSummaries(choices = []) {
    return choices
      .map(country => this.getGatewayConnectivityMeta(country))
      .filter(Boolean);
  }

  getChoices(country, context = null) {
    const countrySet = context?.countrySet;
    const choices = (this.choiceMap[country] || []).slice(0, MAX_VISIBLE_CHOICES);
    const valid = countrySet ? choices.filter(c => countrySet.has(c)) : choices;
    return shuffle(valid);
  }

  getChoicesForClues(country, context = null) {
    const countrySet = context?.countrySet;
    const choices = (this.choiceMap[country] || []).slice(0, MAX_VISIBLE_CHOICES);
    return countrySet ? choices.filter(c => countrySet.has(c)) : choices;
  }

  getChoiceCount(country) {
    return (this.choiceMap[country] || []).length;
  }

  getStartCountries(context) {
    const heritageCountries = [...new Set((context.heritageSites || []).map(site => site.country))];
    return heritageCountries.filter(country =>
      context.countrySet.has(country) && this.getChoiceCount(country) >= 2
    );
  }

  generateRoute(numStops, context) {
    const startCountries = this.getStartCountries(context);
    const requiredPattern = CASE_PATTERN_TYPES[context?.caseNumber] || null;
    let bestRoute = [];
    let bestPatternRoute = [];

    const maxAttempts = requiredPattern ? 120 : 40;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const start = startCountries[Math.floor(Math.random() * startCountries.length)];
      if (!start) break;

      const route = [start];
      const visited = new Set([start]);

      for (let i = 0; i < numStops; i++) {
        const current = route[route.length - 1];
        const candidates = this.getChoices(current, context)
          .filter(country => !visited.has(country) && this.getChoiceCount(country) >= 1);

        if (candidates.length === 0) break;

        const patternCandidates = requiredPattern
          ? candidates.filter(country => this._candidateKeepsPattern(route, country, requiredPattern, context))
          : candidates;

        if (patternCandidates.length === 0) break;

        const scored = patternCandidates
          .map(country => ({
            country,
            weight: ((context.facts[country] || []).length + 1) * this.getChoiceCount(country),
          }))
          .sort((a, b) => b.weight - a.weight)
          .slice(0, Math.min(6, candidates.length));

        const pick = pickWeighted(scored);
        if (!pick) break;

        route.push(pick);
        visited.add(pick);
      }

      if (route.length > bestRoute.length) bestRoute = route;

      if (requiredPattern && route.length >= numStops + 1 &&
          this._routeMatchesPattern(route, requiredPattern, context)) {
        bestPatternRoute = route;
        break;
      }

      if (!requiredPattern && bestRoute.length >= numStops + 1) break;
    }

    return bestPatternRoute.length >= numStops + 1 ? bestPatternRoute : bestRoute;
  }

  _candidateKeepsPattern(route, candidate, patternType, context) {
    if (!route?.length || !candidate) return false;

    if (patternType === 'same-continent') {
      const startContinent = context?.countryMap?.[route[0]]?.continent;
      const candidateContinent = context?.countryMap?.[candidate]?.continent;
      return !!startContinent && candidateContinent === startContinent;
    }

    if (patternType === 'same-hemisphere') {
      const startGateway = this.gatewayByCountry[route[0]];
      const candidateGateway = this.gatewayByCountry[candidate];
      if (!Number.isFinite(startGateway?.capitalLat) || !Number.isFinite(candidateGateway?.capitalLat)) {
        return false;
      }
      return (startGateway.capitalLat >= 0) === (candidateGateway.capitalLat >= 0);
    }

    if (patternType === 'distance-band') {
      const current = route[route.length - 1];
      const nextMeta = this.getRouteMeta(current, candidate);
      const nextBand = getFlightDistanceBand(nextMeta?.distanceKm);
      if (!nextBand) return false;
      if (route.length === 1) return true;

      const firstMeta = this.getRouteMeta(route[0], route[1]);
      const firstBand = getFlightDistanceBand(firstMeta?.distanceKm);
      return !!firstBand && nextBand === firstBand;
    }

    if (patternType === 'clock-drift') {
      const current = route[route.length - 1];
      const nextClock = this.getClockMeta(current, candidate, context);
      if (!Number.isFinite(nextClock?.clockDeltaMinutes) || nextClock.clockDeltaMinutes === 0) return false;
      if (route.length === 1) return true;

      const firstClock = this.getClockMeta(route[0], route[1], context);
      if (!Number.isFinite(firstClock?.clockDeltaMinutes) || firstClock.clockDeltaMinutes === 0) return false;
      return Math.sign(nextClock.clockDeltaMinutes) === Math.sign(firstClock.clockDeltaMinutes);
    }

    if (patternType === 'gateway-band') {
      const nextBand = this.getGatewayConnectivityMeta(candidate)?.band;
      if (!nextBand) return false;
      if (route.length === 1) return true;

      const firstBand = this.getGatewayConnectivityMeta(route[1])?.band;
      return !!firstBand && nextBand === firstBand;
    }

    return true;
  }

  _routeMatchesPattern(route, patternType, context) {
    if (!route || route.length < 3) return false;

    if (patternType === 'same-continent') {
      const continents = route.map(c => context?.countryMap?.[c]?.continent).filter(Boolean);
      return continents.length === route.length && continents.every(c => c === continents[0]);
    }

    if (patternType === 'same-hemisphere') {
      const hemis = route.map(c => {
        const gw = this.gatewayByCountry[c];
        return Number.isFinite(gw?.capitalLat) ? (gw.capitalLat >= 0 ? 'N' : 'S') : null;
      });
      return hemis.every(h => h !== null && h === hemis[0]);
    }

    if (patternType === 'distance-band') {
      const bands = [];
      for (let i = 0; i < route.length - 1; i++) {
        const meta = this.getRouteMeta(route[i], route[i + 1]);
        const band = getFlightDistanceBand(meta?.distanceKm);
        if (!band) return false;
        bands.push(band);
      }
      return bands.every(b => b === bands[0]);
    }

    if (patternType === 'clock-drift') {
      const deltas = [];
      for (let i = 0; i < route.length - 1; i++) {
        const meta = this.getClockMeta(route[i], route[i + 1], context);
        if (!Number.isFinite(meta?.clockDeltaMinutes) || meta.clockDeltaMinutes === 0) return false;
        deltas.push(meta.clockDeltaMinutes);
      }
      return deltas.every(d => d > 0) || deltas.every(d => d < 0);
    }

    if (patternType === 'gateway-band') {
      const bands = route.slice(1).map(c => this.getGatewayConnectivityMeta(c)?.band).filter(Boolean);
      return bands.length === route.length - 1 && bands.every(b => b === bands[0]);
    }

    return false;
  }

  analyzeRoutePatterns(route, context) {
    if (!route || route.length < 3) return [];
    const patterns = [];

    // Same continent
    const continents = route.map(c => context?.countryMap?.[c]?.continent).filter(Boolean);
    if (continents.length === route.length && continents.every(c => c === continents[0])) {
      patterns.push({
        id: 'same-continent',
        type: 'continent',
        text: `The Dispatcher keeps the entire route within ${continents[0]}.`,
        detail: `Every stop on this routing plan is in ${continents[0]}. The next lead will be too.`,
      });
    }

    // Same hemisphere
    const hemis = route.map(c => {
      const gw = this.gatewayByCountry[c];
      return Number.isFinite(gw?.capitalLat) ? (gw.capitalLat >= 0 ? 'N' : 'S') : null;
    }).filter(Boolean);
    if (hemis.length === route.length && hemis.every(h => h === hemis[0])) {
      const label = hemis[0] === 'N' ? 'Northern' : 'Southern';
      patterns.push({
        id: 'same-hemisphere',
        type: 'hemisphere',
        text: `The Dispatcher keeps the route in the ${label} Hemisphere.`,
        detail: `Every stop is in the ${label} Hemisphere. The next corridor will stay there.`,
      });
    }

    // Distance band consistency
    const bands = [];
    for (let i = 0; i < route.length - 1; i++) {
      const meta = this.getRouteMeta(route[i], route[i + 1]);
      const band = getFlightDistanceBand(meta?.distanceKm);
      if (band) bands.push(band);
    }
    if (bands.length === route.length - 1 && bands.every(b => b === bands[0])) {
      patterns.push({
        id: 'distance-band',
        type: 'distance',
        text: `The Dispatcher favors ${bands[0]} corridors on this route.`,
        detail: `Every corridor in this routing plan is classified ${bands[0]}. Expect the same ahead.`,
      });
    }

    // Clock drift direction
    const deltas = [];
    for (let i = 0; i < route.length - 1; i++) {
      const meta = this.getClockMeta(route[i], route[i + 1], context);
      if (Number.isFinite(meta?.clockDeltaMinutes)) deltas.push(meta.clockDeltaMinutes);
    }
    if (deltas.length === route.length - 1) {
      if (deltas.every(d => d > 0)) {
        patterns.push({
          id: 'clock-east',
          type: 'clock',
          text: 'The Dispatcher pushes the clock forward at every hop.',
          detail: 'Every corridor shifts the local clock eastward. The next lead will be east of here.',
        });
      } else if (deltas.every(d => d < 0)) {
        patterns.push({
          id: 'clock-west',
          type: 'clock',
          text: 'The Dispatcher rolls the clock back at every hop.',
          detail: 'Every corridor shifts the local clock westward. The next lead will be west of here.',
        });
      }
    }

    // Gateway band consistency
    const gwBands = route.slice(1).map(c => this.getGatewayConnectivityMeta(c)?.band).filter(Boolean);
    if (gwBands.length === route.length - 1 && gwBands.every(b => b === gwBands[0])) {
      patterns.push({
        id: 'gateway-band',
        type: 'gateway',
        text: `The Dispatcher routes exclusively through ${gwBands[0]} airports.`,
        detail: `Every destination gateway is a ${gwBands[0]}. The next stop follows the same pattern.`,
      });
    }

    return patterns;
  }

  _buildClueMap(current, target, choices, context) {
    const caseNumber = context.caseNumber || 1;
    return {
      distance: () => this._distanceClue(current, target, choices, context),
      clock: () => this._clockClue(current, target, choices, context),
      gateway: () => this._gatewayClue(target, choices, context),
      hemisphere: () => this._hemisphereClue(current, target, choices, context),
      capitalInitial: () => this._capitalInitialClue(target, choices, context),
      continent: () => this._continentClue(current, target, choices, context),
      landlocked: () => this._landlockedClue(target, choices, context),
      cargo: () => this._cargoClue(target, context),
      airportCode: () => caseNumber >= 5 ? this._airportCodeClue(target, choices, context) : null,
      scramble: () => this._scrambleClue(target, context),
      outline: () => this._outlineClue(target, context),
      flag: () => this._flagClue(target, context),
    };
  }

  _collectClues(priority, clueMap, limit = Infinity) {
    const clues = [];
    const seen = new Set();
    for (const id of priority) {
      if (seen.has(id)) continue;
      seen.add(id);
      const clue = clueMap[id]?.();
      if (!clue) continue;
      clues.push(clue);
      if (clues.length >= limit) break;
    }
    return clues;
  }

  generateClues({ target, count, context, choices = [] }) {
    const current = context.route?.[context.currentStop];
    const caseNumber = context.caseNumber || 1;
    const clueMap = this._buildClueMap(current, target, choices, context);
    const priority = CASE_CLUE_PRIORITY[caseNumber] || CASE_CLUE_PRIORITY[10];
    const clues = this._collectClues(priority, clueMap, count);
    return clues.length ? clues.slice(0, count) : null;
  }

  getLocationClue({ target, currentCountry, locationId, context, choices = [] }) {
    const caseNum = context?.caseNumber || 1;
    const forceVisual = typeof window !== 'undefined' && !!window._forceVisualClues;
    const locationPriority = getCasePriority(LOCATION_CLUE_PRIORITY[locationId] || {}, caseNum);
    const visualType = locationId === 'airport' ? 'scramble' :
      locationId === 'library' ? 'outline' :
      locationId === 'market' ? 'flag' :
      null;
    const visualAllowed = forceVisual || Math.random() < VISUAL_CLUE_CHANCE;
    const priority = forceVisual && visualType
      ? [visualType, ...locationPriority.filter(id => id !== visualType)]
      : visualAllowed
        ? locationPriority
        : locationPriority.filter(id => id !== visualType);
    const clueMap = this._buildClueMap(currentCountry, target, choices, context);
    return this._collectClues(priority, clueMap, 1)[0] || null;
  }

  getValidationSummary() {
    const countries = Object.keys(this.choiceMap);
    const isolated = countries.filter(country => this.getChoiceCount(country) === 0);
    const weak = countries.filter(country => {
      const count = this.getChoiceCount(country);
      return count > 0 && count < 3;
    });
    return {
      source: this.routeData.source || 'unknown',
      importedAt: this.routeData.importedAt || null,
      countries: countries.length,
      routes: (this.routeData.routes || []).length,
      isolated,
      weak,
    };
  }

  getHemisphereChoiceSummaries(from, choices = []) {
    const fromGateway = this.gatewayByCountry[from];
    if (!Number.isFinite(fromGateway?.capitalLat)) return [];
    const fromNorth = fromGateway.capitalLat >= 0;
    return choices
      .map(country => {
        const gw = this.gatewayByCountry[country];
        if (!Number.isFinite(gw?.capitalLat)) return null;
        const toNorth = gw.capitalLat >= 0;
        return { country, sameHemisphereMatch: fromNorth !== toNorth };
      })
      .filter(Boolean);
  }

  getLatitudeChoiceSummaries(choices = []) {
    return choices
      .map(country => {
        const gw = this.gatewayByCountry[country];
        if (!Number.isFinite(gw?.capitalLat)) return null;
        const lat = gw.capitalLat;
        const band =
          lat > 66.5 ? 'above the Arctic Circle' :
          lat > 23.4 ? 'north of the Tropic of Cancer' :
          lat > 0 ? 'between the equator and the Tropic of Cancer' :
          lat > -23.4 ? 'between the equator and the Tropic of Capricorn' :
          lat > -66.5 ? 'south of the Tropic of Capricorn' :
          'below the Antarctic Circle';
        return { country, band };
      })
      .filter(Boolean);
  }

  _hemisphereClue(current, target, choices, context) {
    if (!current || !target) return null;
    const fromGateway = this.gatewayByCountry[current];
    const toGateway = this.gatewayByCountry[target];
    if (!fromGateway || !toGateway) return null;
    const crossing = fromGateway.capitalLat >= 0 !== toGateway.capitalLat >= 0;
    if (crossing) {
      const summaries = this.getHemisphereChoiceSummaries(current, choices);
      const clue = buildHemisphereClue(fromGateway, toGateway, summaries);
      if (clue && !context?.usedClueIds?.has(clue.id)) return clue;
    }
    const latSummaries = this.getLatitudeChoiceSummaries(choices);
    const latClue = buildLatitudeClue(toGateway, latSummaries);
    if (latClue && !context?.usedClueIds?.has(latClue.id)) return latClue;
    return null;
  }

  _distanceClue(current, target, choices, context) {
    if (!current || !target) return null;
    const meta = this.getRouteMeta(current, target);
    if (!meta?.distanceKm) return null;
    const summaries = this.getDistanceChoiceSummaries(current, choices);
    const clue = buildFlightDistanceClue(meta, summaries);
    if (!clue || context?.usedClueIds?.has(clue.id)) return null;
    return clue;
  }

  _clockClue(current, target, choices, context) {
    if (!current || !target) return null;
    const routeMeta = this.getRouteMeta(current, target);
    const clockMeta = this.getClockMeta(current, target, context);
    if (!routeMeta || !clockMeta) return null;
    const summaries = this.getClockChoiceSummaries(current, choices, context);
    const clue = buildFlightClockClue({ ...routeMeta, ...clockMeta }, summaries);
    if (!clue || context?.usedClueIds?.has(clue.id)) return null;
    return clue;
  }

  _gatewayClue(target, choices, context) {
    if (!target) return null;
    const meta = this.getGatewayConnectivityMeta(target);
    if (!meta) return null;
    const summaries = this.getGatewayChoiceSummaries(choices);
    const clue = buildGatewayConnectivityClue(meta, summaries);
    if (!clue || context?.usedClueIds?.has(clue.id)) return null;
    return clue;
  }

  _capitalInitialClue(target, choices, context) {
    if (!target) return null;
    const toGateway = this.gatewayByCountry[target];
    if (!toGateway?.capital) return null;
    const initial = toGateway.capital[0].toUpperCase();
    const summaries = choices.map(country => {
      const gw = this.gatewayByCountry[country];
      return gw?.capital ? { country, initial: gw.capital[0].toUpperCase() } : null;
    }).filter(Boolean);
    const clue = buildCapitalInitialClue(toGateway, summaries);
    if (!clue || context?.usedClueIds?.has(clue.id)) return null;
    return clue;
  }

  _continentClue(current, target, choices, context) {
    if (!current || !target) return null;
    const countryMap = context?.countryMap;
    if (!countryMap) return null;
    const fromContinent = countryMap[current]?.continent;
    const toContinent = countryMap[target]?.continent;
    if (!fromContinent || !toContinent) return null;
    const summaries = choices.map(country => {
      const c = countryMap[country];
      return c?.continent ? { country, continent: c.continent } : null;
    }).filter(Boolean);
    const clue = buildContinentClue(fromContinent, toContinent, target, summaries);
    if (!clue || context?.usedClueIds?.has(clue.id)) return null;
    return clue;
  }

  _landlockedClue(target, choices, context) {
    if (!target) return null;
    const countryMap = context?.countryMap;
    if (!countryMap) return null;
    const targetData = countryMap[target];
    if (!targetData || targetData.landlocked === undefined) return null;
    const summaries = choices.map(country => {
      const c = countryMap[country];
      return c ? { country, landlocked: !!c.landlocked } : null;
    }).filter(Boolean);
    const clue = buildLandlockedClue(targetData, summaries);
    if (!clue || context?.usedClueIds?.has(clue.id)) return null;
    return clue;
  }

  _cargoClue(target, context) {
    if (!target) return null;
    const countryMap = context?.countryMap;
    if (!countryMap) return null;
    const targetData = countryMap[target];
    if (!targetData?.exports?.length) return null;
    const clue = buildCargoClue(targetData);
    if (!clue || context?.usedClueIds?.has(clue.id)) return null;
    return clue;
  }

  _airportCodeClue(target, choices, context) {
    if (!target) return null;
    const toGateway = this.gatewayByCountry[target];
    if (!toGateway?.airport?.iata) return null;
    const revealFirst = Math.random() < 0.5;
    const summaries = choices.map(country => {
      const gw = this.gatewayByCountry[country];
      if (!gw?.airport?.iata) return null;
      const letter = revealFirst ? gw.airport.iata[0] : gw.airport.iata[2];
      return { country, letter };
    }).filter(Boolean);
    const clue = buildAirportCodeClue(toGateway, revealFirst, summaries);
    if (!clue || context?.usedClueIds?.has(clue.id)) return null;
    return clue;
  }

  _scrambleClue(target, context) {
    if (!target) return null;
    const toGateway = this.gatewayByCountry[target];
    if (!toGateway) return null;
    const clue = buildScrambleClue(toGateway);
    if (!clue || context?.usedClueIds?.has(clue.id)) return null;
    return clue;
  }

  _outlineClue(target, context) {
    if (!target) return null;
    const toGateway = this.gatewayByCountry[target];
    if (!toGateway) return null;
    const clue = buildOutlineClue(toGateway);
    if (!clue || context?.usedClueIds?.has(clue.id)) return null;
    return clue;
  }

  _flagClue(target, context) {
    if (!target) return null;
    const toGateway = this.gatewayByCountry[target];
    if (!toGateway) return null;
    const clue = buildFlagClue(toGateway);
    if (!clue || context?.usedClueIds?.has(clue.id)) return null;
    return clue;
  }
}
