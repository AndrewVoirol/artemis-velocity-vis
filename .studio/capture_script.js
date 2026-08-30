/**
 * Studio Synthetic Capture Script for ais-artemis-velocity-vis
 * Implements StudioInteractionEngine with visual cursor, scene epoch markers,
 * and robust React 19 synthetic event dispatchers.
 */

(async function runCapture() {
  window.__studio_markers = [];
  
  function addMarker(name) {
    const marker = {
      name: name,
      time: Date.now()
    };
    window.__studio_markers.push(marker);
    console.log(`[STUDIO MARKER] ${name} @ ${marker.time}`);
    return marker;
  }

  // --- Visual Cursor & Interaction Engine ---
  class StudioInteractionEngine {
    constructor() {
      this.cursorX = 960;
      this.cursorY = 540;
      this.cursorEl = null;
      this.dotEl = null;
      this.initCursor();
    }

    initCursor() {
      if (document.getElementById('__studio_cursor')) {
        this.cursorEl = document.getElementById('__studio_cursor');
        this.dotEl = document.getElementById('__studio_cursor_dot');
        return;
      }

      const container = document.createElement('div');
      container.id = '__studio_cursor';
      container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 24px;
        height: 24px;
        z-index: 9999999;
        pointer-events: none;
        transform: translate(${this.cursorX}px, ${this.cursorY}px);
        transition: transform 0.04s linear;
        will-change: transform;
      `;

      container.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.35));">
          <path d="M5.5 3.5l13 7.5-6.5 1.5-3 5.5-3.5-14.5z" fill="#000000" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round"/>
        </svg>
        <div id="__studio_cursor_dot" style="
          position: absolute;
          top: 3px;
          left: 5px;
          width: 10px;
          height: 10px;
          background: rgba(0, 0, 0, 0.8);
          border-radius: 50%;
          transform: translate(-50%, -50%) scale(0);
          transition: transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        "></div>
      `;

      document.body.appendChild(container);
      this.cursorEl = container;
      this.dotEl = document.getElementById('__studio_cursor_dot');
    }

    updateCursor(x, y) {
      this.cursorX = x;
      this.cursorY = y;
      if (this.cursorEl) {
        this.cursorEl.style.transform = `translate(${x}px, ${y}px)`;
      }
    }

    async sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    async waitForSelector(selector, timeoutMs = 10000) {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const el = document.querySelector(selector);
        if (el) return el;
        await this.sleep(100);
      }
      throw new Error(`Timeout waiting for selector: ${selector}`);
    }

    resolveTarget(target) {
      if (typeof target === 'string') {
        const el = document.querySelector(target);
        if (el) return el;
        // Text fallback
        const all = Array.from(document.querySelectorAll('*'));
        for (const candidate of all) {
          if (candidate.children.length === 0 && candidate.textContent && candidate.textContent.includes(target)) {
            return candidate;
          }
        }
      } else if (target && target.type) {
        if (target.type === 'css') {
          if (target.value.includes(':has-text(')) {
            const match = target.value.match(/^(.*?):has-text\("(.*?)"\)$/);
            if (match) {
              const [_, tag, text] = match;
              const elements = Array.from(document.querySelectorAll(tag || '*'));
              for (const el of elements) {
                if (el.textContent && el.textContent.includes(text)) {
                  return el;
                }
              }
            }
          }
          return document.querySelector(target.value);
        } else if (target.type === 'text') {
          const all = Array.from(document.querySelectorAll('*'));
          for (const candidate of all) {
            if (candidate.children.length === 0 && candidate.textContent && candidate.textContent.includes(target.value)) {
              return candidate;
            }
          }
          // Check buttons or headings
          for (const candidate of all) {
            if (candidate.textContent && candidate.textContent.includes(target.value)) {
              return candidate;
            }
          }
        } else if (target.type === 'coords') {
          return { x: target.x, y: target.y };
        }
      }
      return null;
    }

    getCoordinates(target) {
      if (!target) return { x: this.cursorX, y: this.cursorY };
      if (typeof target.x === 'number' && typeof target.y === 'number') {
        return target;
      }
      const el = this.resolveTarget(target);
      if (el && typeof el.getBoundingClientRect === 'function') {
        const rect = el.getBoundingClientRect();
        return {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2
        };
      }
      return { x: this.cursorX, y: this.cursorY };
    }

    async moveTo(target, durationMs = 500) {
      const dest = this.getCoordinates(target);
      const startX = this.cursorX;
      const startY = this.cursorY;
      const startTime = performance.now();

      return new Promise(resolve => {
        const step = (now) => {
          const elapsed = now - startTime;
          const progress = Math.min(elapsed / durationMs, 1);
          // Ease in out quad
          const ease = progress < 0.5 
            ? 2 * progress * progress 
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;

          const curX = startX + (dest.x - startX) * ease;
          const curY = startY + (dest.y - startY) * ease;
          this.updateCursor(curX, curY);

          if (progress < 1) {
            requestAnimationFrame(step);
          } else {
            this.updateCursor(dest.x, dest.y);
            resolve();
          }
        };
        requestAnimationFrame(step);
      });
    }

    async click(target, moveDurationMs = 500) {
      const el = this.resolveTarget(target);
      await this.moveTo(target, moveDurationMs);

      // Visual click ripple / down
      if (this.dotEl) {
        this.dotEl.style.transform = 'translate(-50%, -50%) scale(2.2)';
      }
      await this.sleep(80);

      if (el) {
        const rect = el.getBoundingClientRect ? el.getBoundingClientRect() : { left: this.cursorX, top: this.cursorY };
        const x = rect.left + (rect.width ? rect.width / 2 : 0);
        const y = rect.top + (rect.height ? rect.height / 2 : 0);

        const pointerDown = new PointerEvent('pointerdown', {
          bubbles: true,
          cancelable: true,
          pointerId: 1,
          pointerType: 'mouse',
          isPrimary: true,
          button: 0,
          buttons: 1,
          clientX: x,
          clientY: y
        });
        const mouseDown = new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          button: 0,
          buttons: 1,
          clientX: x,
          clientY: y
        });
        const pointerUp = new PointerEvent('pointerup', {
          bubbles: true,
          cancelable: true,
          pointerId: 1,
          pointerType: 'mouse',
          isPrimary: true,
          button: 0,
          buttons: 0,
          clientX: x,
          clientY: y
        });
        const mouseUp = new MouseEvent('mouseup', {
          bubbles: true,
          cancelable: true,
          button: 0,
          buttons: 0,
          clientX: x,
          clientY: y
        });
        const clickEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          button: 0,
          buttons: 0,
          clientX: x,
          clientY: y
        });

        el.dispatchEvent(pointerDown);
        el.dispatchEvent(mouseDown);
        el.dispatchEvent(pointerUp);
        el.dispatchEvent(mouseUp);
        el.dispatchEvent(clickEvent);
        if (typeof el.click === 'function') {
          el.click();
        }
      }

      await this.sleep(80);
      if (this.dotEl) {
        this.dotEl.style.transform = 'translate(-50%, -50%) scale(0)';
      }
      await this.sleep(50);
    }

    async setSliderValue(target, value, durationMs = 400) {
      const slider = this.resolveTarget(target) || document.querySelector('input[type="range"]');
      if (!slider) throw new Error('Slider element not found');

      await this.moveTo(slider, durationMs);
      
      // Use prototype setter to trigger React 19 state updater
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeInputValueSetter.call(slider, value);
      
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      slider.dispatchEvent(new Event('change', { bubbles: true }));
      await this.sleep(100);
    }

    async selectOption(target, value, durationMs = 400) {
      const select = this.resolveTarget(target) || document.querySelector('select');
      if (!select) throw new Error('Select element not found');

      await this.moveTo(select, durationMs);
      
      // Native select setter for React
      const nativeSelectValueSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
      nativeSelectValueSetter.call(select, value);

      select.dispatchEvent(new Event('input', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));
      await this.sleep(100);
    }
  }

  const engine = new StudioInteractionEngine();

  // Ensure render loop / map is ready
  await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 500)));
  await engine.waitForSelector('.leaflet-container', 10000);

  // ==========================================
  // SCENE 1: Initial Idle & Pre-Launch (3.0s)
  // ==========================================
  addMarker('scene_01_initial_idle_start');
  const s1Start = Date.now();

  await engine.moveTo({ type: 'text', value: 'ARTEMIS' }, 600);
  await engine.sleep(200);
  await engine.moveTo({ type: 'css', value: 'input[type="range"]' }, 600);
  await engine.setSliderValue({ type: 'css', value: 'input[type="range"]' }, 35, 300);
  await engine.moveTo({ type: 'css', value: 'button:has-text("LAUNCH")' }, 500);

  const s1Elapsed = Date.now() - s1Start;
  if (s1Elapsed < 3000) {
    await engine.sleep(3000 - s1Elapsed);
  }
  addMarker('scene_01_initial_idle_end');

  // ==========================================
  // SCENE 2: NYC to SF Flight Climax (10.8s)
  // ==========================================
  addMarker('scene_02_nyc_sf_flight_start');
  const s2Start = Date.now();

  // Click LAUNCH
  await engine.click({ type: 'css', value: 'button:has-text("LAUNCH")' }, 200);
  await engine.moveTo({ type: 'text', value: 'Telemetry' }, 700);

  // Flight duration at 35x is 10.8s (2572 mi / 238.2 mi/s)
  const s2TargetMs = 10800;
  const s2Remaining = s2TargetMs - (Date.now() - s2Start);
  if (s2Remaining > 0) {
    await engine.sleep(s2Remaining);
  }
  addMarker('scene_02_nyc_sf_flight_end');

  // ==========================================
  // SCENE 3: Route Switch to London-Tokyo (3.2s)
  // ==========================================
  addMarker('scene_03_route_switch_london_tokyo_start');
  const s3Start = Date.now();

  await engine.moveTo({ type: 'css', value: 'select' }, 600);
  await engine.selectOption({ type: 'css', value: 'select' }, 'London to Tokyo', 300);
  await engine.sleep(300);
  await engine.moveTo({ type: 'css', value: 'input[type="range"]' }, 500);
  await engine.setSliderValue({ type: 'css', value: 'input[type="range"]' }, 50, 300);
  await engine.moveTo({ type: 'css', value: 'button:has-text("LAUNCH")' }, 500);

  const s3Elapsed = Date.now() - s3Start;
  if (s3Elapsed < 3200) {
    await engine.sleep(3200 - s3Elapsed);
  }
  addMarker('scene_03_route_switch_london_tokyo_end');

  // ==========================================
  // SCENE 4: London to Tokyo Flight (6.0s)
  // ==========================================
  addMarker('scene_04_london_tokyo_flight_start');
  const s4Start = Date.now();

  // Click LAUNCH for London-Tokyo at 50x speed
  await engine.click({ type: 'css', value: 'button:has-text("LAUNCH")' }, 200);
  await engine.moveTo({ type: 'text', value: 'Speed' }, 700);

  const s4TargetMs = 6000;
  const s4Remaining = s4TargetMs - (Date.now() - s4Start);
  if (s4Remaining > 0) {
    await engine.sleep(s4Remaining);
  }
  addMarker('scene_04_london_tokyo_flight_end');

  // ==========================================
  // SCENE 5: Final Telemetry Hold (2.0s)
  // ==========================================
  addMarker('scene_05_telemetry_hold_start');
  const s5Start = Date.now();

  await engine.moveTo({ type: 'text', value: 'Telemetry' }, 500);

  const s5TargetMs = 2000;
  const s5Remaining = s5TargetMs - (Date.now() - s5Start);
  if (s5Remaining > 0) {
    await engine.sleep(s5Remaining);
  }
  addMarker('scene_05_telemetry_hold_end');

  console.log('[STUDIO CAPTURE] All 5 scenes completed successfully.');
  return window.__studio_markers;
})();
