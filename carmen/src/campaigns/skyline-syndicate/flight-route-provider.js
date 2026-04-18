import { SKYLINE_SYNDICATE } from './flight-campaign-config.js';

const MAX_VISIBLE_CHOICES = 8;

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
    this.choiceMap = this._buildChoiceMap(routeData);
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

  getChoices(country, context = null) {
    const countrySet = context?.countrySet;
    const choices = (this.choiceMap[country] || []).slice(0, MAX_VISIBLE_CHOICES);
    const valid = countrySet ? choices.filter(c => countrySet.has(c)) : choices;
    return shuffle(valid);
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
}
