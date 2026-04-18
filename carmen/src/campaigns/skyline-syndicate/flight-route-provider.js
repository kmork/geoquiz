import { SKYLINE_SYNDICATE } from './flight-campaign-config.js';
import { buildFlightDistanceClue, getFlightDistanceBand } from './flight-clues.js';

const MAX_VISIBLE_CHOICES = 8;
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
    if (edge.distanceKm) return edge;
    const fromGateway = this.gatewayByCountry[edge.from];
    const toGateway = this.gatewayByCountry[edge.to];
    const distanceKm = haversineKm(
      fromGateway ? { lat: fromGateway.capitalLat, lon: fromGateway.capitalLon } : null,
      toGateway ? { lat: toGateway.capitalLat, lon: toGateway.capitalLon } : null,
    );
    return distanceKm ? { ...edge, distanceKm } : edge;
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
    let bestRoute = [];

    for (let attempt = 0; attempt < 40; attempt++) {
      const start = startCountries[Math.floor(Math.random() * startCountries.length)];
      if (!start) break;

      const route = [start];
      const visited = new Set([start]);

      for (let i = 0; i < numStops; i++) {
        const current = route[route.length - 1];
        const candidates = this.getChoices(current, context)
          .filter(country => !visited.has(country) && this.getChoiceCount(country) >= 1);

        if (candidates.length === 0) break;

        const scored = candidates
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
      if (bestRoute.length >= numStops + 1) break;
    }

    return bestRoute;
  }

  generateClues({ target, count, context, choices = [] }) {
    const current = context.route?.[context.currentStop];
    const distanceClue = this._distanceClue(current, target, choices, context);
    return distanceClue ? [distanceClue].slice(0, count) : null;
  }

  getLocationClue({ target, currentCountry, locationId, context, choices = [] }) {
    if (locationId !== 'airport') return null;
    return this._distanceClue(currentCountry, target, choices, context);
  }

  getBriefingHint() {
    const summary = this.getValidationSummary();
    if (!summary.routes) return '';
    const weakText = summary.weak.length
      ? ` ${summary.weak.length} gateways remain thinly sourced, so ACME labels uncertain corridors inside the file.`
      : '';
    return `Skyline file: ${summary.routes} reconstructed capital corridors are active in ACME's manifest.${weakText}`;
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

  _distanceClue(current, target, choices, context) {
    if (!current || !target) return null;
    const meta = this.getRouteMeta(current, target);
    if (!meta?.distanceKm) return null;
    const summaries = this.getDistanceChoiceSummaries(current, choices);
    const clue = buildFlightDistanceClue(meta, summaries);
    if (!clue || context?.usedClueIds?.has(clue.id)) return null;
    return clue;
  }
}
