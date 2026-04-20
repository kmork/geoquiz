/**
 * Pure clue generators — each takes (country, ctx) and returns a clue object or null.
 *
 * ctx is a data bag with:
 *   facts, heritagByCountry, riversByCountry, mountainsByCountry,
 *   empiresByCountry, countryMap, neighborsMap, usedClueIds (Set)
 *
 * Generators do NOT mutate usedClueIds — the caller (generateClues) owns dedup bookkeeping.
 */

import { redactCountryName, containsCountryName } from './redaction.js';

export { clueFromVisual } from './visual-clues.js';

const CATEGORY_ICONS = {
  culture: '🎭',
  landmarks: '🏛️',
  history: '📜',
  geography: '🌍',
  nature: '🌿',
  politics: '⚖️',
  economy: '💰',
};

export function iconForCategory(category) {
  return CATEGORY_ICONS[category] || '📋';
}

export function popBracket(pop) {
  if (!pop) return 'unknown';
  if (pop > 100_000_000) return 'over 100 million';
  if (pop > 50_000_000) return 'over 50 million';
  if (pop > 20_000_000) return 'over 20 million';
  if (pop > 10_000_000) return 'over 10 million';
  if (pop > 1_000_000) return 'over 1 million';
  return 'under 1 million';
}

export function clueFromFact(country, ctx) {
  const facts = ctx.facts[country] || [];
  if (facts.length === 0) return null;
  const shuffled = [...facts].sort(() => Math.random() - 0.5);
  for (const f of shuffled) {
    const id = `fact-${country}-${f.fact.slice(0, 30)}`;
    if (ctx.usedClueIds.has(id)) continue;
    const redacted = redactCountryName(f.fact, country);
    if (!containsCountryName(redacted, country)) {
      return { id, text: redacted, icon: iconForCategory(f.category), category: 'fact', data: { text: redacted } };
    }
  }
  return null;
}

/**
 * Build geography clues that actually distinguish the target from neighbor choices.
 */
export function allGeographyClues(country, ctx, neighborChoices = []) {
  const c = ctx.countryMap[country];
  if (!c) return [];
  const clues = [];

  const neighborContinents = new Set(
    neighborChoices.map(n => ctx.countryMap[n]?.continent).filter(Boolean)
  );
  if (neighborContinents.size > 1) {
    clues.push({
      id: `geo-continent-${country}`,
      text: `This country is in ${c.continent}.`,
      icon: '🌍', category: 'geography', subtype: 'continent',
      data: { continent: c.continent },
    });
  }

  if (c.landlocked) {
    const allLandlocked = neighborChoices.every(n => ctx.countryMap[n]?.landlocked);
    if (!allLandlocked) {
      clues.push({
        id: `geo-landlocked-${country}`,
        text: 'This country is landlocked.',
        icon: '🌍', category: 'geography', subtype: 'landlocked',
        data: {},
      });
    }
  }

  if (c.capitals && c.capitals[0]) {
    const cap = c.capitals[0];
    const capMatchCount = neighborChoices.filter(n => {
      const nc = ctx.countryMap[n];
      return nc?.capitals?.[0]?.[0]?.toUpperCase() === cap[0].toUpperCase();
    }).length;
    clues.push({
      id: `geo-capital-letter-${country}`,
      text: `The capital starts with the letter "${cap[0]}".`,
      icon: '🏛️', category: 'geography', subtype: 'capital_letter',
      data: { letter: cap[0], matchCount: capMatchCount, totalChoices: neighborChoices.length },
    });
  }

  if (c.population) {
    const bracket = popBracket(c.population);
    const neighborBrackets = neighborChoices.map(n => popBracket(ctx.countryMap[n]?.population));
    if (neighborBrackets.some(b => b !== bracket)) {
      const popMatchCount = neighborBrackets.filter(b => b === bracket).length;
      clues.push({
        id: `geo-pop-${country}`,
        text: `This country has a population of ${bracket}.`,
        icon: '👥', category: 'geography', subtype: 'population',
        data: { bracket, matchCount: popMatchCount, totalChoices: neighborChoices.length },
      });
    }
  }

  const nbrCount = (ctx.neighborsMap[country] || []).length;
  if (!ctx.routeProvider && nbrCount > 0) {
    const nbrMatchCount = neighborChoices.filter(n =>
      (ctx.neighborsMap[n] || []).length === nbrCount
    ).length;
    clues.push({
      id: `geo-neighbors-${country}`,
      text: `This country borders ${nbrCount} ${nbrCount === 1 ? 'country' : 'countries'}.`,
      icon: '🌍', category: 'geography', subtype: 'neighbors',
      data: { count: nbrCount, matchCount: nbrMatchCount, totalChoices: neighborChoices.length },
    });
  }

  if (c.highestPeak) {
    clues.push({
      id: `geo-peak-${country}`,
      text: `The highest point here is ${c.highestPeak.name} at ${c.highestPeak.elev.toLocaleString()}m.`,
      icon: '⛰️', category: 'geography', subtype: 'peak',
      data: { name: c.highestPeak.name, elev: c.highestPeak.elev },
    });
  }

  return clues;
}

export function clueFromGeography(country, ctx, neighborChoices = []) {
  const clues = allGeographyClues(country, ctx, neighborChoices);
  const shuffled = clues.sort(() => Math.random() - 0.5);
  for (const c of shuffled) {
    if (!ctx.usedClueIds.has(c.id)) return c;
  }
  return null;
}

export function clueFromHeritage(country, ctx) {
  const sites = ctx.heritagByCountry[country] || [];
  if (sites.length === 0) return null;
  const shuffled = [...sites].sort(() => Math.random() - 0.5);
  for (const site of shuffled) {
    const id = `heritage-${country}-${site.siteName}`;
    if (ctx.usedClueIds.has(id)) continue;
    const text = redactCountryName(`A famous site here: ${site.hint}.`, country);
    if (!containsCountryName(text, country)) {
      return { id, text, icon: '🏛️', category: 'landmarks', data: { siteName: site.siteName, hint: site.hint } };
    }
  }
  return null;
}

export function clueFromRiverOrMountain(country, ctx, neighborChoices = []) {
  const features = [
    ...(ctx.riversByCountry[country] || []).map(r => ({ ...r, type: 'river' })),
    ...(ctx.mountainsByCountry[country] || []).map(m => ({ ...m, type: 'mountain' })),
  ];
  if (features.length === 0) return null;
  const shuffled = features.sort(() => Math.random() - 0.5);
  for (const f of shuffled) {
    const id = `feature-${f.type}-${f.name}`;
    if (ctx.usedClueIds.has(id)) continue;
    const label = f.type === 'river' ? 'river' : 'mountain range';
    const matchCount = neighborChoices.filter(n => f.countries?.includes(n)).length;
    return {
      id,
      text: `The ${f.name} ${label} passes through this country.`,
      icon: f.type === 'river' ? '🏞️' : '⛰️',
      category: 'river_mountain',
      data: { name: f.name, type: f.type, matchCount, totalChoices: neighborChoices.length },
    };
  }
  return null;
}

export function clueFromEmpire(country, ctx) {
  const empires = ctx.empiresByCountry[country] || [];
  if (empires.length === 0) return null;
  const shuffled = [...empires].sort(() => Math.random() - 0.5);
  for (const e of shuffled) {
    const id = `empire-${e.name || e.id}`;
    if (ctx.usedClueIds.has(id)) continue;
    return {
      id,
      text: `This country was once part of the ${e.name} (${e.yearLabel}).`,
      icon: '👑', category: 'history',
      data: { name: e.name, yearLabel: e.yearLabel },
    };
  }
  return null;
}

export function clueFromFamousFor(country, ctx, neighborChoices = []) {
  const items = ctx.countryMap[country]?.famousFor;
  if (!items || items.length === 0) return null;
  const templates = [
    item => `This place is known for ${item}.`,
    item => `The destination is famous for ${item}.`,
    item => `You'll find ${item} in this country.`,
  ];
  const shuffled = items.map((item, i) => ({ item, i })).sort(() => Math.random() - 0.5);
  for (const { item, i } of shuffled) {
    const id = `famous-${country}-${i}`;
    if (ctx.usedClueIds.has(id)) continue;
    const template = templates[Math.floor(Math.random() * templates.length)];
    const text = redactCountryName(template(item), country);
    if (containsCountryName(text, country)) continue;
    const matchCount = neighborChoices.filter(n =>
      (ctx.countryMap[n]?.famousFor || []).includes(item)
    ).length;
    return { id, text, icon: '🌟', category: 'famous_for', data: { item, matchCount, totalChoices: neighborChoices.length } };
  }
  return null;
}

export function clueFromExports(country, ctx, neighborChoices = []) {
  const items = ctx.countryMap[country]?.exports;
  if (!items || items.length === 0) return null;
  const templates = [
    list => `This country is a major exporter of ${list}.`,
    list => `Key exports from here include ${list}.`,
    list => `The local economy runs on ${list}.`,
  ];
  let subset;
  if (items.length <= 2) {
    subset = [...items];
  } else {
    const shuffled = [...items].sort(() => Math.random() - 0.5);
    subset = shuffled.slice(0, 2 + Math.floor(Math.random() * 2));
  }
  const sorted = [...subset].sort();
  const id = `exports-${country}-${sorted.join(',')}`;
  if (ctx.usedClueIds.has(id)) return null;
  let list;
  if (subset.length === 1) list = subset[0];
  else if (subset.length === 2) list = `${subset[0]} and ${subset[1]}`;
  else list = `${subset.slice(0, -1).join(', ')}, and ${subset[subset.length - 1]}`;
  const template = templates[Math.floor(Math.random() * templates.length)];
  const text = redactCountryName(template(list), country);
  if (containsCountryName(text, country)) return null;
  const matchCount = neighborChoices.filter(n => {
    const nExports = ctx.countryMap[n]?.exports || [];
    return subset.some(item => nExports.includes(item));
  }).length;
  return { id, text, icon: '📦', category: 'exports', data: { list, items: subset, matchCount, totalChoices: neighborChoices.length } };
}
