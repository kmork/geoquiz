export function buildFlightDistanceClue(routeMeta) {
  if (!routeMeta?.distanceKm) return null;
  const band =
    routeMeta.distanceKm >= 5000 ? 'long-haul' :
    routeMeta.distanceKm >= 1500 ? 'regional' :
    'short-hop';
  return {
    id: `flight-distance-${routeMeta.from}-${routeMeta.to}`,
    icon: '✈️',
    category: 'flight',
    text: `The flight desk tagged the next lead as a ${band} capital connection.`,
  };
}

