window.__studio_markers = {};

const engine = {
  createCursor() {
    if (document.getElementById('__studio_cursor')) return;
    const cursor = document.createElement('div');
    cursor.id = '__studio_cursor';
    cursor.style.position = 'fixed';
    cursor.style.width = '24px';
    cursor.style.height = '24px';
    cursor.style.borderRadius = '50%';
    cursor.style.backgroundColor = 'rgba(0, 0, 0, 0.75)';
    cursor.style.border = '3px solid white';
    cursor.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
    cursor.style.pointerEvents = 'none';
    cursor.style.zIndex = '9999999';
    cursor.style.transform = 'translate(-50%, -50%)';
    cursor.style.transition = 'transform 0.1s ease';
    document.body.appendChild(cursor);
    this.cursor = cursor;
    this.x = 200;
    this.y = 200;
    this.updateCursor();
  },
  updateCursor() {
    if (this.cursor) {
      this.cursor.style.left = this.x + 'px';
      this.cursor.style.top = this.y + 'px';
    }
  },
  async move(destX, destY, duration = 600) {
    const startX = this.x;
    const startY = this.y;
    const startTime = performance.now();
    
    return new Promise(resolve => {
      const step = (time) => {
        const elapsed = time - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 0.5 - Math.cos(progress * Math.PI) / 2;
        this.x = startX + (destX - startX) * ease;
        this.y = startY + (destY - startY) * ease;
        this.updateCursor();
        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          resolve();
        }
      };
      requestAnimationFrame(step);
    });
  },
  async click(el) {
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    await this.move(cx, cy, 500);
    
    if (this.cursor) {
      this.cursor.style.transform = 'translate(-50%, -50%) scale(0.8)';
    }
    
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: cx, clientY: cy, pointerId: 1, pressure: 0.5, buttons: 1, pointerType: 'mouse' }));
    await this.wait(60);
    el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, clientX: cx, clientY: cy, pointerId: 1, pressure: 0, buttons: 0, pointerType: 'mouse' }));
    
    // React 19 synthetic trigger
    const btn = el.closest('button') || el;
    btn.click();
    
    if (this.cursor) {
      this.cursor.style.transform = 'translate(-50%, -50%) scale(1.0)';
    }
    await this.wait(100);
  },
  async setSlider(el, targetVal, duration = 800) {
    const rect = el.getBoundingClientRect();
    const min = parseFloat(el.min || 1);
    const max = parseFloat(el.max || 100);
    const startVal = parseFloat(el.value || min);
    
    const startX = rect.left + ((startVal - min) / (max - min)) * rect.width;
    const startY = rect.top + rect.height / 2;
    await this.move(startX, startY, 400);
    
    const targetX = rect.left + ((targetVal - min) / (max - min)) * rect.width;
    const startTime = performance.now();
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    
    return new Promise(resolve => {
      const step = (time) => {
        const elapsed = time - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = 0.5 - Math.cos(progress * Math.PI) / 2;
        const curVal = Math.round(startVal + (targetVal - startVal) * ease);
        
        this.x = startX + (targetX - startX) * ease;
        this.y = startY;
        this.updateCursor();
        
        nativeSetter.call(el, curVal);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        
        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          resolve();
        }
      };
      requestAnimationFrame(step);
    });
  },
  async setSelect(el, value) {
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    await this.move(cx, cy, 400);
    
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
    nativeSetter.call(el, value);
    el.dispatchEvent(new Event('change', { bubbles: true }));
    await this.wait(300);
  },
  wait(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
};

window.__studio_capture_run = async function() {
  console.log('--- STARTING STUDIO CAPTURE SCRIPT ---');
  
  // Wait for map tiles to load
  await new Promise(r => setTimeout(r, 1200));
  engine.createCursor();
  
  // 1. Scene 1: Establishing (NYC -> SF pre-launch overview & set speed to 30x)
  window.__studio_markers.scene_1_establishing_start = Date.now();
  const slider = document.querySelector('input[type="range"]');
  await engine.setSlider(slider, 30, 800);
  await engine.wait(600);
  window.__studio_markers.scene_1_establishing_end = Date.now();
  
  // 2. Scene 2: Rising (Launch NYC -> SF flight across USA)
  window.__studio_markers.scene_2_rising_start = Date.now();
  const launchBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('LAUNCH'));
  if (launchBtn) {
    await engine.click(launchBtn);
  }
  // Let flight run at 30x speed (total flight ~3.6s)
  await engine.wait(3800);
  window.__studio_markers.scene_2_rising_end = Date.now();
  
  // 3. Scene 3: Climax (Switch to London -> Tokyo, speed to 55x, launch transcontinental race)
  window.__studio_markers.scene_3_climax_start = Date.now();
  const select = document.querySelector('select');
  if (select) {
    await engine.setSelect(select, 'London to Tokyo');
  }
  await engine.wait(600);
  
  await engine.setSlider(slider, 55, 700);
  await engine.wait(400);
  
  const launchBtn2 = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('LAUNCH'));
  if (launchBtn2) {
    await engine.click(launchBtn2);
  }
  
  // Let transcontinental flight race across Eurasia (at 55x, takes ~5.2s)
  await engine.wait(5200);
  window.__studio_markers.scene_3_climax_end = Date.now();
  
  // 4. Scene 4: Cooldown (Arrival & final telemetry inspection)
  window.__studio_markers.scene_4_cooldown_start = Date.now();
  // Move cursor gracefully over telemetry HUD
  await engine.move(160, 450, 800);
  await engine.wait(800);
  window.__studio_markers.scene_4_cooldown_end = Date.now();
  
  console.log('--- STUDIO CAPTURE SCRIPT COMPLETE ---', window.__studio_markers);
};
