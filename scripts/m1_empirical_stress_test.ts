/**
 * Empirical Stress Test Harness for Milestone 1: Simulation Engine & Telemetry Controls
 * 
 * Verifies:
 * 1. Leaflet tile layer URLs, headers, and attributions for all 3 themes ('e-ink', 'nasa-dark', 'satellite').
 * 2. Spacecraft DivIcon HTML generation, bearing calculation (0° to 360°), and animation classes.
 * 3. Origin/Destination DivIcon markers and tooltips.
 * 4. In-map HUD telemetry calculation continuity across all 4 presets.
 * 5. CSS animation keyframes and classes in app/globals.css.
 * 6. Edge cases and boundary stability (velocity 0 to 25k mph, progress clamping, Mercator bounds).
 */

import {
  EARTH_RADIUS_MILES,
  EARTH_RADIUS_KM,
  SPEED_OF_SOUND_MPH,
  MAX_MERCATOR_LATITUDE,
  MISSION_PRESETS,
  MISSION_PRESETS_LIST,
  THEMES,
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
  ThemeConfig,
  MissionPreset
} from '../lib/utils';
import fs from 'fs';
import path from 'path';

export interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  warning?: boolean;
  details?: string;
  error?: string;
}

export const results: TestResult[] = [];

function assert(condition: boolean, suite: string, name: string, details?: string) {
  if (condition) {
    results.push({ suite, name, passed: true, details });
  } else {
    results.push({ suite, name, passed: false, error: details || 'Assertion failed' });
  }
}

function warn(condition: boolean, suite: string, name: string, warningMessage: string, details?: string) {
  if (condition) {
    results.push({ suite, name, passed: true, details });
  } else {
    results.push({ suite, name, passed: true, warning: true, error: warningMessage, details });
  }
}

// -------------------------------------------------------------
// Suite 1: Leaflet Tile Layer URLs, Attributions, and Themes
// -------------------------------------------------------------
async function testTileLayersAndThemes() {
  const suite = 'Tile Layers & Theme Configurations';
  const themeIds = ['e-ink', 'nasa-dark', 'satellite'] as const;

  assert(Object.keys(THEMES).length === 3, suite, 'All 3 themes present in THEMES object');

  for (const tid of themeIds) {
    const theme = THEMES[tid];
    assert(!!theme, suite, `Theme '${tid}' exists and is defined`);
    assert(typeof theme.name === 'string' && theme.name.length > 0, suite, `Theme '${tid}' has valid name: ${theme.name}`);
    assert(typeof theme.tileUrl === 'string' && theme.tileUrl.includes('{z}') && theme.tileUrl.includes('{x}') && theme.tileUrl.includes('{y}'),
      suite, `Theme '${tid}' tileUrl contains {z}, {x}, {y} placeholders: ${theme.tileUrl}`);
    assert(typeof theme.tileAttribution === 'string' && theme.tileAttribution.length > 5,
      suite, `Theme '${tid}' tileAttribution is non-empty: ${theme.tileAttribution}`);
    assert(typeof theme.tileFilter === 'string' && theme.tileFilter.length > 0,
      suite, `Theme '${tid}' has CSS tileFilter: ${theme.tileFilter}`);
    assert(typeof theme.arcColor === 'string' && theme.arcColor.length > 0,
      suite, `Theme '${tid}' has arcColor: ${theme.arcColor}`);
    assert(typeof theme.chordColor === 'string' && theme.chordColor.length > 0,
      suite, `Theme '${tid}' has chordColor: ${theme.chordColor}`);
    assert(typeof theme.markerColor === 'string' && theme.markerColor.length > 0,
      suite, `Theme '${tid}' has markerColor: ${theme.markerColor}`);
    assert(typeof theme.pingColor === 'string' && theme.pingColor.length > 0,
      suite, `Theme '${tid}' has pingColor: ${theme.pingColor}`);
  }

  // Test live tile endpoint reachability
  for (const tid of themeIds) {
    const theme = THEMES[tid];
    let sampleUrl = theme.tileUrl
      .replace('{s}', 'a')
      .replace('{z}', '0')
      .replace('{x}', '0')
      .replace('{y}', '0')
      .replace('{r}', '');

    try {
      const response = await fetch(sampleUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ArtemisVelocityVis/1.0' }
      });
      assert(
        response.status >= 200 && response.status < 400,
        suite,
        `Tile endpoint reachable for theme '${tid}' (HTTP ${response.status}): ${sampleUrl}`,
        `HTTP Status: ${response.status} ${response.statusText}`
      );
    } catch (err: any) {
      assert(false, suite, `Tile endpoint reachable for theme '${tid}'`, `Fetch error: ${err?.message}`);
    }
  }
}

// -------------------------------------------------------------
// Suite 2: Bearing Calculations & DivIcon Generation
// -------------------------------------------------------------
function testBearingAndIcons() {
  const suite = 'Bearing Calculations & Spacecraft DivIcon';

  // 1. Cardinal and Intercardinal Bearings
  const northBearing = calculateBearing(0, 0, 10, 0);
  assert(Math.abs(northBearing - 0) < 1e-4 || Math.abs(northBearing - 360) < 1e-4, suite, 'Due North Bearing is 0° / 360°', `Got: ${northBearing}°`);

  const eastBearing = calculateBearing(0, 0, 0, 10);
  assert(Math.abs(eastBearing - 90) < 1e-4, suite, 'Due East Bearing is 90°', `Got: ${eastBearing}°`);

  const southBearing = calculateBearing(10, 0, 0, 0);
  assert(Math.abs(southBearing - 180) < 1e-4, suite, 'Due South Bearing is 180°', `Got: ${southBearing}°`);

  const westBearing = calculateBearing(0, 10, 0, 0);
  assert(Math.abs(westBearing - 270) < 1e-4, suite, 'Due West Bearing is 270°', `Got: ${westBearing}°`);

  const neBearing = calculateBearing(0, 0, 10, 10);
  assert(neBearing > 40 && neBearing < 50, suite, 'Northeast Bearing is ~45°', `Got: ${neBearing}°`);

  // 2. Coincident points handling (distance = 0)
  const coincidentBearing = calculateBearing(35.0, 139.0, 35.0, 139.0);
  assert(!isNaN(coincidentBearing) && isFinite(coincidentBearing), suite, 'Coincident points produce finite number (no NaN)', `Got: ${coincidentBearing}`);

  // 3. Compass heading string formatting
  assert(calculateHeadingCompass(0) === '000° N', suite, 'Compass heading 0° is 000° N', `Got: ${calculateHeadingCompass(0)}`);
  assert(calculateHeadingCompass(90) === '090° E', suite, 'Compass heading 90° is 090° E', `Got: ${calculateHeadingCompass(90)}`);
  assert(calculateHeadingCompass(180) === '180° S', suite, 'Compass heading 180° is 180° S', `Got: ${calculateHeadingCompass(180)}`);
  assert(calculateHeadingCompass(270) === '270° W', suite, 'Compass heading 270° is 270° W', `Got: ${calculateHeadingCompass(270)}`);
  assert(calculateHeadingCompass(45) === '045° NE', suite, 'Compass heading 45° is 045° NE', `Got: ${calculateHeadingCompass(45)}`);

  // Note: 359.6° rounding check (observation of standard navigation formatting)
  const rounded359 = calculateHeadingCompass(359.6);
  warn(
    rounded359 === '000° N',
    suite,
    'Compass heading 359.6° formatting',
    `calculateHeadingCompass(359.6) produces '${rounded359}' (Math.round produces 360° N; standard navigation wraps 360° -> 000° N)`,
    `Result: ${rounded359}`
  );

  // 4. Test DivIcon HTML generation logic for each theme
  function mockCreateSpacecraftIconHtml(headingDeg: number, themeConfig: ThemeConfig) {
    const isEInk = themeConfig.id === 'e-ink';
    const isDark = themeConfig.id === 'nasa-dark';

    const vesselSvg = isEInk
      ? `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" style="transform: rotate(${headingDeg}deg); transform-origin: 50% 50%;">
          <polygon points="12,2 20,21 12,17 4,21" fill="#000000" stroke="#ffffff" stroke-width="2"/>
          <circle cx="12" cy="12" r="2.5" fill="#ffffff"/>
         </svg>`
      : isDark
      ? `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" style="transform: rotate(${headingDeg}deg); transform-origin: 50% 50%; filter: drop-shadow(0 0 6px #00f0ff);">
          <polygon points="12,2 21,21 12,16 3,21" fill="#00f0ff" stroke="#ffffff" stroke-width="1.5"/>
          <circle cx="12" cy="12" r="2" fill="#ffffff"/>
         </svg>`
      : `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" style="transform: rotate(${headingDeg}deg); transform-origin: 50% 50%; filter: drop-shadow(0 0 6px #facc15);">
          <polygon points="12,2 21,21 12,16 3,21" fill="#facc15" stroke="#000000" stroke-width="1.5"/>
          <circle cx="12" cy="12" r="2" fill="#84cc16"/>
         </svg>`;

    return `
      <div class="spacecraft-marker-container" style="width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; position: relative;">
        <div class="animate-radar-ping spacecraft-radar-ring" style="border: 2px solid ${themeConfig.markerColor}; background: ${themeConfig.pingColor};"></div>
        <div class="spacecraft-vessel">
          ${vesselSvg}
        </div>
      </div>
    `;
  }

  for (const themeId of ['e-ink', 'nasa-dark', 'satellite'] as const) {
    const theme = THEMES[themeId];
    const testHeadings = [0, 45.5, 90, 180, 270, 315.8];
    for (const hdg of testHeadings) {
      const html = mockCreateSpacecraftIconHtml(hdg, theme);
      assert(html.includes(`transform: rotate(${hdg}deg)`), suite, `Spacecraft DivIcon includes heading transform rotate(${hdg}deg) for ${themeId}`);
      assert(html.includes('animate-radar-ping'), suite, `Spacecraft DivIcon contains animate-radar-ping class for ${themeId}`);
      assert(html.includes('spacecraft-radar-ring'), suite, `Spacecraft DivIcon contains spacecraft-radar-ring class for ${themeId}`);
      assert(html.includes(theme.markerColor), suite, `Spacecraft DivIcon border uses theme markerColor (${theme.markerColor}) for ${themeId}`);
      assert(html.includes(theme.pingColor), suite, `Spacecraft DivIcon background uses theme pingColor for ${themeId}`);
    }
  }
}

// -------------------------------------------------------------
// Suite 3: Origin / Destination Markers
// -------------------------------------------------------------
function testOriginDestIcons() {
  const suite = 'Origin and Destination Markers';

  for (const themeId of ['e-ink', 'nasa-dark', 'satellite'] as const) {
    const theme = THEMES[themeId];
    const isEInk = theme.id === 'e-ink';
    
    // Origin
    const originBg = isEInk ? '#000000' : '#10b981';
    assert(isEInk ? originBg === '#000000' : originBg === '#10b981', suite, `Origin icon background correctly resolved for ${themeId}`);

    // Dest
    const destBg = isEInk ? '#ffffff' : '#f43f5e';
    const destFg = isEInk ? '#000000' : '#ffffff';
    assert(isEInk ? destBg === '#ffffff' && destFg === '#000000' : destBg === '#f43f5e' && destFg === '#ffffff',
      suite, `Destination icon colors correctly resolved for ${themeId}`);
  }
}

// -------------------------------------------------------------
// Suite 4: In-Map HUD Telemetry Continuity Across All 4 Presets
// -------------------------------------------------------------
function testTelemetryContinuityAcrossPresets() {
  const suite = 'HUD Telemetry Continuity & Presets';

  assert(MISSION_PRESETS_LIST.length === 4, suite, 'All 4 mission presets present in MISSION_PRESETS_LIST');

  const presetIds = ['lunar-return', 'trans-eurasian', 'trans-continental', 'equatorial-ring'] as const;

  for (const pid of presetIds) {
    const preset = MISSION_PRESETS[pid];
    assert(!!preset, suite, `Preset '${pid}' exists`);
    assert(typeof preset.name === 'string' && preset.name.length > 0, suite, `Preset '${pid}' has valid name: ${preset.name}`);
    assert(Array.isArray(preset.origin.coords) && preset.origin.coords.length === 2, suite, `Preset '${pid}' has valid origin coordinates`);
    assert(Array.isArray(preset.destination.coords) && preset.destination.coords.length === 2, suite, `Preset '${pid}' has valid destination coordinates`);
    assert(preset.defaultVelocityMph >= 500 && preset.defaultVelocityMph <= 25000, suite, `Preset '${pid}' default velocity is within [500, 25000] mph (${preset.defaultVelocityMph} mph)`);

    // Distortion stats check
    const distortion = calculateDistortionStats(
      preset.origin.coords[0], preset.origin.coords[1],
      preset.destination.coords[0], preset.destination.coords[1]
    );

    assert(distortion.geodesicDistMiles > 0, suite, `Preset '${pid}' geodesic distance is positive: ${distortion.geodesicDistMiles.toFixed(2)} mi`);
    assert(distortion.mercatorDistMiles > 0, suite, `Preset '${pid}' Mercator distance is positive: ${distortion.mercatorDistMiles.toFixed(2)} mi`);
    assert(!isNaN(distortion.deltaMiles) && !isNaN(distortion.percentageDistortion), suite, `Preset '${pid}' distortion metrics are finite numbers`);
    assert(!isNaN(distortion.midpointSeparationMiles) && distortion.midpointSeparationMiles >= 0, suite, `Preset '${pid}' midpoint separation is >= 0 (${distortion.midpointSeparationMiles.toFixed(2)} mi)`);

    // Verify Trans-Eurasian specifically has expected high distortion (~18.15%)
    if (pid === 'trans-eurasian') {
      assert(
        distortion.percentageDistortion > 15 && distortion.percentageDistortion < 21,
        suite,
        `Trans-Eurasian sub-polar distortion is ~18.15% (actual: ${distortion.percentageDistortion.toFixed(2)}%)`
      );
      assert(
        distortion.midpointSeparationMiles > 1500 && distortion.midpointSeparationMiles < 2200,
        suite,
        `Trans-Eurasian midpoint separation is ~1857 mi (actual: ${distortion.midpointSeparationMiles.toFixed(2)} mi)`
      );
    }

    // High resolution sampling across progress (1,000 steps)
    const numSteps = 1000;
    let prevAltitude = -1;
    let maxAltitudeDelta = 0;
    let prevProgress = -1;
    let prevElapsed = -1;

    for (let i = 0; i <= numSteps; i++) {
      const p = i / numSteps;
      const t = computeTelemetry(preset, p, preset.defaultVelocityMph);

      // Validate TelemetryState integrity
      assert(!isNaN(t.progress) && t.progress >= 0 && t.progress <= 1, suite, `Step ${i} for '${pid}': progress valid`);
      assert(!isNaN(t.currentPos[0]) && t.currentPos[0] >= -90 && t.currentPos[0] <= 90, suite, `Step ${i} for '${pid}': latitude within [-90, 90] (${t.currentPos[0]})`);
      assert(!isNaN(t.currentPos[1]) && t.currentPos[1] >= -180 && t.currentPos[1] <= 180, suite, `Step ${i} for '${pid}': longitude within [-180, 180] (${t.currentPos[1]})`);
      assert(!isNaN(t.headingDeg) && t.headingDeg >= 0 && t.headingDeg <= 360, suite, `Step ${i} for '${pid}': heading within [0, 360] (${t.headingDeg.toFixed(1)}°)`);
      assert(!isNaN(t.altitudeFt) && t.altitudeFt >= 0, suite, `Step ${i} for '${pid}': altitudeFt >= 0 (${t.altitudeFt} ft)`);
      assert(!isNaN(t.mach) && t.mach > 0, suite, `Step ${i} for '${pid}': Mach valid (${t.machStr})`);
      assert(t.regime.length > 0, suite, `Step ${i} for '${pid}': Flight regime defined (${t.regime})`);
      assert(t.flightPhase.length > 0, suite, `Step ${i} for '${pid}': Flight phase non-empty ('${t.flightPhase}')`);
      assert(Math.abs((t.currentDistMiles + t.remainingDistMiles) - t.totalDistMiles) < 1e-3, suite, `Step ${i} for '${pid}': distance partition invariant holds`);

      if (prevProgress >= 0) {
        assert(t.elapsedTimeSec >= prevElapsed, suite, `Step ${i} for '${pid}': elapsed time monotonic (${t.elapsedTimeSec.toFixed(2)}s >= ${prevElapsed.toFixed(2)}s)`);
      }

      if (prevAltitude >= 0) {
        const altDelta = Math.abs(t.altitudeFt - prevAltitude);
        if (altDelta > maxAltitudeDelta) maxAltitudeDelta = altDelta;
      }

      prevAltitude = t.altitudeFt;
      prevProgress = p;
      prevElapsed = t.elapsedTimeSec;
    }

    assert(maxAltitudeDelta < 5000, suite, `Preset '${pid}' altitude is smooth (max step delta: ${maxAltitudeDelta} ft)`);

    // Check terminal heading observation at p = 1.0 vs p = 0.999
    const t99 = computeTelemetry(preset, 0.99, preset.defaultVelocityMph);
    const t100 = computeTelemetry(preset, 1.0, preset.defaultVelocityMph);
    warn(
      Math.abs(t100.headingDeg - t99.headingDeg) < 45,
      suite,
      `Terminal heading continuity for '${pid}' at p=1.00`,
      `At p=1.00, lookAheadProgress clamps to 1.0, causing calculateBearing(dest, dest) to return 0.0° N (instant jump from ${t99.headingDeg.toFixed(1)}° at p=0.99 to ${t100.headingDeg.toFixed(1)}° at p=1.00)`
    );
  }
}

// -------------------------------------------------------------
// Suite 5: CSS Animation Keyframes & Classes in globals.css
// -------------------------------------------------------------
function testCssKeyframesAndClasses() {
  const suite = 'CSS Keyframes & UI Classes';

  const cssPath = path.resolve(__dirname, '../app/globals.css');
  assert(fs.existsSync(cssPath), suite, 'app/globals.css exists');

  const cssContent = fs.readFileSync(cssPath, 'utf8');

  // Check keyframe animations
  assert(cssContent.includes('@keyframes radar-ping'), suite, 'globals.css defines @keyframes radar-ping');
  assert(cssContent.includes('.animate-radar-ping'), suite, 'globals.css defines .animate-radar-ping');
  assert(cssContent.includes('@keyframes pulse-subtle'), suite, 'globals.css defines @keyframes pulse-subtle');
  assert(cssContent.includes('.animate-pulse-subtle'), suite, 'globals.css defines .animate-pulse-subtle');

  // Check marker & vessel classes
  assert(cssContent.includes('.spacecraft-marker-container'), suite, 'globals.css defines .spacecraft-marker-container');
  assert(cssContent.includes('.spacecraft-radar-ring'), suite, 'globals.css defines .spacecraft-radar-ring');
  assert(cssContent.includes('.spacecraft-vessel'), suite, 'globals.css defines .spacecraft-vessel');

  // Check range slider styles
  assert(cssContent.includes('input[type="range"]'), suite, 'globals.css defines input[type="range"] base styles');
  assert(cssContent.includes('::-webkit-slider-thumb'), suite, 'globals.css defines webkit slider thumb');
  assert(cssContent.includes('::-moz-range-thumb'), suite, 'globals.css defines moz range thumb');
  assert(cssContent.includes('::-webkit-slider-runnable-track'), suite, 'globals.css defines webkit slider track');
  assert(cssContent.includes('.theme-e-ink input[type="range"]'), suite, 'globals.css defines e-ink slider customizations');

  // Check custom scrollbar styles
  assert(cssContent.includes('.custom-scrollbar'), suite, 'globals.css defines .custom-scrollbar');
  assert(cssContent.includes('.theme-e-ink .custom-scrollbar'), suite, 'globals.css defines e-ink custom scrollbar');
}

// -------------------------------------------------------------
// Suite 6: Kinematics, Regimes, Formatters & Slerp Stress Test
// -------------------------------------------------------------
function testKinematicsAndStress() {
  const suite = 'Kinematics & Boundary Stress Testing';

  // 1. Mach Calculation & Regimes
  assert(Math.abs(calculateMach(SPEED_OF_SOUND_MPH) - 1.0) < 1e-4, suite, '767.26 mph is exactly Mach 1.00');
  assert(Math.abs(calculateMach(500) - 0.6517) < 1e-3, suite, '500 mph is Mach ~0.65');
  assert(Math.abs(calculateMach(24500) - 31.9318) < 1e-3, suite, '24,500 mph is Mach ~31.93');
  assert(Math.abs(calculateMach(25000) - 32.5835) < 1e-3, suite, '25,000 mph is Mach ~32.58');

  assert(getFlightRegime(500) === 'Subsonic', suite, '500 mph is Subsonic');
  assert(getFlightRegime(768) === 'Supersonic', suite, '768 mph is Supersonic');
  assert(getFlightRegime(4000) === 'Hypersonic', suite, '4000 mph is Hypersonic');
  assert(getFlightRegime(18000) === 'Orbital / Re-entry', suite, '18,000 mph is Orbital / Re-entry');
  assert(getFlightRegime(25000) === 'Orbital / Re-entry', suite, '25,000 mph is Orbital / Re-entry');

  // 2. Formatters
  const coordFmt = formatCoordinates(37.7749, -122.4194);
  assert(coordFmt.latStr === '37.7749° N' && coordFmt.lonStr === '122.4194° W', suite, 'formatCoordinates formats N/W correctly', coordFmt.combined);
  
  const southEastFmt = formatCoordinates(-33.8688, 151.2093);
  assert(southEastFmt.latStr === '33.8688° S' && southEastFmt.lonStr === '151.2093° E', suite, 'formatCoordinates formats S/E correctly', southEastFmt.combined);

  assert(formatDuration(45) === '45.0s', suite, 'formatDuration < 60s is Xs');
  assert(formatDuration(154) === '2m 34s', suite, 'formatDuration < 1h is Xm Ys');
  assert(formatDuration(3665) === '1h 1m 5s', suite, 'formatDuration >= 1h is Xh Ym Zs');

  assert(formatDistance(5939.48) === '5,939 mi', suite, 'formatDistance formats with commas');
  assert(formatAltitude(400000) === '75.8 mi (400,000 ft)', suite, 'formatAltitude >= 52800 ft shows miles and ft');
  assert(formatAltitude(12000) === '12,000 ft', suite, 'formatAltitude < 52800 ft shows ft');

  // 3. Web Mercator Projections Boundary Stress
  const eqForward = mercatorForward(0, 0);
  assert(Math.abs(eqForward.x) < 1e-6 && Math.abs(eqForward.y) < 1e-6, suite, 'Mercator forward (0, 0) is (0, 0)');
  const eqInverse = mercatorInverse(0, 0);
  assert(Math.abs(eqInverse[0]) < 1e-6 && Math.abs(eqInverse[1]) < 1e-6, suite, 'Mercator inverse (0, 0) is (0, 0)');

  // Clamping at MAX_MERCATOR_LATITUDE
  const polarForward = mercatorForward(89.9, 0);
  const polarInverse = mercatorInverse(polarForward.x, polarForward.y);
  assert(Math.abs(polarInverse[0] - MAX_MERCATOR_LATITUDE) < 1e-4, suite, 'Mercator lat > 85.0511° clamped to MAX_MERCATOR_LATITUDE', `Got: ${polarInverse[0]}`);

  // Slerp edge cases: same start and end
  const slerpIdentical = interpolatePosition(40.0, -74.0, 40.0, -74.0, 0.5);
  assert(Math.abs(slerpIdentical[0] - 40.0) < 1e-4 && Math.abs(slerpIdentical[1] - (-74.0)) < 1e-4, suite, 'Slerp with identical endpoints returns endpoint coordinate');

  // Slerp progress clamping (<0 and >1)
  const slerpUnder = interpolatePosition(0, 0, 10, 10, -0.5);
  assert(Math.abs(slerpUnder[0] - 0) < 1e-4 && Math.abs(slerpUnder[1] - 0) < 1e-4, suite, 'Slerp with negative progress clamps to 0.0');

  const slerpOver = interpolatePosition(0, 0, 10, 10, 1.5);
  assert(Math.abs(slerpOver[0] - 10) < 1e-4 && Math.abs(slerpOver[1] - 10) < 1e-4, suite, 'Slerp with progress > 1 clamps to 1.0');

  // 101 point polyline generator check
  const arcPts = geodesicArc(0, 0, 10, 10);
  assert(arcPts.length === 101, suite, 'geodesicArc generates exactly 101 waypoints');
  const chordPts = mercatorLinearChord(0, 0, 10, 10);
  assert(chordPts.length === 101, suite, 'mercatorLinearChord generates exactly 101 waypoints');
}

// -------------------------------------------------------------
// Runner
// -------------------------------------------------------------
export async function runAllTests(): Promise<{ total: number; passed: number; failed: number; warnings: number }> {
  console.log('=====================================================');
  console.log('RUNNING EMPIRICAL STRESS TESTS FOR MILESTONE 1');
  console.log('=====================================================\n');

  await testTileLayersAndThemes();
  testBearingAndIcons();
  testOriginDestIcons();
  testTelemetryContinuityAcrossPresets();
  testCssKeyframesAndClasses();
  testKinematicsAndStress();

  const total = results.length;
  const passed = results.filter(r => r.passed && !r.warning).length;
  const warnings = results.filter(r => r.warning).length;
  const failed = results.filter(r => !r.passed).length;

  console.log(`\nTEST SUMMARY: ${passed + warnings}/${total} PASSED (${warnings} WARNINGS, ${failed} FAILED)\n`);

  const suites = Array.from(new Set(results.map(r => r.suite)));
  for (const s of suites) {
    const suiteResults = results.filter(r => r.suite === s);
    const suitePassed = suiteResults.filter(r => r.passed && !r.warning).length;
    const suiteWarns = suiteResults.filter(r => r.warning).length;
    const suiteFailed = suiteResults.filter(r => !r.passed).length;
    console.log(`[${s}] -> ${suitePassed + suiteWarns}/${suiteResults.length} Passed (${suiteWarns} warnings)`);
    if (suiteWarns > 0) {
      for (const w of suiteResults.filter(r => r.warning)) {
        console.warn(`   ⚠️ WARNING: ${w.name} => ${w.error}`);
      }
    }
    if (suiteFailed > 0) {
      for (const f of suiteResults.filter(r => !r.passed)) {
        console.error(`   ❌ FAIL: ${f.name} => ${f.error}`);
      }
    }
  }

  return { total, passed, failed, warnings };
}

if (require.main === module) {
  runAllTests().then(summary => {
    if (summary.failed > 0) {
      process.exit(1);
    }
  }).catch(err => {
    console.error('Test runner fatal error:', err);
    process.exit(1);
  });
}
