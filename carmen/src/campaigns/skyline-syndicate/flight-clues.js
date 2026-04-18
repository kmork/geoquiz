export function getFlightDistanceBand(distanceKm) {
  if (!distanceKm) return null;
  if (distanceKm >= 5000) return 'long-haul';
  if (distanceKm >= 1500) return 'regional';
  return 'short-hop';
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
