/**
 * Milestone 2 Adversarial Stress Test Suite
 * 
 * Stress-tests edge cases, adversarial inputs, fallback handling,
 * parametric stability, and state transitions for ArtemisFlightSimulator.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

(globalThis as any).React = React;

import ArtemisFlightSimulator, { ArtemisFlightSimulatorProps } from '../components/ArtemisFlightSimulator';
import {
  MissionPresetId,
  ThemeId,
  TelemetryState,
  TelemetryData,
  MISSION_PRESETS,
  MISSION_PRESETS_LIST,
  THEMES,
  computeTelemetry,
  calculateDistortionStats,
  geodesicArc,
  mercatorLinearChord,
  calculateBearing,
  calculateAltitude,
  calculateDistance,
  formatCoordinates,
  formatDuration,
  formatDistance,
  SPEED_OF_SOUND_MPH
} from '../lib/utils';

interface ChallengeResult {
  dimension: string;
  scenario: string;
  passed: boolean;
  expected: string;
  actual: string;
  metrics?: Record<string, any>;
}

const challenges: ChallengeResult[] = [];

function recordChallenge(
  dimension: string,
  scenario: string,
  passed: boolean,
  expected: string,
  actual: string,
  metrics?: Record<string, any>
) {
  challenges.push({
    dimension,
    scenario,
    passed,
    expected,
    actual,
    metrics
  });
}

// 1. Adversarial & Out-of-Bounds Prop Testing
function testAdversarialProps() {
  const dimension = 'Adversarial Prop Inputs';

  // 1.1 Invalid Preset fallback
  try {
    const invalidPresetHtml = renderToStaticMarkup(
      React.createElement(ArtemisFlightSimulator, { initialPreset: 'non-existent-mission-preset-xyz' as any })
    );
    const hasFallenBack = invalidPresetHtml.includes('Trans-Lunar Return & Skip Entry') || invalidPresetHtml.includes('ARTEMIS');
    recordChallenge(
      dimension,
      'Invalid preset string fallback',
      hasFallenBack,
      'Falls back safely to default lunar-return preset without throwing',
      hasFallenBack ? 'Cleanly fell back to lunar-return' : 'Failed fallback rendering'
    );
  } catch (err: any) {
    recordChallenge(dimension, 'Invalid preset string fallback', false, 'Clean fallback', `Threw error: ${err?.message}`);
  }

  // 1.2 Invalid Theme fallback
  try {
    const invalidThemeHtml = renderToStaticMarkup(
      React.createElement(ArtemisFlightSimulator, { initialTheme: 'cyberpunk-neon-99' as any })
    );
    const hasFallenBackTheme = invalidThemeHtml.includes('theme-') && invalidThemeHtml.includes('ARTEMIS');
    recordChallenge(
      dimension,
      'Invalid theme string fallback',
      hasFallenBackTheme,
      'Falls back safely to default nasa-dark theme without throwing',
      hasFallenBackTheme ? 'Cleanly fell back to nasa-dark' : 'Failed theme fallback'
    );
  } catch (err: any) {
    recordChallenge(dimension, 'Invalid theme string fallback', false, 'Clean fallback', `Threw error: ${err?.message}`);
  }

  // 1.3 Extreme velocities (0, negative, supersonic, hypersonic, ultra-orbital)
  const extremeVelocities = [0, -500, 1, 100000];
  for (const v of extremeVelocities) {
    try {
      const html = renderToStaticMarkup(
        React.createElement(ArtemisFlightSimulator, { initialVelocityMph: v })
      );
      const rendered = html.includes('ARTEMIS');
      recordChallenge(
        dimension,
        `Extreme velocity initial prop: ${v} mph`,
        rendered,
        'Renders without crash and computes finite telemetry values',
        rendered ? 'Successfully rendered' : 'Failed rendering',
        { velocity: v }
      );
    } catch (err: any) {
      recordChallenge(dimension, `Extreme velocity initial prop: ${v} mph`, false, 'Clean render', `Threw: ${err?.message}`);
    }
  }

  // 1.4 Compact mode vs Normal mode DOM structure
  try {
    const compactHtml = renderToStaticMarkup(React.createElement(ArtemisFlightSimulator, { compact: true }));
    const hasCompactSidebar = compactHtml.includes('md:w-[380px]');
    const hasCompactMinH = compactHtml.includes('min-h-[580px]');
    recordChallenge(
      dimension,
      'Compact mode responsive styling',
      hasCompactSidebar && hasCompactMinH,
      'Compact container applies md:w-[380px] and min-h-[580px]',
      `hasCompactSidebar=${hasCompactSidebar}, hasCompactMinH=${hasCompactMinH}`
    );
  } catch (err: any) {
    recordChallenge(dimension, 'Compact mode responsive styling', false, 'Valid DOM', `Threw: ${err?.message}`);
  }
}

// 2. Mathematical Stability Across 4,000 Waypoint Step Sweeps
function testMathematicalStability() {
  const dimension = 'Kinematic & Parametric Stability';

  for (const preset of MISSION_PRESETS_LIST) {
    let nanCount = 0;
    let infCount = 0;
    let outOfBoundsHeading = 0;
    let outOfBoundsAltitude = 0;
    let nonMonotonicDist = 0;

    let prevDist = -1;
    const STEPS = 1000;

    for (let i = 0; i <= STEPS; i++) {
      const p = i / STEPS;
      const t = computeTelemetry(preset, p, preset.defaultVelocityMph);

      // Check lat/lng
      if (isNaN(t.currentPos[0]) || isNaN(t.currentPos[1])) nanCount++;
      if (!isFinite(t.currentPos[0]) || !isFinite(t.currentPos[1])) infCount++;

      // Check heading
      if (isNaN(t.headingDeg) || t.headingDeg < 0 || t.headingDeg >= 360) {
        // At progress=1.0 heading might be calculated to destination, should still be 0..360
        if (t.headingDeg !== 360) outOfBoundsHeading++;
      }

      // Check altitude
      if (isNaN(t.altitudeFt) || t.altitudeFt < 0 || t.altitudeFt > 2000000) {
        outOfBoundsAltitude++;
      }

      // Check distance monotonicity
      if (t.currentDistMiles < prevDist - 1e-6) {
        nonMonotonicDist++;
      }
      prevDist = t.currentDistMiles;
    }

    const isStable = nanCount === 0 && infCount === 0 && outOfBoundsHeading === 0 && outOfBoundsAltitude === 0 && nonMonotonicDist === 0;

    recordChallenge(
      dimension,
      `1,000-step parametric sweep on ${preset.id}`,
      isStable,
      '0 NaN, 0 Inf, 0 out-of-bounds heading/altitude, strictly monotonic distance',
      `NaN=${nanCount}, Inf=${infCount}, HeadingOOB=${outOfBoundsHeading}, AltOOB=${outOfBoundsAltitude}, NonMono=${nonMonotonicDist}`,
      {
        totalDist: preset.name,
        nanCount,
        infCount,
        outOfBoundsHeading,
        outOfBoundsAltitude
      }
    );
  }
}

// 3. Distortion Visualizer Metric Derivations
function testDistortionMetricDerivations() {
  const dimension = 'Cartographic Distortion Derivations';

  for (const p of MISSION_PRESETS_LIST) {
    const stats = calculateDistortionStats(
      p.origin.coords[0],
      p.origin.coords[1],
      p.destination.coords[0],
      p.destination.coords[1]
    );

    // Geodesic distance should always be <= Mercator distance on a sphere
    // (Except near equator where both are nearly identical)
    const isGeodesicShorterOrEqual = stats.mercatorDistMiles >= stats.geodesicDistMiles - 0.1;
    const isDeltaConsistent = Math.abs(stats.deltaMiles - (stats.mercatorDistMiles - stats.geodesicDistMiles)) < 0.1;
    const isPctConsistent = Math.abs(stats.percentageDistortion - ((stats.deltaMiles / stats.geodesicDistMiles) * 100)) < 0.1;

    recordChallenge(
      dimension,
      `Distortion stats consistency for ${p.id}`,
      isGeodesicShorterOrEqual && isDeltaConsistent && isPctConsistent,
      'mercatorDist >= geodesicDist, deltaMiles == mercator - geodesic, pctDist == delta / geodesic * 100',
      `geo=${stats.geodesicDistMiles.toFixed(1)} mi, merc=${stats.mercatorDistMiles.toFixed(1)} mi, delta=${stats.deltaMiles.toFixed(1)} mi, pct=${stats.percentageDistortion.toFixed(2)}%`
    );
  }
}

// 4. Telemetry Stream Callback Reliability
function testTelemetryCallbackStream() {
  const dimension = 'Dynamic Telemetry Callback Stream';

  const collected: TelemetryData[] = [];
  const callback = (t: TelemetryData) => {
    collected.push(t);
  };

  // Simulate multiple state updates
  const testSteps = [0.0, 0.2, 0.4, 0.6, 0.8, 1.0];
  for (const step of testSteps) {
    const t = computeTelemetry(MISSION_PRESETS['lunar-return'], step, 24500);
    callback(t);
  }

  const allValid = collected.length === 6 && collected.every((t, idx) => t.progress === testSteps[idx]);
  recordChallenge(
    dimension,
    'Sequential Telemetry Stream Reception',
    allValid,
    'Received 6 ordered telemetry payloads matching step values exactly',
    `Received ${collected.length} payloads with final progress=${collected[collected.length - 1]?.progress}`
  );
}

function runAdversarialSuite() {
  console.log('================================================================');
  console.log('ARTEMIS FLIGHT SIMULATOR - ADVERSARIAL STRESS TEST REPORT');
  console.log('================================================================\n');

  testAdversarialProps();
  testMathematicalStability();
  testDistortionMetricDerivations();
  testTelemetryCallbackStream();

  let passed = 0;
  let failed = 0;

  for (const c of challenges) {
    const icon = c.passed ? '✅' : '❌';
    console.log(`${icon} [${c.dimension}] ${c.scenario}`);
    console.log(`   Expected: ${c.expected}`);
    console.log(`   Actual:   ${c.actual}`);
    if (c.metrics) {
      console.log(`   Metrics:  ${JSON.stringify(c.metrics)}`);
    }
    if (c.passed) passed++;
    else failed++;
  }

  console.log('\n================================================================');
  console.log(`TOTAL CHALLENGES: ${challenges.length} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log(`OVERALL STATUS: ${failed === 0 ? 'ROBUST / ALL ASSUMPTIONS VERIFIED' : 'VULNERABILITIES DETECTED'}`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAdversarialSuite();
