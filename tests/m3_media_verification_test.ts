import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const WORKSPACE_DIR = process.cwd();
const SCREENSHOTS_DIR = path.join(WORKSPACE_DIR, 'screenshots');
const DELIVERABLES_DIR = path.join(WORKSPACE_DIR, 'deliverables');

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  actual: any;
  expected: any;
  error?: string;
}

const results: TestResult[] = [];

function assert(suite: string, name: string, condition: boolean, actual: any, expected: any) {
  results.push({
    suite,
    name,
    passed: condition,
    actual,
    expected
  });
  const symbol = condition ? '✅ [PASS]' : '❌ [FAIL]';
  console.log(`${symbol} [${suite}] ${name}`);
  if (!condition) {
    console.error(`   Actual:   ${JSON.stringify(actual)}`);
    console.error(`   Expected: ${JSON.stringify(expected)}`);
  }
}

function getImageDimensions(filePath: string): { width: number; height: number } {
  const json = JSON.parse(
    execSync(`ffprobe -v error -show_entries stream=width,height -of json "${filePath}"`, { encoding: 'utf-8' })
  );
  return {
    width: json.streams?.[0]?.width || 0,
    height: json.streams?.[0]?.height || 0
  };
}

function getVideoMetadata(filePath: string): { width: number; height: number; duration: number; codec: string; size: number } {
  const json = JSON.parse(
    execSync(`ffprobe -v error -show_entries format=duration,size -show_entries stream=width,height,codec_name -of json "${filePath}"`, { encoding: 'utf-8' })
  );
  return {
    width: json.streams?.[0]?.width || 0,
    height: json.streams?.[0]?.height || 0,
    duration: parseFloat(json.format?.duration || '0'),
    codec: json.streams?.[0]?.codec_name || '',
    size: parseInt(json.format?.size || '0', 10)
  };
}

function calculateSsim(file1: string, file2: string): number {
  const out = execSync(`ffmpeg -i "${file1}" -i "${file2}" -lavfi "ssim" -f null - 2>&1`, { encoding: 'utf-8' });
  const match = out.match(/All:([0-9.]+)/);
  return match ? parseFloat(match[1]) : 1.0;
}

console.log('================================================================');
console.log('ARTEMIS VELOCITY VIS - M3 MEDIA DELIVERABLES AUDIT SUITE');
console.log('================================================================\n');

// Suite 1: Hero Screenshots Verification
console.log('--- Suite 1: Hero Screenshots (1920x1080) ---');
const heroShots = [
  'artemis-reentry-telemetry.png',
  'artemis-london-tokyo-geodesic.png',
  'artemis-mission-control-dark.png',
  'artemis-geodesic-vs-mercator.png'
];

for (const shot of heroShots) {
  const shotPath = path.join(SCREENSHOTS_DIR, shot);
  const exists = fs.existsSync(shotPath);
  assert('Hero Screenshots', `${shot} exists`, exists, exists, true);

  if (exists) {
    const size = fs.statSync(shotPath).size;
    assert('Hero Screenshots', `${shot} non-empty (>50KB)`, size > 50000, `${(size / 1024).toFixed(1)} KB`, '> 50 KB');

    const dims = getImageDimensions(shotPath);
    assert('Hero Screenshots', `${shot} 1920x1080 resolution`, dims.width === 1920 && dims.height === 1080, `${dims.width}x${dims.height}`, '1920x1080');
  }
}

// Suite 2: Video Deliverable Verification (demo.mp4)
console.log('\n--- Suite 2: Motion Showcase Video (demo.mp4) ---');
const mp4Path = path.join(DELIVERABLES_DIR, 'demo.mp4');
const mp4Exists = fs.existsSync(mp4Path);
assert('Video Deliverables', 'demo.mp4 exists', mp4Exists, mp4Exists, true);

if (mp4Exists) {
  const meta = getVideoMetadata(mp4Path);
  assert('Video Deliverables', 'demo.mp4 size <= 10.0 MB', meta.size <= 10 * 1024 * 1024, `${(meta.size / (1024 * 1024)).toFixed(2)} MB`, '<= 10.0 MB');
  assert('Video Deliverables', 'demo.mp4 duration >= 5.0 seconds', meta.duration >= 5.0, `${meta.duration.toFixed(2)}s`, '>= 5.0s');
  assert('Video Deliverables', 'demo.mp4 H.264 video codec', meta.codec === 'h264', meta.codec, 'h264');
  assert('Video Deliverables', 'demo.mp4 1920x1080 resolution', meta.width === 1920 && meta.height === 1080, `${meta.width}x${meta.height}`, '1920x1080');
}

// Suite 3: Animated WebP & GIF Deliverables
console.log('\n--- Suite 3: Animated WebP & GIF Deliverables ---');
const delivWebpPath = path.join(DELIVERABLES_DIR, 'demo.webp');
const delivWebpExists = fs.existsSync(delivWebpPath);
assert('Animated WebP', 'deliverables/demo.webp exists', delivWebpExists, delivWebpExists, true);
if (delivWebpExists) {
  const size = fs.statSync(delivWebpPath).size;
  assert('Animated WebP', 'deliverables/demo.webp size <= 3.0 MB', size <= 3.0 * 1024 * 1024, `${(size / (1024 * 1024)).toFixed(2)} MB`, '<= 3.0 MB');
}

const screenWebpPath = path.join(SCREENSHOTS_DIR, 'demo.webp');
const screenWebpExists = fs.existsSync(screenWebpPath);
assert('Animated WebP', 'screenshots/demo.webp exists', screenWebpExists, screenWebpExists, true);
if (screenWebpExists) {
  const size = fs.statSync(screenWebpPath).size;
  assert('Animated WebP', 'screenshots/demo.webp size <= 5.0 MB', size <= 5.0 * 1024 * 1024, `${(size / (1024 * 1024)).toFixed(2)} MB`, '<= 5.0 MB');
}

const gifPath = path.join(DELIVERABLES_DIR, 'demo.gif');
const gifExists = fs.existsSync(gifPath);
assert('GIF Deliverables', 'deliverables/demo.gif exists', gifExists, gifExists, true);
if (gifExists) {
  const size = fs.statSync(gifPath).size;
  assert('GIF Deliverables', 'deliverables/demo.gif size <= 5.0 MB', size <= 5.0 * 1024 * 1024, `${(size / (1024 * 1024)).toFixed(2)} MB`, '<= 5.0 MB');
}

// Suite 4: Hero WebP Deliverables
console.log('\n--- Suite 4: Hero WebP Deliverables ---');
const heroWebpPath = path.join(DELIVERABLES_DIR, 'hero.webp');
const heroWebpExists = fs.existsSync(heroWebpPath);
assert('Hero WebP', 'deliverables/hero.webp exists', heroWebpExists, heroWebpExists, true);
if (heroWebpExists) {
  const size = fs.statSync(heroWebpPath).size;
  assert('Hero WebP', 'deliverables/hero.webp size <= 200 KB', size <= 200 * 1024, `${(size / 1024).toFixed(1)} KB`, '<= 200 KB');
}

// Suite 5: Multi-Frame SSIM Visual Diversity Check
console.log('\n--- Suite 5: Multi-Frame SSIM Visual Diversity ---');
const ssim1 = calculateSsim(
  path.join(SCREENSHOTS_DIR, 'artemis-reentry-telemetry.png'),
  path.join(SCREENSHOTS_DIR, 'artemis-london-tokyo-geodesic.png')
);
const ssim2 = calculateSsim(
  path.join(SCREENSHOTS_DIR, 'artemis-london-tokyo-geodesic.png'),
  path.join(SCREENSHOTS_DIR, 'artemis-mission-control-dark.png')
);
const ssim3 = calculateSsim(
  path.join(SCREENSHOTS_DIR, 'artemis-mission-control-dark.png'),
  path.join(SCREENSHOTS_DIR, 'artemis-geodesic-vs-mercator.png')
);

assert('SSIM Diversity', 'Re-entry vs Eurasian SSIM < 0.97', ssim1 < 0.97, ssim1, '< 0.97');
assert('SSIM Diversity', 'Eurasian vs Continental SSIM < 0.97', ssim2 < 0.97, ssim2, '< 0.97');
assert('SSIM Diversity', 'Continental vs Distortion SSIM < 0.97', ssim3 < 0.97, ssim3, '< 0.97');

// Summary
const total = results.length;
const passed = results.filter(r => r.passed).length;
const failed = total - passed;

console.log('\n================================================================');
console.log(`M3 TEST SUMMARY: ${passed}/${total} PASSED (${failed} FAILED)`);
if (failed === 0) {
  console.log('🎉 ALL MILESTONE 3 MEDIA ASSETS FULLY VERIFIED & COMPLIANT!');
}
console.log('================================================================\n');

if (failed > 0) {
  process.exit(1);
}
