import {
  getFlightDistanceBand,
  getFlightDistanceLabel,
  getAirportTrafficLabel,
  getGatewayConnectivityBand,
} from './flight-clues.js';

function hashString(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function formatClockDelta(deltaMinutes) {
  if (!Number.isFinite(deltaMinutes)) return 'time difference unavailable';
  if (deltaMinutes === 0) return 'same time';
  const abs = Math.abs(deltaMinutes);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  const parts = [];
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  return `${parts.join(' ')} ${deltaMinutes > 0 ? 'ahead' : 'behind'}`;
}

function hemisphereForGateway(gateway) {
  if (!Number.isFinite(gateway?.capitalLat)) return 'unknown hemisphere';
  return gateway.capitalLat >= 0 ? 'Northern Hemisphere' : 'Southern Hemisphere';
}

function checksumKey(facts) {
  return [
    facts.distanceBand,
    facts.gatewayBand,
    facts.clockLabel,
    facts.hemisphere,
  ].join('|');
}

function buildSegmentFacts(routeProvider, fromCountry, toCountry, context) {
  const routeMeta = routeProvider.getRouteMeta?.(fromCountry, toCountry) || null;
  const clockMeta = routeProvider.getClockMeta?.(fromCountry, toCountry, context) || null;
  const gatewayMeta = routeProvider.getGatewayConnectivityMeta?.(toCountry) || null;
  const gateway = routeProvider.gatewayByCountry?.[toCountry] || null;
  const distanceBand = getFlightDistanceBand(routeMeta?.distanceKm);
  const gatewayBand = gatewayMeta?.band || getGatewayConnectivityBand(gatewayMeta?.connectionCount);
  return {
    distanceBand: getFlightDistanceLabel(distanceBand) || 'unknown route length',
    gatewayBand: getAirportTrafficLabel(gatewayBand) || 'unknown airport traffic',
    clockLabel: formatClockDelta(clockMeta?.clockDeltaMinutes),
    hemisphere: hemisphereForGateway(gateway),
  };
}

function buildChecksumToken(facts) {
  const range = (facts.distanceBand || '?').slice(0, 3).toUpperCase();
  const gateway = (facts.gatewayBand || '?').slice(0, 3).toUpperCase();
  const hemi = facts.hemisphere?.startsWith('Northern') ? 'N' :
    facts.hemisphere?.startsWith('Southern') ? 'S' : '?';
  const clock = facts.clockLabel.includes('ahead') ? '+' :
    facts.clockLabel.includes('behind') ? '-' :
    facts.clockLabel.includes('same') ? '0' : '?';
  return `${range}-${gateway}-${hemi}${clock}`;
}

export function getSkylineFinalManifestRedactedSegmentIndex(route = []) {
  const totalSegments = Math.max(0, route.length - 1);
  if (!totalSegments) return null;
  return Math.floor(totalSegments / 2) + 1;
}

export function buildSkylineFinalManifestProof(logic) {
  const route = logic?.route || [];
  const routeProvider = logic?.routeProvider || null;
  if (!routeProvider || route.length < 3) {
    throw new Error('Skyline final manifest proof requires a completed flight route.');
  }

  const redactedSegmentIndex = getSkylineFinalManifestRedactedSegmentIndex(route);
  const fromCountry = route[redactedSegmentIndex - 1];
  const toCountry = route[redactedSegmentIndex];
  const correctFacts = buildSegmentFacts(routeProvider, fromCountry, toCountry, logic);
  const correctKey = checksumKey(correctFacts);

  const segments = [];
  for (let i = 1; i < route.length; i++) {
    const segmentFrom = route[i - 1];
    const segmentTo = route[i];
    const facts = buildSegmentFacts(routeProvider, segmentFrom, segmentTo, logic);
    segments.push({
      index: i,
      fromCountry: segmentFrom,
      toCountry: segmentTo,
      fromCapital: logic.countryMap?.[segmentFrom]?.capital || '',
      toCapital: logic.countryMap?.[segmentTo]?.capital || '',
      redacted: i === redactedSegmentIndex,
      facts,
      checksumToken: buildChecksumToken(facts),
    });
  }

  const choices = [...new Set([
    ...(routeProvider.getChoicesForClues?.(fromCountry, logic) || []),
    ...(routeProvider.choiceMap?.[fromCountry] || []),
  ])];
  const decoyPool = choices
    .filter(country => country !== toCountry)
    .map(country => {
      const facts = buildSegmentFacts(routeProvider, fromCountry, country, logic);
      return {
        country,
        facts,
        key: checksumKey(facts),
      };
    })
    .filter(candidate => candidate.key !== correctKey)
    .sort((a, b) => {
      const seed = route.join('|');
      return hashString(`${seed}:${a.country}`) - hashString(`${seed}:${b.country}`) ||
        a.country.localeCompare(b.country);
    });

  const globalDecoyPool = [];
  for (const edge of routeProvider.routeData?.routes || []) {
    const pairs = edge.bidirectional === false
      ? [[edge.from, edge.to]]
      : [[edge.from, edge.to], [edge.to, edge.from]];
    for (const [edgeFrom, edgeTo] of pairs) {
      if (!logic.countrySet?.has(edgeFrom) || !logic.countrySet?.has(edgeTo)) continue;
      if (edgeFrom === fromCountry && edgeTo === toCountry) continue;
      const facts = buildSegmentFacts(routeProvider, edgeFrom, edgeTo, logic);
      const key = checksumKey(facts);
      if (key === correctKey) continue;
      globalDecoyPool.push({
        country: `${edgeFrom}->${edgeTo}`,
        facts,
        key,
      });
    }
  }
  globalDecoyPool.sort((a, b) => {
    const seed = route.join('|');
    return hashString(`${seed}:global:${a.country}`) - hashString(`${seed}:global:${b.country}`) ||
      a.country.localeCompare(b.country);
  });

  const seenKeys = new Set([correctKey]);
  const decoys = [];
  for (const decoy of [...decoyPool, ...globalDecoyPool]) {
    if (seenKeys.has(decoy.key)) continue;
    seenKeys.add(decoy.key);
    decoys.push(decoy);
    if (decoys.length >= 2) break;
  }

  if (decoys.length < 2) {
    throw new Error(`Could not build enough unique Skyline checksum decoys for ${fromCountry}.`);
  }

  const seed = route.join('|');
  const candidates = [
    { id: 'correct', facts: correctFacts, key: correctKey, correct: true },
    ...decoys.map((decoy, index) => ({
      id: `decoy-${index + 1}`,
      facts: decoy.facts,
      key: decoy.key,
      correct: false,
    })),
  ]
    .sort((a, b) => hashString(`${seed}:${a.id}:${a.key}`) - hashString(`${seed}:${b.id}:${b.key}`))
    .map((candidate, index) => ({
      ...candidate,
      label: `Checksum Row ${String.fromCharCode(65 + index)}`,
      checksumToken: buildChecksumToken(candidate.facts),
    }));

  return {
    title: 'Gate Zero Redaction',
    subtitle: 'The Dispatcher erased one manifest row. Rebuild the missing checksum before ACME can issue the warrant.',
    redactedSegmentIndex,
    fromCountry,
    toCountry,
    fromCapital: logic.countryMap?.[fromCountry]?.capital || '',
    toCapital: logic.countryMap?.[toCountry]?.capital || '',
    segments,
    candidates,
    wrongPenaltyHours: 4,
  };
}
