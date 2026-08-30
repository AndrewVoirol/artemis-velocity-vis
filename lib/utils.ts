
// Calculates distance in miles between two lat/lon points
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8; // Radius of the earth in miles
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in miles
  return d;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

function rad2deg(rad: number): number {
  return rad * (180 / Math.PI);
}

// Interpolates along the great-circle arc between two lat/lon points.
// Uses the spherical intermediate point formula.
// fraction: 0 = start, 1 = end
export function interpolatePosition(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
  fraction: number
): [number, number] {
  const φ1 = deg2rad(lat1);
  const λ1 = deg2rad(lon1);
  const φ2 = deg2rad(lat2);
  const λ2 = deg2rad(lon2);

  // Angular distance between points (central angle)
  const dφ = φ2 - φ1;
  const dλ = λ2 - λ1;
  const a =
    Math.sin(dφ / 2) * Math.sin(dφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(dλ / 2) * Math.sin(dλ / 2);
  const δ = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  // Guard: if points are essentially the same, return start
  if (δ < 1e-12) return [lat1, lon1];

  const A = Math.sin((1 - fraction) * δ) / Math.sin(δ);
  const B = Math.sin(fraction * δ) / Math.sin(δ);

  const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
  const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
  const z = A * Math.sin(φ1) + B * Math.sin(φ2);

  const φ = Math.atan2(z, Math.sqrt(x * x + y * y));
  const λ = Math.atan2(y, x);

  return [rad2deg(φ), rad2deg(λ)];
}

// Generates an array of [lat, lon] points along the great-circle arc
// for rendering as a polyline. numPoints controls curve resolution.
export function geodesicArc(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
  numPoints: number = 100
): [number, number][] {
  const points: [number, number][] = [];
  for (let i = 0; i <= numPoints; i++) {
    points.push(interpolatePosition(lat1, lon1, lat2, lon2, i / numPoints));
  }
  return points;
}
