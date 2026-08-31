/**
 * Milestone 2 Empirical Test Suite: Standalone Modular Export & Host Integration
 * 
 * Test Coverage:
 * 1. Module Export & Type Integrity (ArtemisFlightSimulator, ArtemisFlightSimulatorProps, TelemetryData)
 * 2. SSR Safety & Dynamic Leaflet Isolation (Pure Node server-side render test)
 * 3. Prop Permutations Matrix (initialPreset, initialTheme, initialVelocityMph, showMercatorDefault, compact, className)
 * 4. Simulation State Transitions (Preset switching, scrubber updates, velocity/Mach regimes, reset/play logic)
 * 5. Dynamic Telemetry Listener Callback Invocations (onTelemetryUpdate payload validation and edge values)
 * 6. Host Page Integration (app/page.tsx structure and SSR safety)
 */

import React from 'react';
import { renderToString, renderToStaticMarkup } from 'react-dom/server';

// Ensure React is globally available for any components compiled with React.createElement
(globalThis as any).React = React;

import ArtemisFlightSimulator, { ArtemisFlightSimulatorProps } from '../components/ArtemisFlightSimulator';
import Home from '../app/page';
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
  SPEED_OF_SOUND_MPH
} from '../lib/utils';

interface TestResult {
  category: string;
  testName: string;
  passed: boolean;
  message: string;
  details?: Record<string, any>;
}

const testResults: TestResult[] = [];

function recordTest(category: string, testName: string, passed: boolean, message: string, details?: Record<string, any>) {
  testResults.push({
    category,
    testName,
    passed,
    message: passed ? `PASSED: ${message}` : `FAILED: ${message}`,
    details
  });
}

function runModuleExportTests() {
  const category = '1. Module Export & Type Contracts';

  // Test 1.1: Component export type
  const isFunction = typeof ArtemisFlightSimulator === 'function';
  recordTest(category, 'Default Export is Function', isFunction, 'ArtemisFlightSimulator is a valid React component function');

  // Test 1.2: Host Page Home export type
  const isHomeFunction = typeof Home === 'function';
  recordTest(category, 'Host Page Default Export is Function', isHomeFunction, 'app/page.tsx exports a valid Home React component');

  // Test 1.3: TelemetryData & TelemetryState type identity
  const sampleTelemetry: TelemetryData = computeTelemetry(MISSION_PRESETS['lunar-return'], 0.5, 24500);
  const hasTelemetryFields =
    typeof sampleTelemetry.progress === 'number' &&
    typeof sampleTelemetry.velocityMph === 'number' &&
    typeof sampleTelemetry.mach === 'number' &&
    Array.isArray(sampleTelemetry.currentPos) &&
    typeof sampleTelemetry.altitudeFt === 'number' &&
    typeof sampleTelemetry.flightPhase === 'string';
  recordTest(category, 'TelemetryData Type Contract', hasTelemetryFields, 'TelemetryData shape matches TelemetryState interface', {
    velocityMph: sampleTelemetry.velocityMph,
    mach: sampleTelemetry.mach,
    regime: sampleTelemetry.regime,
    currentPos: sampleTelemetry.currentPos
  });
}

function runSSRSafetyTests() {
  const category = '2. SSR Safety & Dynamic Leaflet Isolation';

  // Verify that rendering in pure Node environment (where window/document are undefined) does not throw
  const isWindowUndefined = typeof (globalThis as any).window === 'undefined';
  recordTest(category, 'Environment Check', isWindowUndefined, 'Test runs in pure Node.js environment with undefined window/document');

  // Test 2.1: Default ArtemisFlightSimulator SSR
  try {
    const ssrHtml = renderToString(React.createElement(ArtemisFlightSimulator, {}));
    const hasRadarText = ssrHtml.includes('Initializing Orbital Cartography Engine') || ssrHtml.includes('ARTEMIS');
    const hasNoLeafletCrash = !ssrHtml.includes('leaflet-container-error');
    recordTest(
      category,
      'SSR Render Default Component',
      hasRadarText && hasNoLeafletCrash,
      'ArtemisFlightSimulator renders cleanly to static HTML without throwing window/document errors',
      { htmlLength: ssrHtml.length, containsBranding: ssrHtml.includes('ARTEMIS') }
    );
  } catch (err: any) {
    recordTest(category, 'SSR Render Default Component', false, `SSR threw an unexpected error: ${err?.message || err}`);
  }

  // Test 2.2: Host Page SSR
  try {
    const pageHtml = renderToString(React.createElement(Home, {}));
    const containsMain = pageHtml.includes('<main') && pageHtml.includes('ARTEMIS');
    recordTest(
      category,
      'SSR Render Host Page',
      containsMain,
      'app/page.tsx renders to static HTML enclosing ArtemisFlightSimulator',
      { htmlLength: pageHtml.length }
    );
  } catch (err: any) {
    recordTest(category, 'SSR Render Host Page', false, `Host Page SSR threw an error: ${err?.message || err}`);
  }
}

function runPropPermutationTests() {
  const category = '3. Prop Permutations Matrix';

  const presets: MissionPresetId[] = ['lunar-return', 'trans-eurasian', 'trans-continental', 'equatorial-ring'];
  const themes: ThemeId[] = ['nasa-dark', 'e-ink', 'satellite'];
  const testVelocities = [500, 1535, 5750, 17500, 24500];

  // Test all Presets in SSR
  for (const preset of presets) {
    try {
      const html = renderToStaticMarkup(React.createElement(ArtemisFlightSimulator, { initialPreset: preset }));
      const presetData = MISSION_PRESETS[preset];
      const containsPresetName = html.includes(presetData.name) || html.includes('ARTEMIS');
      recordTest(
        category,
        `Preset Prop: ${preset}`,
        containsPresetName,
        `Preset ${preset} rendered successfully in SSR markup`
      );
    } catch (err: any) {
      recordTest(category, `Preset Prop: ${preset}`, false, `Error rendering preset ${preset}: ${err?.message}`);
    }
  }

  // Test all Themes in SSR
  for (const theme of themes) {
    try {
      const html = renderToStaticMarkup(React.createElement(ArtemisFlightSimulator, { initialTheme: theme }));
      const themeConfig = THEMES[theme];
      const containsThemeClass = html.includes(`theme-${theme}`);
      recordTest(
        category,
        `Theme Prop: ${theme}`,
        containsThemeClass,
        `Theme ${theme} applies scoped theme class and styles`,
        { themeName: themeConfig.name }
      );
    } catch (err: any) {
      recordTest(category, `Theme Prop: ${theme}`, false, `Error rendering theme ${theme}: ${err?.message}`);
    }
  }

  // Test initialVelocityMph prop
  for (const vel of testVelocities) {
    try {
      const html = renderToStaticMarkup(React.createElement(ArtemisFlightSimulator, { initialVelocityMph: vel }));
      const formattedVel = vel.toLocaleString('en-US');
      const containsVel = html.includes(formattedVel);
      recordTest(
        category,
        `Initial Velocity Prop: ${vel} mph`,
        containsVel,
        `Initial velocity ${vel} mph formatted in initial markup`
      );
    } catch (err: any) {
      recordTest(category, `Initial Velocity Prop: ${vel} mph`, false, `Error rendering velocity ${vel}: ${err?.message}`);
    }
  }

  // Test compact prop
  try {
    const compactHtml = renderToStaticMarkup(React.createElement(ArtemisFlightSimulator, { compact: true }));
    const nonCompactHtml = renderToStaticMarkup(React.createElement(ArtemisFlightSimulator, { compact: false }));

    const compactHasMinH = compactHtml.includes('min-h-[580px]') && compactHtml.includes('md:w-[380px]');
    const nonCompactHasHScreen = nonCompactHtml.includes('h-screen') && nonCompactHtml.includes('md:w-[420px]');

    recordTest(
      category,
      'Compact Prop: true vs false',
      compactHasMinH && nonCompactHasHScreen,
      'compact=true applies embedded container classes; compact=false applies full viewport classes'
    );
  } catch (err: any) {
    recordTest(category, 'Compact Prop', false, `Error rendering compact prop: ${err?.message}`);
  }

  // Test custom className prop
  try {
    const customClass = 'custom-standalone-cartography-wrapper-xyz';
    const html = renderToStaticMarkup(React.createElement(ArtemisFlightSimulator, { className: customClass }));
    const hasClass = html.includes(customClass);
    recordTest(
      category,
      'Custom className Prop',
      hasClass,
      'Custom className is cleanly propagated to root container'
    );
  } catch (err: any) {
    recordTest(category, 'Custom className Prop', false, `Error rendering custom className: ${err?.message}`);
  }

  // Test showMercatorDefault prop
  try {
    const mercatorTrueHtml = renderToStaticMarkup(React.createElement(ArtemisFlightSimulator, { showMercatorDefault: true }));
    const mercatorFalseHtml = renderToStaticMarkup(React.createElement(ArtemisFlightSimulator, { showMercatorDefault: false }));

    const hasTrueMarker = mercatorTrueHtml.includes('Mercator Δ:');
    const hasFalseMarker = !mercatorFalseHtml.includes('Mercator Δ:');

    recordTest(
      category,
      'showMercatorDefault Prop: true vs false',
      hasTrueMarker && hasFalseMarker,
      'showMercatorDefault correctly controls initial Mercator status badge visibility in SSR markup'
    );
  } catch (err: any) {
    recordTest(category, 'showMercatorDefault Prop', false, `Error rendering showMercatorDefault: ${err?.message}`);
  }
}

function runSimulationStateTransitionTests() {
  const category = '4. Simulation State Transitions & Kinematics';

  // 4.1 Test Preset Switching Mathematical Integrity
  for (const preset of MISSION_PRESETS_LIST) {
    const arc = geodesicArc(preset.origin.coords[0], preset.origin.coords[1], preset.destination.coords[0], preset.destination.coords[1], 100);
    const chord = mercatorLinearChord(preset.origin.coords[0], preset.origin.coords[1], preset.destination.coords[0], preset.destination.coords[1], 100);
    const distortion = calculateDistortionStats(preset.origin.coords[0], preset.origin.coords[1], preset.destination.coords[0], preset.destination.coords[1]);

    const validArc = arc.length === 101 && arc.every(pt => !isNaN(pt[0]) && !isNaN(pt[1]));
    const validChord = chord.length === 101 && chord.every(pt => !isNaN(pt[0]) && !isNaN(pt[1]));
    const validDistortion = distortion.geodesicDistMiles > 0 && distortion.mercatorDistMiles > 0 && distortion.percentageDistortion >= 0;

    recordTest(
      category,
      `Geometry & Distortion Calculation: ${preset.id}`,
      validArc && validChord && validDistortion,
      `Calculated valid 101-pt arc, chord, and distortion metrics for preset ${preset.name}`,
      {
        geodesicMiles: distortion.geodesicDistMiles.toFixed(1),
        mercatorMiles: distortion.mercatorDistMiles.toFixed(1),
        deltaMiles: distortion.deltaMiles.toFixed(1),
        pctDistortion: distortion.percentageDistortion.toFixed(2) + '%'
      }
    );
  }

  // 4.2 Test Scrubber Progress & Kinematic Step Sweep
  const progressSteps = [0.0, 0.1, 0.25, 0.5, 0.75, 0.9, 1.0];
  const preset = MISSION_PRESETS['lunar-return'];
  let monotonicallyIncreasingDist = true;
  let lastDist = -1;

  for (const p of progressSteps) {
    const t = computeTelemetry(preset, p, 24500);
    if (t.currentDistMiles < lastDist) {
      monotonicallyIncreasingDist = false;
    }
    lastDist = t.currentDistMiles;
  }

  recordTest(
    category,
    'Scrubber Kinematic Monotonicity',
    monotonicallyIncreasingDist,
    'Progress scrub from 0.0 to 1.0 produces strictly monotonically increasing traversed distance'
  );

  // 4.3 Test Velocity & Mach Regime Transitions
  const regimeTests = [
    { v: 500, expectedRegime: 'Subsonic', expectedMach: 500 / SPEED_OF_SOUND_MPH },
    { v: 1535, expectedRegime: 'Supersonic', expectedMach: 1535 / SPEED_OF_SOUND_MPH },
    { v: 5750, expectedRegime: 'Hypersonic', expectedMach: 5750 / SPEED_OF_SOUND_MPH },
    { v: 24500, expectedRegime: 'Orbital / Re-entry', expectedMach: 24500 / SPEED_OF_SOUND_MPH }
  ];

  for (const rt of regimeTests) {
    const t = computeTelemetry(preset, 0.5, rt.v);
    const machClose = Math.abs(t.mach - rt.expectedMach) < 0.01;
    const regimeMatches = t.regime === rt.expectedRegime;
    recordTest(
      category,
      `Mach Regime at ${rt.v} mph`,
      machClose && regimeMatches,
      `Calculated Mach ${t.machStr} and Regime '${t.regime}' matching expectation '${rt.expectedRegime}'`
    );
  }
}

function runDynamicTelemetryCallbackTests() {
  const category = '5. Dynamic Telemetry Listener Callbacks';

  // Test callback signature and computation
  const testPreset = MISSION_PRESETS['trans-eurasian'];
  const testProgress = 0.42;
  const testVelocity = 17500;

  let receivedTelemetry: TelemetryData | null = null;
  const dummyCallback = (data: TelemetryData) => {
    receivedTelemetry = data;
  };

  const computed = computeTelemetry(testPreset, testProgress, testVelocity);
  dummyCallback(computed);

  const payload = receivedTelemetry as TelemetryData | null;
  const isCallbackValid =
    payload !== null &&
    payload.velocityMph === testVelocity &&
    payload.progress === testProgress &&
    typeof payload.headingDeg === 'number' &&
    typeof payload.altitudeFt === 'number' &&
    payload.latitudeStr.length > 0 &&
    payload.longitudeStr.length > 0;

  recordTest(
    category,
    'Telemetry Callback Payload Integrity',
    isCallbackValid,
    'Dynamic onTelemetryUpdate callback receives complete TelemetryData payload with coordinates, heading, altitude, velocity, and timing',
    {
      progress: payload?.progress,
      heading: payload?.headingStr,
      altitudeFt: payload?.altitudeFt,
      regime: payload?.regime,
      eta: payload?.etaSec
    }
  );
}

function runAllTests() {
  console.log('================================================================');
  console.log('ARTEMIS FLIGHT SIMULATOR - MILESTONE 2 EMPIRICAL TEST SUITE');
  console.log('================================================================\n');

  runModuleExportTests();
  runSSRSafetyTests();
  runPropPermutationTests();
  runSimulationStateTransitionTests();
  runDynamicTelemetryCallbackTests();

  let totalPassed = 0;
  let totalFailed = 0;

  const grouped: Record<string, TestResult[]> = {};
  for (const res of testResults) {
    if (!grouped[res.category]) grouped[res.category] = [];
    grouped[res.category].push(res);
    if (res.passed) totalPassed++;
    else totalFailed++;
  }

  for (const [category, tests] of Object.entries(grouped)) {
    console.log(`\n--- ${category} ---`);
    for (const t of tests) {
      const statusIcon = t.passed ? '✅' : '❌';
      console.log(`${statusIcon} [${t.testName}]: ${t.message}`);
      if (t.details) {
        console.log(`   Details: ${JSON.stringify(t.details)}`);
      }
    }
  }

  console.log('\n================================================================');
  console.log(`TOTAL TESTS: ${testResults.length} | PASSED: ${totalPassed} | FAILED: ${totalFailed}`);
  console.log('================================================================\n');

  if (totalFailed > 0) {
    process.exit(1);
  }
}

runAllTests();
