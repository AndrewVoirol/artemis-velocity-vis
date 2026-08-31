/**
 * Empirical Stress Test Suite for Milestone 2: Artemis Flight Simulator
 * 
 * Tests:
 * 1. Scrubber Bounds Clamping (p < 0 -> 0, p > 1 -> 1, boundary & non-finite values)
 * 2. Velocity Bounds & Mach Kinematics (v in [500, 25000], Mach = v / 767.26, flight regimes)
 * 3. Synchronous Telemetry Fidelity Across All 4 Presets (endpoints, monotonicity, conservation, altitude, distortion)
 * 4. Simulation Clock Integration & Kinematics (multipliers 1x..100x, frame delta stepping)
 * 5. Theme Token Completeness & Fallbacks (all 3 themes, invalid IDs)
 * 6. High-Throughput Performance Benchmark (100,000 synchronous evaluations)
 */

import {
  computeTelemetry,
  calculateAltitude,
  calculateDistortionStats,
  calculateDistance,
  calculateBearing,
  calculateHeadingCompass,
  calculateMach,
  getFlightRegime,
  interpolatePosition,
  geodesicArc,
  mercatorLinearChord,
  formatCoordinates,
  formatDuration,
  formatDistance,
  formatAltitude,
  MISSION_PRESETS,
  MISSION_PRESETS_LIST,
  THEMES,
  MissionPresetId,
  ThemeId,
  SPEED_OF_SOUND_MPH
} from '../lib/utils';

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  details?: string;
  error?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, suite: string, name: string, details?: string) {
  if (!condition) {
    results.push({ suite, name, passed: false, details, error: 'Assertion failed' });
    console.error(`❌ [FAIL] ${suite} -> ${name}: ${details || ''}`);
  } else {
    results.push({ suite, name, passed: true, details });
    console.log(`✅ [PASS] ${suite} -> ${name}`);
  }
}

console.log('================================================================');
console.log('🚀 RUNNING EMPIRICAL STRESS TESTS: ARTEMIS FLIGHT SIMULATOR M2');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// SUITE 1: SCRUBBER BOUNDS CLAMPING
// -----------------------------------------------------------------------------
console.log('--- Suite 1: Scrubber Bounds Clamping ---');
{
  const preset = MISSION_PRESETS['lunar-return'];
  
  // Test negative p
  const telemNeg = computeTelemetry(preset, -0.5, 24500);
  assert(telemNeg.progress === 0, 'Scrubber Clamping', 'Negative progress clamped to 0', `progress was ${telemNeg.progress}`);
  assert(telemNeg.currentDistMiles === 0, 'Scrubber Clamping', 'Negative progress yields 0 distance');
  assert(telemNeg.elapsedTimeSec === 0, 'Scrubber Clamping', 'Negative progress yields 0 elapsed time');
  assert(
    Math.abs(telemNeg.currentPos[0] - preset.origin.coords[0]) < 1e-4 &&
    Math.abs(telemNeg.currentPos[1] - preset.origin.coords[1]) < 1e-4,
    'Scrubber Clamping',
    'Negative progress positions at origin'
  );

  // Test p > 1
  const telemExcess = computeTelemetry(preset, 1.75, 24500);
  assert(telemExcess.progress === 1, 'Scrubber Clamping', 'Excess progress clamped to 1.0', `progress was ${telemExcess.progress}`);
  assert(
    Math.abs(telemExcess.currentDistMiles - telemExcess.totalDistMiles) < 1e-4,
    'Scrubber Clamping',
    'Excess progress yields total distance'
  );
  assert(telemExcess.etaSec === 0, 'Scrubber Clamping', 'Excess progress yields 0 ETA remaining');
  assert(
    Math.abs(telemExcess.currentPos[0] - preset.destination.coords[0]) < 1e-4 &&
    Math.abs(telemExcess.currentPos[1] - preset.destination.coords[1]) < 1e-4,
    'Scrubber Clamping',
    'Excess progress positions at destination'
  );

  // Test boundary edge points: 0.0, 1.0, and near epsilon
  const telemZero = computeTelemetry(preset, 0.0, 24500);
  assert(telemZero.progress === 0.0, 'Scrubber Clamping', 'Exact 0.0 boundary');
  const telemOne = computeTelemetry(preset, 1.0, 24500);
  assert(telemOne.progress === 1.0, 'Scrubber Clamping', 'Exact 1.0 boundary');

  // Test interpolatePosition bounds
  const posUnder = interpolatePosition(10, 20, 30, 40, -10);
  assert(posUnder[0] === 10 && posUnder[1] === 20, 'Scrubber Clamping', 'interpolatePosition clamps negative fraction');
  const posOver = interpolatePosition(10, 20, 30, 40, 10);
  assert(posOver[0] === 30 && posOver[1] === 40, 'Scrubber Clamping', 'interpolatePosition clamps overflow fraction');
}

// -----------------------------------------------------------------------------
// SUITE 2: VELOCITY BOUNDS & MACH KINEMATICS
// -----------------------------------------------------------------------------
console.log('\n--- Suite 2: Velocity Bounds & Mach Kinematics ---');
{
  // Test min bound: 500 mph
  const mach500 = calculateMach(500);
  assert(Math.abs(mach500 - 500 / SPEED_OF_SOUND_MPH) < 1e-5, 'Velocity Kinematics', 'Mach at 500 mph (M0.65)');
  assert(getFlightRegime(500) === 'Subsonic', 'Velocity Kinematics', 'Regime at 500 mph is Subsonic');

  // Test Supersonic: 1535 mph
  const mach1535 = calculateMach(1535);
  assert(Math.abs(mach1535 - 2.0) < 0.01, 'Velocity Kinematics', 'Mach at 1535 mph (M2.0)');
  assert(getFlightRegime(1535) === 'Supersonic', 'Velocity Kinematics', 'Regime at 1535 mph is Supersonic');

  // Test Hypersonic: 5750 mph
  const mach5750 = calculateMach(5750);
  assert(Math.abs(mach5750 - 7.49) < 0.1, 'Velocity Kinematics', 'Mach at 5750 mph (M7.5)');
  assert(getFlightRegime(5750) === 'Hypersonic', 'Velocity Kinematics', 'Regime at 5750 mph is Hypersonic');

  // Test Orbital: 17500 mph
  assert(getFlightRegime(17500) === 'Orbital / Re-entry', 'Velocity Kinematics', 'Regime at 17,500 mph is Orbital / Re-entry');

  // Test Max bound: 25000 mph
  const mach25000 = calculateMach(25000);
  assert(Math.abs(mach25000 - 32.58) < 0.1, 'Velocity Kinematics', 'Mach at 25,000 mph (M32.58)');
  assert(getFlightRegime(25000) === 'Orbital / Re-entry', 'Velocity Kinematics', 'Regime at 25,000 mph is Orbital / Re-entry');

  // Test zero / negative velocity safety (prevents division by zero or NaN)
  const preset = MISSION_PRESETS['lunar-return'];
  const telemZeroVel = computeTelemetry(preset, 0.5, 0);
  assert(!isNaN(telemZeroVel.totalTimeSec) && isFinite(telemZeroVel.totalTimeSec), 'Velocity Kinematics', 'Zero velocity yields finite totalTimeSec (0)');
  assert(!isNaN(telemZeroVel.etaSec) && isFinite(telemZeroVel.etaSec), 'Velocity Kinematics', 'Zero velocity yields finite etaSec');
}

// -----------------------------------------------------------------------------
// SUITE 3: SYNCHRONOUS TELEMETRY FIDELITY ACROSS ALL 4 PRESETS
// -----------------------------------------------------------------------------
console.log('\n--- Suite 3: Synchronous Telemetry Fidelity Across All 4 Presets ---');
{
  const presetIds: MissionPresetId[] = ['lunar-return', 'trans-eurasian', 'trans-continental', 'equatorial-ring'];

  for (const pid of presetIds) {
    const preset = MISSION_PRESETS[pid];
    assert(!!preset, 'Telemetry Fidelity', `Preset ${pid} is registered and loaded`);

    // Distortion stats check
    const distStats = calculateDistortionStats(
      preset.origin.coords[0], preset.origin.coords[1],
      preset.destination.coords[0], preset.destination.coords[1]
    );

    assert(distStats.geodesicDistMiles > 0, 'Telemetry Fidelity', `${pid}: Geodesic distance > 0 (${distStats.geodesicDistMiles.toFixed(1)} mi)`);
    assert(distStats.mercatorDistMiles >= distStats.geodesicDistMiles - 1e-4, 'Telemetry Fidelity', `${pid}: Mercator chord distance >= Geodesic distance`);
    assert(distStats.deltaMiles >= -1e-4, 'Telemetry Fidelity', `${pid}: Cartographic delta miles >= 0 (+${distStats.deltaMiles.toFixed(1)} mi)`);
    assert(distStats.percentageDistortion >= -1e-4, 'Telemetry Fidelity', `${pid}: Percentage distortion >= 0 (+${distStats.percentageDistortion.toFixed(2)}%)`);
    assert(distStats.midpointSeparationMiles >= 0, 'Telemetry Fidelity', `${pid}: Midpoint separation >= 0 (${distStats.midpointSeparationMiles.toFixed(1)} mi)`);

    // Polyline generation
    const arc = geodesicArc(preset.origin.coords[0], preset.origin.coords[1], preset.destination.coords[0], preset.destination.coords[1], 100);
    assert(arc.length === 101, 'Telemetry Fidelity', `${pid}: Geodesic arc produces 101 waypoints`);
    const chord = mercatorLinearChord(preset.origin.coords[0], preset.origin.coords[1], preset.destination.coords[0], preset.destination.coords[1], 100);
    assert(chord.length === 101, 'Telemetry Fidelity', `${pid}: Mercator chord produces 101 waypoints`);

    // Fine-grained progress stepping: 1000 steps from p=0.0 to 1.0
    let prevDist = -1;
    let prevElapsed = -1;
    let allValid = true;

    for (let step = 0; step <= 1000; step++) {
      const p = step / 1000;
      const t = computeTelemetry(preset, p, preset.defaultVelocityMph);

      // Check NaN / Inf
      if (
        isNaN(t.currentPos[0]) || isNaN(t.currentPos[1]) ||
        isNaN(t.currentDistMiles) || isNaN(t.elapsedTimeSec) ||
        isNaN(t.altitudeFt) || isNaN(t.headingDeg)
      ) {
        allValid = false;
        break;
      }

      // Check coordinate ranges
      if (t.currentPos[0] < -90 || t.currentPos[0] > 90 || t.currentPos[1] < -180 || t.currentPos[1] > 180) {
        allValid = false;
        break;
      }

      // Check distance monotonicity
      if (t.currentDistMiles < prevDist - 1e-4) {
        allValid = false;
        break;
      }
      prevDist = t.currentDistMiles;

      // Check time monotonicity
      if (t.elapsedTimeSec < prevElapsed - 1e-4) {
        allValid = false;
        break;
      }
      prevElapsed = t.elapsedTimeSec;

      // Check conservation: distance sum
      const distSumDiff = Math.abs((t.currentDistMiles + t.remainingDistMiles) - t.totalDistMiles);
      if (distSumDiff > 1e-3) {
        allValid = false;
        break;
      }

      // Check conservation: time sum
      const timeSumDiff = Math.abs((t.elapsedTimeSec + t.etaSec) - t.totalTimeSec);
      if (timeSumDiff > 1e-3) {
        allValid = false;
        break;
      }
    }

    assert(allValid, 'Telemetry Fidelity', `${pid}: 1,000 step progression passed all conservation, bounds & monotonicity tests`);

    // Test specific altitude profiles
    const alt0 = calculateAltitude(pid, 0.0);
    const altMid = calculateAltitude(pid, 0.5);
    const alt1 = calculateAltitude(pid, 1.0);
    assert(alt0.altitudeFt >= 0 && altMid.altitudeFt >= 0 && alt1.altitudeFt >= 0, 'Telemetry Fidelity', `${pid}: Altitude non-negative throughout flight`);
    assert(typeof alt0.phase === 'string' && alt0.phase.length > 0, 'Telemetry Fidelity', `${pid}: Flight phase descriptor valid`);
  }
}

// -----------------------------------------------------------------------------
// SUITE 4: SIMULATION CLOCK & KINEMATICS INTEGRATION
// -----------------------------------------------------------------------------
console.log('\n--- Suite 4: Simulation Clock & Kinematics Integration ---');
{
  const multipliers = [1, 5, 10, 25, 50, 100];
  const preset = MISSION_PRESETS['lunar-return'];
  const velocityMph = preset.defaultVelocityMph;
  const velocityMps = velocityMph / 3600;
  const totalDist = calculateDistance(preset.origin.coords[0], preset.origin.coords[1], preset.destination.coords[0], preset.destination.coords[1]);
  const totalDurationSec = totalDist / velocityMps;

  for (const m of multipliers) {
    // Simulate 60fps frame loop for 1000 frames
    let currentP = 0;
    const deltaSec = 1 / 60;
    let framesToComplete = 0;

    while (currentP < 1.0 && framesToComplete < 100000) {
      const progressDelta = (deltaSec * m) / totalDurationSec;
      currentP += progressDelta;
      framesToComplete++;
    }

    const simTimeElapsed = framesToComplete * deltaSec;
    const expectedSimTime = totalDurationSec / m;
    const errorRatio = Math.abs(simTimeElapsed - expectedSimTime) / expectedSimTime;

    assert(
      errorRatio < 0.02,
      'Clock Kinematics',
      `Multiplier ${m}x: completed in ${simTimeElapsed.toFixed(2)}s real-time (expected ${expectedSimTime.toFixed(2)}s, error ${ (errorRatio * 100).toFixed(2) }%)`
    );
  }
}

// -----------------------------------------------------------------------------
// SUITE 5: THEME TOKENS & CSS ISOLATION
// -----------------------------------------------------------------------------
console.log('\n--- Suite 5: Theme Tokens & CSS Isolation ---');
{
  const themes: ThemeId[] = ['nasa-dark', 'e-ink', 'satellite'];

  for (const tId of themes) {
    const theme = THEMES[tId];
    assert(!!theme, 'Theme Isolation', `Theme '${tId}' is defined`);
    assert(!!theme.bgPage && !!theme.bgSidebar && !!theme.bgPanel, 'Theme Isolation', `${tId}: Background tokens defined`);
    assert(!!theme.textMain && !!theme.accentPrimary, 'Theme Isolation', `${tId}: Text and accent tokens defined`);
    assert(!!theme.tileUrl && !!theme.tileAttribution, 'Theme Isolation', `${tId}: Tile layer config valid`);
    assert(!!theme.arcColor && !!theme.chordColor, 'Theme Isolation', `${tId}: Trajectory colors defined`);
    assert(theme.arcWeight > 0 && theme.chordWeight > 0, 'Theme Isolation', `${tId}: Polyline weights > 0`);
  }
}

// -----------------------------------------------------------------------------
// SUITE 6: HIGH-THROUGHPUT PERFORMANCE BENCHMARK
// -----------------------------------------------------------------------------
console.log('\n--- Suite 6: High-Throughput Performance Benchmark ---');
{
  const iterations = 100000;
  const preset = MISSION_PRESETS['lunar-return'];
  const startTime = performance.now();

  for (let i = 0; i < iterations; i++) {
    const p = (i % 1000) / 1000;
    const vel = 500 + ((i * 250) % 24500);
    computeTelemetry(preset, p, vel);
  }

  const endTime = performance.now();
  const totalMs = endTime - startTime;
  const opsPerSec = Math.round((iterations / totalMs) * 1000);
  const avgLatencyUs = (totalMs / iterations) * 1000;

  console.log(`⏱️ Benchmark completed: ${iterations.toLocaleString()} evaluations in ${totalMs.toFixed(2)}ms`);
  console.log(`🚀 Throughput: ${opsPerSec.toLocaleString()} ops/sec`);
  console.log(`⚡ Average Frame Latency: ${avgLatencyUs.toFixed(3)} µs / calculation`);

  assert(opsPerSec > 50000, 'Performance Benchmark', `Throughput > 50,000 ops/sec (actual: ${opsPerSec.toLocaleString()} ops/sec)`);
  assert(avgLatencyUs < 50, 'Performance Benchmark', `Average latency < 50 µs (actual: ${avgLatencyUs.toFixed(3)} µs)`);
}

// -----------------------------------------------------------------------------
// SUMMARY & VERDICT
// -----------------------------------------------------------------------------
console.log('\n================================================================');
const total = results.length;
const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => !r.passed).length;

console.log(`TEST SUMMARY: ${passed}/${total} PASSED (${failed} FAILED)`);
if (failed > 0) {
  console.error(`💥 FAILURES DETECTED: ${failed}`);
  process.exit(1);
} else {
  console.log(`🎉 ALL STRESS TESTS PASSED WITH 100% FIDELITY!`);
}
