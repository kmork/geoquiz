export function getFlightDistanceBand(distanceKm) {
  if (!distanceKm) return null;
  if (distanceKm >= 5000) return 'long-haul';
  if (distanceKm >= 1500) return 'regional';
  return 'short-hop';
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
