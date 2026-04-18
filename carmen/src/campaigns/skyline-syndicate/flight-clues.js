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

function describeRouteConfidence(confidence) {
  switch (confidence) {
    case 'historical_openflights':
      return 'confirmed from historical route records';
    case 'current_provider':
      return 'confirmed from provider records';
    case 'inferred_fallback':
      return 'an inferred corridor in ACME\'s file';
    default:
      return 'a reconstructed corridor in ACME\'s file';
  }
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

export function buildFlightConfidenceClue(routeMeta, choices = []) {
  if (!routeMeta?.confidence) return null;
  const confidenceLabel = describeRouteConfidence(routeMeta.confidence);
  const matchCount = choices.filter(choice => choice.confidence === routeMeta.confidence).length;
  const text = `ACME labels the next capital corridor as ${confidenceLabel}.`;
  return {
    id: `flight-confidence-${routeMeta.from}-${routeMeta.to}`,
    icon: '🧾',
    category: 'flight',
    text,
    data: {
      text,
      confidence: routeMeta.confidence,
      confidenceLabel,
      matchCount,
      totalChoices: choices.length,
    },
  };
}

export function buildGatewayConnectivityClue(gatewayMeta, choices = []) {
  const band = getGatewayConnectivityBand(gatewayMeta?.connectionCount);
  if (!band) return null;
  const matchCount = choices.filter(choice => choice.band === band).length;
  const text = `The destination capital is marked as a ${band} in ACME's corridor file.`;
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
