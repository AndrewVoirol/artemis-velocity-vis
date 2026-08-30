const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    recordVideo: {
      dir: path.join(__dirname, 'tmp'),
      size: { width: 1920, height: 1080 }
    },
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();
  const video_start_epoch_ms = Date.now();
  
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');

  const captureScript = fs.readFileSync(path.join(__dirname, 'capture_script.js'), 'utf8');
  await page.evaluate(captureScript);
  await page.evaluate(() => window.__studio_capture_run());
  
  const rawMarkers = await page.evaluate(() => window.__studio_markers);
  
  await page.waitForTimeout(500);
  await context.close();
  await browser.close();
  
  // Find the generated webm
  const tmpDir = path.join(__dirname, 'tmp');
  const files = fs.readdirSync(tmpDir).filter(f => f.endsWith('.webm'));
  if (files.length > 0) {
    fs.renameSync(path.join(tmpDir, files[0]), path.join(__dirname, 'raw_screencast.webm'));
  }
  
  const markerArray = Object.entries(rawMarkers || {}).map(([name, time]) => ({
    name,
    time: typeof time === 'number' ? time : Date.now()
  }));

  const timeline = {
    video_start_epoch_ms,
    markers: markerArray
  };
  fs.writeFileSync(path.join(__dirname, 'capture_timeline.json'), JSON.stringify(timeline, null, 2));
  console.log('Capture recorded successfully, markers:', markerArray);
})();
