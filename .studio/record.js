/**
 * Studio Playwright Recording Script for ais-artemis-velocity-vis
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function main() {
  const studioDir = __dirname;
  const recordingsDir = path.join(studioDir, 'tmp', 'recordings');
  fs.mkdirSync(recordingsDir, { recursive: true });

  console.log('[RECORD] Launching Chromium browser...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    recordVideo: {
      dir: recordingsDir,
      size: { width: 1920, height: 1080 }
    }
  });

  const video_start_epoch_ms = Date.now();
  console.log(`[RECORD] Video start epoch recorded: ${video_start_epoch_ms}`);

  const page = await context.newPage();

  // Pipe console messages
  page.on('console', msg => console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`));
  page.on('pageerror', err => console.error(`[BROWSER ERROR] ${err}`));

  console.log('[RECORD] Navigating to http://localhost:3000 ...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  // Ensure Leaflet map is mounted
  await page.waitForSelector('.leaflet-container', { timeout: 15000 });
  await page.waitForTimeout(800);

  console.log('[RECORD] Evaluating capture_script.js ...');
  const captureScriptContent = fs.readFileSync(path.join(studioDir, 'capture_script.js'), 'utf-8');
  
  await page.evaluate(captureScriptContent);

  const markers = await page.evaluate(() => window.__studio_markers || []);
  console.log(`[RECORD] Capture complete. Captured ${markers.length} markers:`, markers);

  // Short buffer for clean tail frame
  await page.waitForTimeout(500);

  const video = page.video();
  await page.close();
  await context.close();
  await browser.close();

  if (!video) {
    throw new Error('Playwright video recording object not found');
  }

  const rawVideoPath = await video.path();
  console.log(`[RECORD] Raw video recorded at: ${rawVideoPath}`);

  // Formulate unified capture_timeline.json
  const timeline = {
    video_start_epoch_ms: video_start_epoch_ms,
    recording_file: '.studio/raw_screencast.webm',
    total_scenes: 5,
    target_duration_sec: 25.0,
    markers: markers
  };

  const timelinePath = path.join(studioDir, 'capture_timeline.json');
  fs.writeFileSync(timelinePath, JSON.stringify(timeline, null, 2));
  console.log(`[RECORD] Saved capture timeline to ${timelinePath}`);

  // Copy/move video to destination .studio/raw_screencast.webm
  const finalWebmPath = path.join(studioDir, 'raw_screencast.webm');
  fs.copyFileSync(rawVideoPath, finalWebmPath);
  console.log(`[RECORD] Saved final raw screencast to ${finalWebmPath}`);

  const stat = fs.statSync(finalWebmPath);
  console.log(`[RECORD] Output file size: ${(stat.size / (1024 * 1024)).toFixed(2)} MB`);
}

main().catch(err => {
  console.error('[RECORD FAILED]', err);
  process.exit(1);
});
