const SCRAMBLE_INTROS = [
  'A crumpled note was found at the scene. The letters were all wrong.',
  'Someone left a torn travel receipt. The destination capital was scrambled.',
  'A notepad had hastily written letters -- rearranged, unreadable at first glance.',
  'A smudged label had a capital name on it, but the letters were jumbled.',
];

const OUTLINE_INTROS = [
  'A torn page from an atlas. No labels, just the shape of a country.',
  'Someone ripped a map and left this behind. Just a silhouette.',
  'A folded paper with a country outline sketched in pencil. No name.',
  'The page was torn from a reference book. Only the shape remains.',
];

const FLAG_INTROS = [
  'A torn flag pinned to a market stall. Only part of it remains.',
  'Someone left a ripped banner behind. The colors are faded but recognizable.',
  'A fragment of a national flag, stuffed into a crate. Weathered and torn.',
  'Half a flag, folded into a newspaper. The edges are singed.',
];

function normalizeVisualTarget(target, ctx = null) {
  if (!target) return null;
  if (typeof target === 'string') {
    const countryData = ctx?.countryMap?.[target];
    return {
      country: target,
      capital: countryData?.capitals?.[0] || countryData?.capital || null,
    };
  }
  const country = target.country || null;
  const countryData = country ? ctx?.countryMap?.[country] : null;
  return {
    country,
    capital: target.capital || countryData?.capitals?.[0] || countryData?.capital || null,
  };
}

function shuffleLetters(arr) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function buildScrambleClue(target, ctx = null) {
  const visualTarget = normalizeVisualTarget(target, ctx);
  const { country, capital } = visualTarget || {};
  if (!country || !capital || capital.length < 5) return null;

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
    id: `visual-scramble-${country}`,
    icon: '🧩',
    category: 'visual',
    text,
    data: { text, visualType: 'scramble', letters: result, fixed, answer: capital.toUpperCase() },
  };
}

export function buildOutlineClue(target, ctx = null) {
  const { country } = normalizeVisualTarget(target, ctx) || {};
  if (!country) return null;
  const text = OUTLINE_INTROS[Math.floor(Math.random() * OUTLINE_INTROS.length)];
  return {
    id: `visual-outline-${country}`,
    icon: '🗺️',
    category: 'visual',
    text,
    data: { text, visualType: 'outline', targetCountry: country },
  };
}

export function buildFlagClue(target, ctx = null) {
  const { country } = normalizeVisualTarget(target, ctx) || {};
  if (!country) return null;
  const text = FLAG_INTROS[Math.floor(Math.random() * FLAG_INTROS.length)];
  return {
    id: `visual-flag-${country}`,
    icon: '🏳️',
    category: 'visual',
    text,
    data: { text, visualType: 'flag', targetCountry: country },
  };
}

export function clueFromVisual(country, ctx, locationId) {
  switch (locationId) {
    case 'airport':
      return buildScrambleClue(country, ctx);
    case 'library':
      return buildOutlineClue(country, ctx);
    case 'market':
      return buildFlagClue(country, ctx);
    default:
      return null;
  }
}
