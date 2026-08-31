/**
 * Empirical Verification & Stress Test Suite for Milestone 1
 * Mathematical correctness, coordinate singularities, Mach regimes, distortion metrics, and parametric sweeps.
 */

import {
  EARTH_RADIUS_MILES,
  EARTH_RADIUS_KM,
  SPEED_OF_SOUND_MPH,
  MAX_MERCATOR_LATITUDE,
  deg2rad,
  rad2deg,
  calculateCentralAngle,
  calculateDistance,
  calculateDistanceKm,
  calculateBearing,
  calculateHeadingCompass,
  interpolatePosition,
  geodesicArc,
  mercatorForward,
  mercatorInverse,
  interpolateMercatorPosition,
  mercatorLinearChord,
  calculateRhumbDistance,
  calculateDistortionStats,
  calculateMach,
  getFlightRegime,
  calculateAltitude,
  computeTelemetry,
  formatCoordinates,
  formatMach,
  formatDuration,
  formatDistance,
  formatAltitude,
  MISSION_PRESETS,
  MISSION_PRESETS_LIST,
  THEMES,
  LatLngTuple
} from '../lib/utils';

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  details: string;
  metrics?: Record<string, any>;
}

const results: TestResult[] = [];

function assert(condition: boolean, suite: string, name: string, details: string, metrics?: Record<string, any>) {
  results.push({
    suite,
    name,
    passed: !!condition,
    details: condition ? `PASSED: ${details}` : `FAILED: ${details}`,
    metrics
  });
}

// -------------------------------------------------------------
// SUITE 1: Numerical Accuracy of Spherical & Cartographic Engine
// -------------------------------------------------------------
console.log('Running Suite 1: Numerical Accuracy & Oracles...');

// 1.1 Haversine Distance against independent high-precision oracle
function oracleHaversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const phi1 = lat1 * (Math.PI / 180);
  const phi2 = lat2 * (Math.PI / 180);
  const dphi = (lat2 - lat1) * (Math.PI / 180);
  const dlam = (lon2 - lon1) * (Math.PI / 180);

  const a = Math.sin(dphi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlam / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 3958.8 * c;
}

const pairs: { name: string; p1: LatLngTuple; p2: LatLngTuple }[] = [
  { name: 'London to Tokyo', p1: [51.5074, -0.1278], p2: [35.6762, 139.6503] },
  { name: 'Cape Canaveral to Edwards AFB', p1: [28.5729, -80.6490], p2: [34.9055, -117.8837] },
  { name: 'Kilimanjaro to Galapagos', p1: [-3.0674, 37.3556], p2: [-0.7432, -90.3110] },
  { name: 'Pacific EI to San Diego', p1: [12.0, -170.0], p2: [32.7157, -117.1611] },
  { name: 'Equator Quarter-Turn (0,0)->(0,90)', p1: [0, 0], p2: [0, 90] },
  { name: 'North Pole to Equator (90,0)->(0,0)', p1: [90, 0], p2: [0, 0] },
  { name: 'North Pole to South Pole (90,0)->(-90,0)', p1: [90, 0], p2: [-90, 0] },
];

for (const pair of pairs) {
  const actual = calculateDistance(pair.p1[0], pair.p1[1], pair.p2[0], pair.p2[1]);
  const oracle = oracleHaversineMiles(pair.p1[0], pair.p1[1], pair.p2[0], pair.p2[1]);
  const delta = Math.abs(actual - oracle);
  assert(
    delta < 1e-6,
    'Numerical Accuracy',
    `Haversine Distance: ${pair.name}`,
    `Calculated: ${actual.toFixed(4)} mi, Oracle: ${oracle.toFixed(4)} mi, Delta: ${delta.toExponential(4)}`,
    { actual, oracle, delta }
  );
}

// 1.2 Haversine km conversion check
const ldnTkyKm = calculateDistanceKm(51.5074, -0.1278, 35.6762, 139.6503);
const expectedKm = (5939.48 / 3958.8) * 6371.0;
assert(
  Math.abs(ldnTkyKm - expectedKm) < 0.1,
  'Numerical Accuracy',
  'Distance in Kilometers',
  `London->Tokyo: ${ldnTkyKm.toFixed(2)} km vs expected ${expectedKm.toFixed(2)} km`,
  { ldnTkyKm, expectedKm }
);

// 1.3 Slerp Interpolation Properties (Constant Angular Velocity & Midpoint)
for (const pair of pairs.slice(0, 4)) {
  const totalAngle = calculateCentralAngle(pair.p1[0], pair.p1[1], pair.p2[0], pair.p2[1]);
  const mid = interpolatePosition(pair.p1[0], pair.p1[1], pair.p2[0], pair.p2[1], 0.5);
  const angle1 = calculateCentralAngle(pair.p1[0], pair.p1[1], mid[0], mid[1]);
  const angle2 = calculateCentralAngle(mid[0], mid[1], pair.p2[0], pair.p2[1]);

  const midDiff = Math.abs(angle1 - totalAngle / 2) + Math.abs(angle2 - totalAngle / 2);
  assert(
    midDiff < 1e-7,
    'Numerical Accuracy',
    `Slerp Midpoint Equidistance: ${pair.name}`,
    `Total angle: ${totalAngle.toFixed(6)} rad, Mid1: ${angle1.toFixed(6)}, Mid2: ${angle2.toFixed(6)}, Diff: ${midDiff.toExponential(4)}`,
    { totalAngle, angle1, angle2, midDiff }
  );

  for (const f of [0.1, 0.25, 0.75, 0.9]) {
    const pt = interpolatePosition(pair.p1[0], pair.p1[1], pair.p2[0], pair.p2[1], f);
    const subAngle = calculateCentralAngle(pair.p1[0], pair.p1[1], pt[0], pt[1]);
    const expectedSubAngle = f * totalAngle;
    assert(
      Math.abs(subAngle - expectedSubAngle) < 1e-6,
      'Numerical Accuracy',
      `Slerp Angular Linearity @ f=${f}: ${pair.name}`,
      `Sub-angle: ${subAngle.toFixed(6)} rad vs expected ${expectedSubAngle.toFixed(6)} rad`
    );
  }
}

// 1.4 Geodesic Arc Monotonicity & Count
const arc = geodesicArc(51.5074, -0.1278, 35.6762, 139.6503, 100);
assert(arc.length === 101, 'Numerical Accuracy', 'Geodesic Arc Point Count', `Expected 101 vertices, got ${arc.length}`);
assert(
  Math.abs(arc[0][0] - 51.5074) < 1e-4 && Math.abs(arc[0][1] - (-0.1278)) < 1e-4,
  'Numerical Accuracy',
  'Geodesic Arc Start Point',
  `Start matches origin: [${arc[0]}]`
);
assert(
  Math.abs(arc[100][0] - 35.6762) < 1e-4 && Math.abs(arc[100][1] - 139.6503) < 1e-4,
  'Numerical Accuracy',
  'Geodesic Arc End Point',
  `End matches destination: [${arc[100]}]`
);

// 1.5 Web Mercator Forward & Inverse Round-Trip
let maxRoundTripError = 0;
for (let lat = -80; lat <= 80; lat += 10) {
  for (let lon = -180; lon <= 180; lon += 20) {
    const fwd = mercatorForward(lat, lon);
    const inv = mercatorInverse(fwd.x, fwd.y);
    const errLat = Math.abs(inv[0] - lat);
    const errLon = Math.abs(inv[1] - lon);
    const totalErr = errLat + errLon;
    if (totalErr > maxRoundTripError) maxRoundTripError = totalErr;
  }
}
assert(
  maxRoundTripError < 1e-10,
  'Numerical Accuracy',
  'Web Mercator Forward/Inverse Invertibility',
  `Grid sweep [-80..80, -180..180] max round-trip delta = ${maxRoundTripError.toExponential(4)} deg`,
  { maxRoundTripError }
);

// 1.6 Analytical Rhumb Line Surface Integration
const parallelDist = calculateRhumbDistance(45, 0, 45, 90);
const expectedParallel = 3958.8 * Math.cos(45 * Math.PI / 180) * (90 * Math.PI / 180);
assert(
  Math.abs(parallelDist - expectedParallel) < 1e-4,
  'Numerical Accuracy',
  'Rhumb Line Parallel Sailing (45° N, 0° to 90° E)',
  `Calculated: ${parallelDist.toFixed(4)} mi, Expected: ${expectedParallel.toFixed(4)} mi, Delta: ${Math.abs(parallelDist - expectedParallel).toExponential(4)}`
);

const meridianDist = calculateRhumbDistance(10, 40, 60, 40);
const expectedMeridian = 3958.8 * (50 * Math.PI / 180);
assert(
  Math.abs(meridianDist - expectedMeridian) < 1e-4,
  'Numerical Accuracy',
  'Rhumb Line Meridian Sailing (10° N to 60° N on 40° E)',
  `Calculated: ${meridianDist.toFixed(4)} mi, Expected: ${expectedMeridian.toFixed(4)} mi, Delta: ${Math.abs(meridianDist - expectedMeridian).toExponential(4)}`
);

// -------------------------------------------------------------
// SUITE 2: Extreme Coordinates & Singularity Stress Testing
// -------------------------------------------------------------
console.log('Running Suite 2: Extreme Coordinates & Singularities...');

// 2.1 Identical Points (Zero-Distance)
const zeroDist = calculateDistance(51.5074, -0.1278, 51.5074, -0.1278);
assert(zeroDist === 0, 'Singularity Stress', 'Identical Coordinates Distance', `Distance is exactly 0: ${zeroDist}`);
const zeroInterp = interpolatePosition(51.5074, -0.1278, 51.5074, -0.1278, 0.5);
assert(
  Math.abs(zeroInterp[0] - 51.5074) < 1e-6 && Math.abs(zeroInterp[1] - (-0.1278)) < 1e-6,
  'Singularity Stress',
  'Identical Coordinates Slerp Interpolation',
  `Interpolation at zero distance yields identical point: [${zeroInterp}]`
);
const zeroRhumb = calculateRhumbDistance(51.5074, -0.1278, 51.5074, -0.1278);
assert(zeroRhumb === 0, 'Singularity Stress', 'Identical Coordinates Rhumb Distance', `Rhumb distance is 0: ${zeroRhumb}`);

// 2.2 Equator Crossings
const eqCrossInterp = interpolatePosition(-15, -30, 15, 30, 0.5);
assert(
  Math.abs(eqCrossInterp[0]) < 1e-5 && Math.abs(eqCrossInterp[1]) < 1e-5,
  'Singularity Stress',
  'Equator Crossing Midpoint',
  `Midpoint of (-15, -30) to (15, 30) is on Equator (0,0): [${eqCrossInterp[0].toFixed(6)}, ${eqCrossInterp[1].toFixed(6)}]`
);

// 2.3 Antimeridian Crossings (±180°)
const antiMeridianArc = geodesicArc(20, 175, 20, -175, 10);
assert(
  antiMeridianArc.length === 11 && !antiMeridianArc.some(p => Number.isNaN(p[0]) || Number.isNaN(p[1])),
  'Singularity Stress',
  'Antimeridian Arc Generation',
  `Generated 11 vertices without NaN across antimeridian.`
);
const antiMeridianMercChord = mercatorLinearChord(20, 175, 20, -175, 10);
assert(
  antiMeridianMercChord.length === 11 && !antiMeridianMercChord.some(p => Number.isNaN(p[0]) || Number.isNaN(p[1])),
  'Singularity Stress',
  'Antimeridian Mercator Linear Chord Generation',
  `Generated 11 vertices without NaN across antimeridian.`
);

// 2.4 Polar Boundary Clamping (±85.0511287798°)
const northPoleMerc = mercatorForward(89.99, 0);
assert(
  Math.abs(northPoleMerc.y - Math.log(Math.tan(Math.PI / 4 + deg2rad(MAX_MERCATOR_LATITUDE) / 2))) < 1e-6,
  'Singularity Stress',
  'Polar Clamping in Mercator Forward',
  `Latitude 89.99° clamped to MAX_MERCATOR_LATITUDE (${MAX_MERCATOR_LATITUDE}°)`
);
const southPoleMerc = mercatorForward(-89.99, 0);
assert(
  Math.abs(southPoleMerc.y + Math.log(Math.tan(Math.PI / 4 + deg2rad(MAX_MERCATOR_LATITUDE) / 2))) < 1e-6,
  'Singularity Stress',
  'South Polar Clamping in Mercator Forward',
  `Latitude -89.99° clamped to -MAX_MERCATOR_LATITUDE`
);

// 2.5 Antipodal Coordinates
const antipodalDist = calculateDistance(0, 0, 0, 180);
assert(
  Math.abs(antipodalDist - Math.PI * EARTH_RADIUS_MILES) < 1e-4,
  'Singularity Stress',
  'Antipodal Distance Exactness',
  `Distance is exactly pi * R: ${antipodalDist.toFixed(2)} mi`
);
const antipodalInterp = interpolatePosition(0, 0, 0, 180, 0.5);
assert(
  !Number.isNaN(antipodalInterp[0]) && !Number.isNaN(antipodalInterp[1]),
  'Singularity Stress',
  'Antipodal Slerp Interpolation Robustness',
  `Antipodal midpoint does not NaN: [${antipodalInterp}]`
);

// -------------------------------------------------------------
// SUITE 3: Aerospace Velocity Kinematics & Mach Regimes
// -------------------------------------------------------------
console.log('Running Suite 3: Aerospace Kinematics & Mach Regimes...');

const machChecks = [
  { v: 500, expectedMach: 500 / SPEED_OF_SOUND_MPH, expectedStr: 'M0.65', expectedRegime: 'Subsonic' },
  { v: 1500, expectedMach: 1500 / SPEED_OF_SOUND_MPH, expectedStr: 'M1.96', expectedRegime: 'Supersonic' },
  { v: 3835, expectedMach: 3835 / SPEED_OF_SOUND_MPH, expectedStr: 'M5.00', expectedRegime: 'Supersonic' },
  { v: 3836, expectedMach: 3836 / SPEED_OF_SOUND_MPH, expectedStr: 'M5.00', expectedRegime: 'Hypersonic' },
  { v: 10000, expectedMach: 10000 / SPEED_OF_SOUND_MPH, expectedStr: 'M13.03', expectedRegime: 'Hypersonic' },
  { v: 17500, expectedMach: 17500 / SPEED_OF_SOUND_MPH, expectedStr: 'M22.81', expectedRegime: 'Orbital / Re-entry' },
  { v: 24500, expectedMach: 24500 / SPEED_OF_SOUND_MPH, expectedStr: 'M31.93', expectedRegime: 'Orbital / Re-entry' },
  { v: 25000, expectedMach: 25000 / SPEED_OF_SOUND_MPH, expectedStr: 'M32.58', expectedRegime: 'Orbital / Re-entry' },
];

for (const check of machChecks) {
  const m = calculateMach(check.v);
  const regime = getFlightRegime(check.v);
  const mStr = `M${m.toFixed(2)}`;
  assert(
    Math.abs(m - check.expectedMach) < 1e-4 && regime === check.expectedRegime && mStr === check.expectedStr,
    'Kinematics & Regimes',
    `Velocity ${check.v} mph Classification`,
    `Mach: ${m.toFixed(4)} (${mStr}), Regime: ${regime} (Expected: ${check.expectedStr}, ${check.expectedRegime})`,
    { v: check.v, m, regime, mStr }
  );
}

// -------------------------------------------------------------
// SUITE 4: Preset Distortion Statistics
// -------------------------------------------------------------
console.log('Running Suite 4: Distortion Statistics Across Presets...');

// 4.1 London to Tokyo Sub-Polar Pass
const ldnTkyPreset = MISSION_PRESETS['trans-eurasian'];
const ldnTkyStats = calculateDistortionStats(
  ldnTkyPreset.origin.coords[0], ldnTkyPreset.origin.coords[1],
  ldnTkyPreset.destination.coords[0], ldnTkyPreset.destination.coords[1]
);
assert(
  Math.abs(ldnTkyStats.geodesicDistMiles - 5939.48) < 1.0,
  'Distortion Stats',
  'London->Tokyo Geodesic Distance',
  `Calculated: ${ldnTkyStats.geodesicDistMiles.toFixed(2)} mi, Expected: ~5939.48 mi`
);
assert(
  Math.abs(ldnTkyStats.mercatorDistMiles - 7017.57) < 1.0,
  'Distortion Stats',
  'London->Tokyo Mercator Rhumb Distance',
  `Calculated: ${ldnTkyStats.mercatorDistMiles.toFixed(2)} mi, Expected: ~7017.57 mi`
);
assert(
  Math.abs(ldnTkyStats.deltaMiles - 1078.09) < 1.0,
  'Distortion Stats',
  'London->Tokyo Delta Distance (+1078 mi)',
  `Calculated: +${ldnTkyStats.deltaMiles.toFixed(2)} mi, Expected: +1078.09 mi`
);
assert(
  Math.abs(ldnTkyStats.percentageDistortion - 18.15) < 0.05,
  'Distortion Stats',
  'London->Tokyo Percentage Distortion (+18.15%)',
  `Calculated: +${ldnTkyStats.percentageDistortion.toFixed(2)}%, Expected: +18.15%`
);
assert(
  Math.abs(ldnTkyStats.midpointSeparationMiles - 1857.57) < 5.0,
  'Distortion Stats',
  'London->Tokyo Midpoint Lateral Separation (~1858 mi)',
  `Calculated: ${ldnTkyStats.midpointSeparationMiles.toFixed(2)} mi, Expected: ~1857.57 mi`
);

// 4.2 Kilimanjaro to Galapagos Equatorial Ring (<0.1% distortion)
const eqPreset = MISSION_PRESETS['equatorial-ring'];
const eqStats = calculateDistortionStats(
  eqPreset.origin.coords[0], eqPreset.origin.coords[1],
  eqPreset.destination.coords[0], eqPreset.destination.coords[1]
);
assert(
  eqStats.percentageDistortion < 0.1,
  'Distortion Stats',
  'Kilimanjaro->Galapagos Equatorial Low Distortion (<0.1%)',
  `Distortion is ${eqStats.percentageDistortion.toFixed(4)}% (Delta: +${eqStats.deltaMiles.toFixed(2)} mi on ${eqStats.geodesicDistMiles.toFixed(2)} mi route)`
);

// 4.3 Trans-Continental Sprint
const tcPreset = MISSION_PRESETS['trans-continental'];
const tcStats = calculateDistortionStats(
  tcPreset.origin.coords[0], tcPreset.origin.coords[1],
  tcPreset.destination.coords[0], tcPreset.destination.coords[1]
);
assert(
  Math.abs(tcStats.geodesicDistMiles - 2218.14) < 1.0 && tcStats.percentageDistortion < 1.0,
  'Distortion Stats',
  'Cape Canaveral->Edwards AFB Distance & Distortion',
  `Geodesic: ${tcStats.geodesicDistMiles.toFixed(2)} mi, Delta: +${tcStats.deltaMiles.toFixed(2)} mi (+${tcStats.percentageDistortion.toFixed(2)}%)`
);

// 4.4 Lunar Return Skip Entry
const lrPreset = MISSION_PRESETS['lunar-return'];
const lrStats = calculateDistortionStats(
  lrPreset.origin.coords[0], lrPreset.origin.coords[1],
  lrPreset.destination.coords[0], lrPreset.destination.coords[1]
);
assert(
  Math.abs(lrStats.geodesicDistMiles - 3623.77) < 1.0 && lrStats.percentageDistortion < 1.0,
  'Distortion Stats',
  'Pacific EI->San Diego Distance & Distortion',
  `Geodesic: ${lrStats.geodesicDistMiles.toFixed(2)} mi, Delta: +${lrStats.deltaMiles.toFixed(2)} mi (+${lrStats.percentageDistortion.toFixed(2)}%)`
);

// -------------------------------------------------------------
// SUITE 5: Continuous Parametric Sweeps (p in [0,1], v in [500,25000])
// -------------------------------------------------------------
console.log('Running Suite 5: Continuous Parametric Sweeps...');

let totalEvaluations = 0;
let invalidCount = 0;
let timeConsistencyErrors = 0;
let distanceConsistencyErrors = 0;

for (const presetKey of Object.keys(MISSION_PRESETS) as (keyof typeof MISSION_PRESETS)[]) {
  const preset = MISSION_PRESETS[presetKey];

  // 1000 progress steps
  for (let pStep = 0; pStep <= 1000; pStep++) {
    const p = pStep / 1000;

    // Test across representative velocities for full telemetry test
    for (const v of [500, 1500, 5000, 17500, 24500, 25000]) {
      totalEvaluations++;
      try {
        const tel = computeTelemetry(preset, p, v);

        // Check for NaN or non-finite values in all numeric fields
        const numericFields = [
          tel.progress,
          tel.currentPos[0],
          tel.currentPos[1],
          tel.headingDeg,
          tel.altitudeFt,
          tel.altitudeMi,
          tel.velocityMph,
          tel.velocityMps,
          tel.velocityKms,
          tel.velocityKnots,
          tel.mach,
          tel.currentDistMiles,
          tel.remainingDistMiles,
          tel.totalDistMiles,
          tel.elapsedTimeSec,
          tel.etaSec,
          tel.totalTimeSec
        ];

        for (const val of numericFields) {
          if (typeof val !== 'number' || Number.isNaN(val) || !Number.isFinite(val)) {
            invalidCount++;
            console.error(`Invalid telemetry value: ${val} at preset=${presetKey}, p=${p}, v=${v}`);
          }
        }

        // Heading range check [0, 360)
        if (tel.headingDeg < 0 || tel.headingDeg >= 360) {
          invalidCount++;
        }

        // Distance conservation: current + remaining == total
        if (Math.abs(tel.currentDistMiles + tel.remainingDistMiles - tel.totalDistMiles) > 1e-4) {
          distanceConsistencyErrors++;
        }

        // Time conservation: elapsed + eta == totalTime
        if (Math.abs(tel.elapsedTimeSec + tel.etaSec - tel.totalTimeSec) > 1e-4) {
          timeConsistencyErrors++;
        }

      } catch (err) {
        invalidCount++;
        console.error(`Exception thrown during sweep: preset=${presetKey}, p=${p}, v=${v}`, err);
      }
    }
  }

  // Pure Velocity Sweep: 500 velocity steps from 500 to 25000 at p=0.5
  for (let v = 500; v <= 25000; v += 50) {
    totalEvaluations++;
    try {
      const tel = computeTelemetry(preset, 0.5, v);
      if (Number.isNaN(tel.mach) || !Number.isFinite(tel.mach)) invalidCount++;
      if (Number.isNaN(tel.totalTimeSec) || !Number.isFinite(tel.totalTimeSec)) invalidCount++;
    } catch (err) {
      invalidCount++;
    }
  }
}

assert(
  invalidCount === 0,
  'Continuous Sweeps',
  'Telemetry State Cleanliness Across Full Parameter Space',
  `Tested ${totalEvaluations} states across p in [0,1] and v in [500,25000]. Invalid/NaN count: ${invalidCount}`
);
assert(
  distanceConsistencyErrors === 0,
  'Continuous Sweeps',
  'Distance Conservation (Current + Remaining == Total)',
  `Distance conservation verified with 0 errors.`
);
assert(
  timeConsistencyErrors === 0,
  'Continuous Sweeps',
  'Time Conservation (Elapsed + ETA == Total)',
  `Time conservation verified with 0 errors.`
);

// -------------------------------------------------------------
// SUITE 6: Theme Configurations & Formatting
// -------------------------------------------------------------
console.log('Running Suite 6: Themes & Utility Formatters...');

assert(Object.keys(THEMES).length === 3, 'Themes & Formatting', 'Theme Count', `Expected 3 themes, got ${Object.keys(THEMES).length}`);
for (const themeId of ['e-ink', 'nasa-dark', 'satellite'] as const) {
  const theme = THEMES[themeId];
  assert(
    !!theme.tileUrl && !!theme.arcColor && !!theme.chordColor && !!theme.markerColor && !!theme.pingColor,
    'Themes & Formatting',
    `Theme Definition: ${theme.name}`,
    `Theme '${themeId}' has all required cartographic styling properties.`
  );
}

// Formatter unit tests
assert(formatDuration(45) === '45.0s', 'Themes & Formatting', 'formatDuration (<60s)', `Got: ${formatDuration(45)}`);
assert(formatDuration(125) === '2m 5s', 'Themes & Formatting', 'formatDuration (<1h)', `Got: ${formatDuration(125)}`);
assert(formatDuration(3725) === '1h 2m 5s', 'Themes & Formatting', 'formatDuration (>=1h)', `Got: ${formatDuration(3725)}`);
assert(formatDistance(5939.48) === '5,939 mi', 'Themes & Formatting', 'formatDistance', `Got: ${formatDistance(5939.48)}`);
assert(formatAltitude(290000).includes('54.9 mi'), 'Themes & Formatting', 'formatAltitude High Alt', `Got: ${formatAltitude(290000)}`);
assert(formatCoordinates(51.5074, -0.1278).combined === '51.5074° N, 0.1278° W', 'Themes & Formatting', 'formatCoordinates', `Got: ${formatCoordinates(51.5074, -0.1278).combined}`);

// -------------------------------------------------------------
// SUMMARY & EXIT
// -------------------------------------------------------------
console.log('\n======================================================');
console.log('            EMPIRICAL TEST SUITE SUMMARY              ');
console.log('======================================================');
const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => !r.passed).length;
console.log(`Total Checks: ${results.length}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) {
  console.error('\nFAILED TESTS:');
  for (const r of results.filter(r => !r.passed)) {
    console.error(`- [${r.suite}] ${r.name}: ${r.details}`);
  }
  process.exit(1);
} else {
  console.log('\n>>> ALL EMPIRICAL VERIFICATION TESTS PASSED PERFECTLY! <<<');
  process.exit(0);
}
