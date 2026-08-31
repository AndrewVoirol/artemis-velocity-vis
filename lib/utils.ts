/**
 * Artemis Velocity Vis - Mathematical Engine & Geodesic Systems
 * 
 * Includes:
 * - Spherical Haversine distance and 3D Slerp geodesic arc interpolation (WGS84 spherical approximation R = 3958.8 mi).
 * - Forward & inverse Web Mercator (EPSG:3857) projection and planar linear chord interpolation.
 * - Closed-form Rhumb line distance integration and cartographic distortion metrics (delta miles, % distortion, midpoint separation).
 * - Kinematic telemetry modeling: dynamic Mach computation (M = v / 767.26 mph), flight regimes, and continuous scrub kinematics.
 * - Parametric altitude profiles (Catmull-Rom spline skip entry, parabolic boost-glide, circular LEO passes).
 * - 4 Curated Mission Presets & 3 High-Contrast Themes Configuration.
 */

export const EARTH_RADIUS_MILES = 3958.8;
export const EARTH_RADIUS_KM = 6371.0;
export const SPEED_OF_SOUND_MPH = 767.26;
export const MAX_MERCATOR_LATITUDE = 85.0511287798;

export type LatLngTuple = [number, number];

export type FlightRegime = 'Subsonic' | 'Supersonic' | 'Hypersonic' | 'Orbital / Re-entry';

export type MissionPresetId = 'lunar-return' | 'trans-eurasian' | 'trans-continental' | 'equatorial-ring';

export type ThemeId = 'e-ink' | 'nasa-dark' | 'satellite';

export interface MissionPreset {
  id: MissionPresetId;
  name: string;
  subtitle: string;
  origin: {
    name: string;
    coords: LatLngTuple;
    type: string;
  };
  destination: {
    name: string;
    coords: LatLngTuple;
    type: string;
  };
  defaultVelocityMph: number;
  description: string;
  orbitalContext: string;
  altitudeProfile: (progress: number) => { altitudeFt: number; altitudeMi: number; phase: string };
}

export interface DistortionStats {
  geodesicDistMiles: number;
  mercatorDistMiles: number;
  deltaMiles: number;
  percentageDistortion: number;
  geodesicMidpoint: LatLngTuple;
  mercatorMidpoint: LatLngTuple;
  midpointSeparationMiles: number;
}

export interface TelemetryState {
  progress: number;
  progressPercent: string;
  currentPos: LatLngTuple;
  latitudeStr: string;
  longitudeStr: string;
  headingDeg: number;
  headingStr: string;
  altitudeFt: number;
  altitudeMi: number;
  velocityMph: number;
  velocityMps: number;
  velocityKms: number;
  velocityKnots: number;
  mach: number;
  machStr: string;
  regime: FlightRegime;
  currentDistMiles: number;
  remainingDistMiles: number;
  totalDistMiles: number;
  elapsedTimeSec: number;
  etaSec: number;
  totalTimeSec: number;
  flightPhase: string;
}

export type TelemetryData = TelemetryState;

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  description: string;
  bgPage: string;
  bgSidebar: string;
  bgPanel: string;
  borderColor: string;
  textMain: string;
  textMuted: string;
  accentPrimary: string;
  accentSecondary: string;
  badgeBg: string;
  badgeText: string;
  mapBg: string;
  tileUrl: string;
  tileAttribution: string;
  tileFilter: string;
  arcColor: string;
  arcWeight: number;
  arcDashArray?: string;
  chordColor: string;
  chordWeight: number;
  chordDashArray?: string;
  markerColor: string;
  pingColor: string;
}

export function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

export function rad2deg(rad: number): number {
  return rad * (180 / Math.PI);
}

/**
 * Calculates central angular separation (radians) between two points on S^2 using Haversine formula
 */
export function calculateCentralAngle(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const phi1 = deg2rad(lat1);
  const phi2 = deg2rad(lat2);
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(phi1) * Math.cos(phi2) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  return 2 * Math.atan2(Math.sqrt(Math.max(0, Math.min(1, a))), Math.sqrt(Math.max(0, 1 - a)));
}

/**
 * Calculates great-circle Haversine distance in statute miles
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return EARTH_RADIUS_MILES * calculateCentralAngle(lat1, lon1, lat2, lon2);
}

/**
 * Calculates great-circle Haversine distance in kilometers
 */
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return EARTH_RADIUS_KM * calculateCentralAngle(lat1, lon1, lat2, lon2);
}

/**
 * Calculates initial true course bearing (0° to 360°) from point 1 to point 2
 */
export function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const phi1 = deg2rad(lat1);
  const phi2 = deg2rad(lat2);
  const dLon = deg2rad(lon2 - lon1);

  const y = Math.sin(dLon) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon);
  const bearingRad = Math.atan2(y, x);
  const bearingDeg = (rad2deg(bearingRad) + 360) % 360;

  return bearingDeg;
}

/**
 * Formats a compass heading with 16-point cardinal compass rose
 */
export function calculateHeadingCompass(bearingDeg: number): string {
  const normalized = (bearingDeg % 360 + 360) % 360;
  const compassRose = [
    'N', 'NNE', 'NE', 'ENE',
    'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW',
    'W', 'WNW', 'NW', 'NNW'
  ];
  const index = Math.round(normalized / 22.5) % 16;
  const formattedDeg = Math.round(normalized).toString().padStart(3, '0');
  return `${formattedDeg}° ${compassRose[index]}`;
}

/**
 * Interpolates along the great-circle arc via 3D Spherical Linear Interpolation (Slerp)
 * fraction: 0.0 = start, 1.0 = end
 */
export function interpolatePosition(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
  fraction: number
): LatLngTuple {
  const f = Math.max(0, Math.min(1, fraction));
  if (f === 0) return [lat1, lon1];
  if (f === 1) return [lat2, lon2];

  const phi1 = deg2rad(lat1);
  const lam1 = deg2rad(lon1);
  const phi2 = deg2rad(lat2);
  const lam2 = deg2rad(lon2);

  const delta = calculateCentralAngle(lat1, lon1, lat2, lon2);
  if (delta < 1e-12) return [lat1, lon1];

  const sinDelta = Math.sin(delta);
  const A = Math.sin((1 - f) * delta) / sinDelta;
  const B = Math.sin(f * delta) / sinDelta;

  const x = A * Math.cos(phi1) * Math.cos(lam1) + B * Math.cos(phi2) * Math.cos(lam2);
  const y = A * Math.cos(phi1) * Math.sin(lam1) + B * Math.cos(phi2) * Math.sin(lam2);
  const z = A * Math.sin(phi1) + B * Math.sin(phi2);

  const phi = Math.atan2(z, Math.sqrt(x * x + y * y));
  const lam = Math.atan2(y, x);

  return [rad2deg(phi), rad2deg(lam)];
}

/**
 * Generates polyline vertices along the true great-circle geodesic arc (101 points default)
 */
export function geodesicArc(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
  numPoints: number = 100
): LatLngTuple[] {
  const points: LatLngTuple[] = [];
  for (let i = 0; i <= numPoints; i++) {
    points.push(interpolatePosition(lat1, lon1, lat2, lon2, i / numPoints));
  }
  return points;
}

/**
 * Forward Web Mercator (EPSG:3857) projection
 */
export function mercatorForward(latDeg: number, lonDeg: number): { x: number; y: number } {
  const clampedLat = Math.max(-MAX_MERCATOR_LATITUDE, Math.min(MAX_MERCATOR_LATITUDE, latDeg));
  const phi = deg2rad(clampedLat);
  const lam = deg2rad(lonDeg);
  return {
    x: lam,
    y: Math.log(Math.tan(Math.PI / 4 + phi / 2))
  };
}

/**
 * Inverse Web Mercator (EPSG:3857) projection
 */
export function mercatorInverse(x: number, y: number): LatLngTuple {
  const lam = x;
  const phi = 2 * Math.atan(Math.exp(y)) - Math.PI / 2;
  return [rad2deg(phi), rad2deg(lam)];
}

/**
 * Interpolates along the direct flat linear chord in Mercator projection space
 */
export function interpolateMercatorPosition(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
  fraction: number
): LatLngTuple {
  const f = Math.max(0, Math.min(1, fraction));
  if (f === 0) return [lat1, lon1];
  if (f === 1) return [lat2, lon2];

  const p1 = mercatorForward(lat1, lon1);
  const p2 = mercatorForward(lat2, lon2);

  // Handle anti-meridian wrapping if needed for shortest planar path
  let dx = p2.x - p1.x;
  if (dx > Math.PI) dx -= 2 * Math.PI;
  if (dx < -Math.PI) dx += 2 * Math.PI;

  const x = p1.x + f * dx;
  const y = (1 - f) * p1.y + f * p2.y;

  return mercatorInverse(x, y);
}

/**
 * Generates polyline vertices along the flat Mercator linear chord
 */
export function mercatorLinearChord(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
  numPoints: number = 100
): LatLngTuple[] {
  const points: LatLngTuple[] = [];
  for (let i = 0; i <= numPoints; i++) {
    points.push(interpolateMercatorPosition(lat1, lon1, lat2, lon2, i / numPoints));
  }
  return points;
}

/**
 * Computes exact analytical Rhumb line (loxodrome) surface distance in miles
 */
export function calculateRhumbDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const phi1 = deg2rad(lat1);
  const lam1 = deg2rad(lon1);
  const phi2 = deg2rad(lat2);
  const lam2 = deg2rad(lon2);
  const dphi = phi2 - phi1;
  let dlam = lam2 - lam1;

  if (Math.abs(dlam) > Math.PI) {
    dlam = dlam > 0 ? -(2 * Math.PI - dlam) : (2 * Math.PI + dlam);
  }

  const y1 = Math.log(Math.tan(Math.PI / 4 + phi1 / 2));
  const y2 = Math.log(Math.tan(Math.PI / 4 + phi2 / 2));
  const dy = y2 - y1;

  if (Math.abs(dphi) < 1e-12) {
    return EARTH_RADIUS_MILES * Math.cos(phi1) * Math.abs(dlam);
  }
  const q = Math.abs(dy) > 1e-12 ? dphi / dy : Math.cos(phi1);
  return EARTH_RADIUS_MILES * Math.sqrt(dphi * dphi + q * q * dlam * dlam);
}

/**
 * Computes complete distortion metrics comparing Geodesic Arc vs Mercator Linear Chord
 */
export function calculateDistortionStats(lat1: number, lon1: number, lat2: number, lon2: number): DistortionStats {
  const geodesicDist = calculateDistance(lat1, lon1, lat2, lon2);
  const mercatorDist = calculateRhumbDistance(lat1, lon1, lat2, lon2);
  const deltaMiles = mercatorDist - geodesicDist;
  const percentageDistortion = geodesicDist > 0 ? (deltaMiles / geodesicDist) * 100 : 0;

  const geoMid = interpolatePosition(lat1, lon1, lat2, lon2, 0.5);
  const mercMid = interpolateMercatorPosition(lat1, lon1, lat2, lon2, 0.5);
  const midpointSeparationMiles = calculateDistance(geoMid[0], geoMid[1], mercMid[0], mercMid[1]);

  return {
    geodesicDistMiles: geodesicDist,
    mercatorDistMiles: mercatorDist,
    deltaMiles: deltaMiles,
    percentageDistortion: percentageDistortion,
    geodesicMidpoint: geoMid,
    mercatorMidpoint: mercMid,
    midpointSeparationMiles: midpointSeparationMiles
  };
}

/**
 * Computes Mach number: Mach = v / 767.26 mph
 */
export function calculateMach(velocityMph: number): number {
  return velocityMph / SPEED_OF_SOUND_MPH;
}

/**
 * Classifies flight velocity into canonical aerospace regimes
 */
export function getFlightRegime(velocityMph: number): FlightRegime {
  if (velocityMph < SPEED_OF_SOUND_MPH) return 'Subsonic';
  if (velocityMph < 3836) return 'Supersonic';
  if (velocityMph < 17500) return 'Hypersonic';
  return 'Orbital / Re-entry';
}

const SKIP_ENTRY_SPLINE: [number, number, string][] = [
  [0.00, 400000, 'Atmospheric Entry Interface (EI-400k)'],
  [0.25, 210000, 'Initial Aerodynamic Dip & Deceleration'],
  [0.50, 290000, 'Hypersonic Skip Loft Peak'],
  [0.75, 140000, 'Secondary Atmospheric Descent'],
  [0.90, 45000, 'Forward Heat Shield Jettison'],
  [0.96, 12000, 'Main Parachute Deployment'],
  [1.00, 0, 'Pacific Splashdown & Recovery']
];

function evaluateCatmullRom(p: number, controlPoints: [number, number, string][]): { altitudeFt: number; phase: string } {
  if (p <= controlPoints[0][0]) {
    return { altitudeFt: controlPoints[0][1], phase: controlPoints[0][2] };
  }
  if (p >= controlPoints[controlPoints.length - 1][0]) {
    const last = controlPoints[controlPoints.length - 1];
    return { altitudeFt: last[1], phase: last[2] };
  }

  let i = 0;
  while (i < controlPoints.length - 1 && controlPoints[i + 1][0] < p) i++;

  const y0 = controlPoints[Math.max(0, i - 1)][1];
  const [t1, y1] = [controlPoints[i][0], controlPoints[i][1]];
  const [t2, y2] = [controlPoints[i + 1][0], controlPoints[i + 1][1]];
  const y3 = controlPoints[Math.min(controlPoints.length - 1, i + 2)][1];

  const u = (p - t1) / (t2 - t1);
  const u2 = u * u;
  const u3 = u2 * u;

  const c0 = -0.5 * u3 + u2 - 0.5 * u;
  const c1 = 1.5 * u3 - 2.5 * u2 + 1.0;
  const c2 = -1.5 * u3 + 2.0 * u2 + 0.5 * u;
  const c3 = 0.5 * u3 - 0.5 * u2;

  const altitudeFt = Math.max(0, Math.round(c0 * y0 + c1 * y1 + c2 * y2 + c3 * y3));
  const phase = u < 0.5 ? controlPoints[i][2] : controlPoints[i + 1][2];

  return { altitudeFt, phase };
}

/**
 * Computes altitude profile and flight phase for any preset and progress
 */
export function calculateAltitude(
  presetIdOrName: string,
  progress: number
): { altitudeFt: number; altitudeMi: number; phase: string } {
  const p = Math.max(0, Math.min(1, progress));

  if (presetIdOrName === 'lunar-return' || presetIdOrName === 'Trans-Lunar Return & Skip Entry') {
    const { altitudeFt, phase } = evaluateCatmullRom(p, SKIP_ENTRY_SPLINE);
    return { altitudeFt, altitudeMi: +(altitudeFt / 5280).toFixed(2), phase };
  }

  if (presetIdOrName === 'trans-continental' || presetIdOrName === 'Trans-Continental Sprint') {
    const altitudeFt = Math.round(180000 * Math.sin(Math.PI * p));
    let phase = 'Ascent Boost Phase';
    if (p > 0.4 && p < 0.6) phase = 'Suborbital Apogee (34 mi)';
    else if (p >= 0.6 && p < 0.95) phase = 'Hypersonic Glide Deceleration';
    else if (p >= 0.95) phase = 'Terminal Runway Approach';
    return { altitudeFt, altitudeMi: +(altitudeFt / 5280).toFixed(2), phase };
  }

  if (presetIdOrName === 'trans-eurasian' || presetIdOrName === 'Trans-Eurasian Orbit Pass') {
    const altitudeFt = Math.round(1320000 + 10560 * Math.sin(Math.PI * p));
    let phase = 'North Sea Orbital Ascent';
    if (p > 0.3 && p < 0.7) phase = 'Arctic Sub-Polar Orbital Node';
    else if (p >= 0.7) phase = 'Far East Orbital Descent';
    return { altitudeFt, altitudeMi: +(altitudeFt / 5280).toFixed(2), phase };
  }

  if (presetIdOrName === 'equatorial-ring' || presetIdOrName === 'Equatorial Geodesic Ring') {
    const altitudeFt = Math.round(1161600 + 5280 * Math.sin(2 * Math.PI * p));
    let phase = 'Indian Ocean Orbital Track';
    if (p > 0.4 && p < 0.8) phase = 'Pacific Basin Orbital Sweep';
    else if (p >= 0.8) phase = 'Galapagos Horizon Acquisition';
    return { altitudeFt, altitudeMi: +(altitudeFt / 5280).toFixed(2), phase };
  }

  const altitudeFt = Math.round(250000 * (1 - p));
  return { altitudeFt, altitudeMi: +(altitudeFt / 5280).toFixed(2), phase: 'Orbital Cruise' };
}

/**
 * 4 Curated Mission Presets
 */
export const MISSION_PRESETS: Record<MissionPresetId, MissionPreset> = {
  'lunar-return': {
    id: 'lunar-return',
    name: 'Trans-Lunar Return & Skip Entry',
    subtitle: 'Pacific Re-entry Corridor -> San Diego Splashdown',
    origin: {
      name: 'Pacific Entry Interface (EI-400k)',
      coords: [12.0, -170.0],
      type: 'Atmospheric Interface'
    },
    destination: {
      name: 'San Diego Recovery Zone',
      coords: [32.7157, -117.1611],
      type: 'Naval Splashdown Site'
    },
    defaultVelocityMph: 24500,
    description: 'High-energy lunar return corridor dissipating 24,500 mph re-entry energy via an atmospheric skip manoeuvre.',
    orbitalContext: 'Artemis II Orion Command Module splashdown trajectory executing aerocapture skip entry.',
    altitudeProfile: (p: number) => calculateAltitude('lunar-return', p)
  },
  'trans-eurasian': {
    id: 'trans-eurasian',
    name: 'Trans-Eurasian Orbit Pass',
    subtitle: 'London -> Tokyo Sub-Polar Sweep',
    origin: {
      name: 'Greenwich Prime Meridian (London)',
      coords: [51.5074, -0.1278],
      type: 'Orbital Pass Origin'
    },
    destination: {
      name: 'Tokyo Haneda Downlink',
      coords: [35.6762, 139.6503],
      type: 'Ground Telemetry Station'
    },
    defaultVelocityMph: 24500,
    description: 'Sub-polar orbital pass traversing Scandinavia, Novaya Zemlya, and Siberia with +18.15% Mercator projection distortion.',
    orbitalContext: 'High-latitude orbital trajectory illustrating dramatic difference between great-circle polar routes and planar chords.',
    altitudeProfile: (p: number) => calculateAltitude('trans-eurasian', p)
  },
  'trans-continental': {
    id: 'trans-continental',
    name: 'Trans-Continental Sprint',
    subtitle: 'Cape Canaveral -> Edwards AFB',
    origin: {
      name: 'Kennedy Space Center LC-39B',
      coords: [28.5729, -80.6490],
      type: 'Spaceport Launch Site'
    },
    destination: {
      name: 'Edwards AFB Runway 22',
      coords: [34.9055, -117.8837],
      type: 'Dry Lake Bed Landing'
    },
    defaultVelocityMph: 17500,
    description: 'Hypersonic cross-country boost-glide dash traversing Florida, Texas, and the Mojave Desert in 7.5 minutes.',
    orbitalContext: 'Low Earth Orbit (LEO) insertion velocity sprint along historic shuttle ascent corridor.',
    altitudeProfile: (p: number) => calculateAltitude('trans-continental', p)
  },
  'equatorial-ring': {
    id: 'equatorial-ring',
    name: 'Equatorial Geodesic Ring',
    subtitle: 'Kilimanjaro -> Galapagos Global Sweep',
    origin: {
      name: 'Kilimanjaro Summit Node',
      coords: [-3.0674, 37.3556],
      type: 'Equatorial Launch Node'
    },
    destination: {
      name: 'Galapagos Marine Downlink',
      coords: [-0.7432, -90.3110],
      type: 'Equatorial Downlink'
    },
    defaultVelocityMph: 25000,
    description: 'Equatorial orbital sweep across East Africa, the Indian Ocean, and the Pacific where spherical geodesic and Mercator chord converge.',
    orbitalContext: 'Zero-inclination equatorial orbit demonstrating minimal cartographic distortion near the equator.',
    altitudeProfile: (p: number) => calculateAltitude('equatorial-ring', p)
  }
};

export const MISSION_PRESETS_LIST: MissionPreset[] = Object.values(MISSION_PRESETS);

/**
 * 3 High-Contrast Themes Configuration
 */
export const THEMES: Record<ThemeId, ThemeConfig> = {
  'e-ink': {
    id: 'e-ink',
    name: 'E-Ink Terminal',
    description: 'High-contrast monochrome electronic paper HUD with crisp ink borders and grayscale cartography.',
    bgPage: '#ffffff',
    bgSidebar: '#ffffff',
    bgPanel: '#ffffff',
    borderColor: '#000000',
    textMain: '#000000',
    textMuted: '#52525b',
    accentPrimary: '#000000',
    accentSecondary: '#71717a',
    badgeBg: '#000000',
    badgeText: '#ffffff',
    mapBg: '#f4f4f5',
    tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    tileAttribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    tileFilter: 'grayscale(100%) contrast(140%) brightness(102%)',
    arcColor: '#000000',
    arcWeight: 3.5,
    arcDashArray: '6, 6',
    chordColor: '#71717a',
    chordWeight: 2,
    chordDashArray: '2, 6',
    markerColor: '#000000',
    pingColor: 'rgba(0, 0, 0, 0.4)'
  },
  'nasa-dark': {
    id: 'nasa-dark',
    name: 'NASA Mission Control Dark',
    description: 'Obsidian deep space flight deck with radar cyan HUD, amber warning telemetry, and CartoDB Dark Matter tiles.',
    bgPage: '#030712',
    bgSidebar: '#070b14',
    bgPanel: '#0f172a',
    borderColor: '#1e293b',
    textMain: '#f8fafc',
    textMuted: '#94a3b8',
    accentPrimary: '#00f0ff',
    accentSecondary: '#fbbf24',
    badgeBg: 'rgba(0, 240, 255, 0.15)',
    badgeText: '#00f0ff',
    mapBg: '#030712',
    tileUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    tileAttribution: '&copy; <a href="https://www.esri.com/">Esri</a>, HERE, Garmin, &copy; OpenStreetMap contributors',
    tileFilter: 'brightness(95%) contrast(110%)',
    arcColor: '#00f0ff',
    arcWeight: 3.5,
    chordColor: '#f59e0b',
    chordWeight: 2.5,
    chordDashArray: '6, 6',
    markerColor: '#00f0ff',
    pingColor: 'rgba(0, 240, 255, 0.6)'
  },
  'satellite': {
    id: 'satellite',
    name: 'Satellite Telemetry Mode',
    description: 'Tactical orbital reconnaissance imagery with high-visibility gold geodesic vectors and coral Mercator chord lines.',
    bgPage: '#090d16',
    bgSidebar: '#0d131f',
    bgPanel: '#161f30',
    borderColor: '#24324a',
    textMain: '#f1f5f9',
    textMuted: '#94a3b8',
    accentPrimary: '#facc15',
    accentSecondary: '#f43f5e',
    badgeBg: 'rgba(250, 204, 21, 0.15)',
    badgeText: '#facc15',
    mapBg: '#090d16',
    tileUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    tileAttribution: '&copy; <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics',
    tileFilter: 'contrast(108%) brightness(96%)',
    arcColor: '#facc15',
    arcWeight: 3.5,
    chordColor: '#f43f5e',
    chordWeight: 2.5,
    chordDashArray: '6, 6',
    markerColor: '#84cc16',
    pingColor: 'rgba(132, 204, 22, 0.6)'
  }
};

/**
 * Computes full telemetry state snapshot
 */
export function computeTelemetry(
  preset: MissionPreset,
  progress: number,
  velocityMph: number
): TelemetryState {
  const p = Math.max(0, Math.min(1, progress));
  const totalDistMiles = calculateDistance(
    preset.origin.coords[0], preset.origin.coords[1],
    preset.destination.coords[0], preset.destination.coords[1]
  );
  const velocityMps = velocityMph / 3600;
  const velocityKms = velocityMph * 0.00044704;
  const velocityKnots = velocityMph * 0.868976;
  const totalTimeSec = velocityMps > 0 ? totalDistMiles / velocityMps : 0;
  const elapsedTimeSec = p * totalTimeSec;
  const etaSec = Math.max(0, totalTimeSec - elapsedTimeSec);
  const currentDistMiles = p * totalDistMiles;
  const remainingDistMiles = Math.max(0, totalDistMiles - currentDistMiles);

  const currentPos = interpolatePosition(
    preset.origin.coords[0], preset.origin.coords[1],
    preset.destination.coords[0], preset.destination.coords[1],
    p
  );

  // Compute instantaneous heading along geodesic
  const lookAheadProgress = Math.min(1, p + 0.005);
  const nextPos = interpolatePosition(
    preset.origin.coords[0], preset.origin.coords[1],
    preset.destination.coords[0], preset.destination.coords[1],
    lookAheadProgress
  );
  const headingDeg = calculateBearing(currentPos[0], currentPos[1], nextPos[0], nextPos[1]);
  const headingStr = calculateHeadingCompass(headingDeg);

  const mach = calculateMach(velocityMph);
  const regime = getFlightRegime(velocityMph);
  const { altitudeFt, altitudeMi, phase: flightPhase } = preset.altitudeProfile(p);
  const { latStr: latitudeStr, lonStr: longitudeStr } = formatCoordinates(currentPos[0], currentPos[1]);

  return {
    progress: p,
    progressPercent: `${(p * 100).toFixed(1)}%`,
    currentPos,
    latitudeStr,
    longitudeStr,
    headingDeg,
    headingStr,
    altitudeFt,
    altitudeMi,
    velocityMph,
    velocityMps,
    velocityKms,
    velocityKnots,
    mach,
    machStr: `M${mach.toFixed(2)}`,
    regime,
    currentDistMiles,
    remainingDistMiles,
    totalDistMiles,
    elapsedTimeSec,
    etaSec,
    totalTimeSec,
    flightPhase
  };
}

/**
 * Utility Formatters
 */
export function formatCoordinates(lat: number, lon: number): { latStr: string; lonStr: string; combined: string } {
  const latAbs = Math.abs(lat).toFixed(4);
  const lonAbs = Math.abs(lon).toFixed(4);
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';
  const latStr = `${latAbs}° ${latDir}`;
  const lonStr = `${lonAbs}° ${lonDir}`;
  return {
    latStr,
    lonStr,
    combined: `${latStr}, ${lonStr}`
  };
}

export function formatMach(velocityMph: number): string {
  const mach = calculateMach(velocityMph);
  return `Mach ${mach.toFixed(2)}`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins < 60) {
    return `${mins}m ${secs}s`;
  }
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hours}h ${remMins}m ${secs}s`;
}

export function formatDistance(miles: number): string {
  return `${Math.round(miles).toLocaleString('en-US')} mi`;
}

export function formatAltitude(altitudeFt: number): string {
  if (altitudeFt >= 52800) {
    const mi = (altitudeFt / 5280).toFixed(1);
    return `${mi} mi (${altitudeFt.toLocaleString('en-US')} ft)`;
  }
  return `${altitudeFt.toLocaleString('en-US')} ft`;
}
