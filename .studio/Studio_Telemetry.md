# Studio Execution Telemetry Report: ais-artemis-velocity-vis

**Workspace**: `/Users/andrewvoirol/Antigravity/Projects/ais-artemis-velocity-vis`  
**Pipeline Mode**: `demo`  
**Execution Timestamp**: `2026-08-30T17:34:00Z`  
**Overall Pipeline Status**: `SUCCESS`

---

## 1. Application & Archetype Classification

- **Project Identifier**: `ais-artemis-velocity-vis`
- **Application Archetype**: `map_trajectory_simulation`
- **Demo Philosophy**: `physics_showcase`
- **Frontend Stack**: Next.js 15.4.9 (App Router) + React 19.2.1 + Tailwind CSS v4.1.11
- **Mapping & Geodesic Engine**: Leaflet 1.9.4 / `react-leaflet` 5.0.0 (DOM / SVG geodesic polylines, OpenStreetMap raster tiles)
- **Canvas / WebGL Requirement**: `hasCanvas: false`
- **Physics Solvers & Mathematical Models**:
  - Spherical Haversine Great Circle geodesic arc interpolation ($R = 3958.8\text{ mi}$, $N=101$ interpolation nodes)
  - Intermediate coordinate position interpolation along central angle $\delta$
  - `requestAnimationFrame` delta-time integration clock ($v = 24,500\text{ mph} = 6.806\text{ mi/s}$)
  - Dynamic Leaflet `MapUpdater` viewport auto-tracking (`map.panTo`)
- **Route Inventory**:
  1. `Coast to Coast (NYC to SF)`: $2,572.2\text{ mi}$ ($377.96\text{s}$ at 1x; $10.80\text{s}$ at 35x)
  2. `London to Tokyo`: $5,956.1\text{ mi}$ ($875.18\text{s}$ at 1x; $17.50\text{s}$ at 50x)
- **Key Visual States**:
  - **State A (Pre-Launch Idle)**: NYC $\to$ SF route selected, 0% progress, stationary spacecraft DivIcon at origin, LAUNCH button ready, continental US overview.
  - **State B (High-Speed In-Flight Telemetry)**: Spacecraft traversing geodesic arc at 25x–50x speed multiplier, live HUD telemetry updating distance/time/ETA in real-time, auto-panning map tracking spacecraft.

---

## 2. Execution Lifecycle & Timeline Breakdown

- **Capture Method**: Playwright synthetic record with `StudioInteractionEngine` and visual cursor overlay (`record.js` + `capture_script.js`)
- **Raw Screencast**: `.studio/raw_screencast.webm` (1920x1080 VP8, 3.95 MB, 29.88s duration)
- **Start Epoch**: `1788109161626` ms
- **Choreographic Execution Duration**: `25.013s` across 10 epoch markers
- **Output Master Cut Duration**: `25.20s` (Target: 25.00s, Delta: +0.20s $\to$ PASS)

### Scene Execution Matrix

| Scene ID | Scene Name | Start Epoch (ms) | End Epoch (ms) | Duration (s) | Wow Level | Narrative Purpose |
|---|---|---|---|---|---|---|
| `scene_01` | `scene_01_initial_idle` | `1788109165154` | `1788109168157` | 3.003 | Establishing | Pre-flight inspection of NYC to SF route, slider set to 35x. |
| `scene_02` | `scene_02_nyc_sf_flight` | `1788109168157` | `1788109178960` | 10.803 | Climax | Transcontinental flight across US, Leaflet auto-pan, SF arrival. |
| `scene_03` | `scene_03_route_switch_london_tokyo` | `1788109178960` | `1788109182163` | 3.203 | Rising | Route selector switched to London to Tokyo, bounds re-fit, slider to 50x. |
| `scene_04` | `scene_04_london_tokyo_flight` | `1788109182163` | `1788109188165` | 6.002 | Climax | High-speed flight across Europe and Asia with accelerating HUD metrics. |
| `scene_05` | `scene_05_telemetry_hold` | `1788109188165` | `1788109190167` | 2.002 | Cooldown | Mission telemetry hold and arrival in Tokyo. |

---

## 3. Deliverable Standards & Size Compliance

All deliverables were generated deterministically and strictly adhere to byte ceilings:

| Deliverable Asset | Target Specification | Actual Size (Bytes) | Formatted Size | Budget Ceiling | Margin | Status |
|---|---|---|---|---|---|---|
| `deliverables/demo.mp4` | 1920x1080 H.264 (CRF 22) | `9,584,476` | 9.14 MiB (9.58 MB) | $\le 10.0\text{ MB}$ (`10,485,760` B) | `-901,284` B (-8.6%) | **PASS** |
| `deliverables/demo.webp` | 640p 10fps Animated WebP | `2,865,334` | 2.73 MiB (2.87 MB) | $\le 3.0\text{ MB}$ (`3,145,728` B) | `-280,394` B (-8.9%) | **PASS** |
| `deliverables/demo.gif` | 400p 6fps 64-col Bayer GIF | `4,509,071` | 4.30 MiB (4.51 MB) | $\le 5.0\text{ MB}$ (`5,242,880` B) | `-733,809` B (-14.0%) | **PASS** |
| `deliverables/hero.webp` | 1920x1080 q85 WebP Image | `150,022` | 146.5 KiB (150.0 KB) | $\le 200.0\text{ KB}$ (`204,800` B) | `-54,778` B (-26.7%) | **PASS** |

*Note: Assets have also been synchronized to `screenshots/` for repository documentation.*

---

## 4. Multi-Frame SSIM & Deterministic Quality Verification

Deterministic verification executed via `scripts/validate_media.sh` and recorded in `.studio/validation.json`:

- **Multi-Frame SSIM Diversity** (Threshold: $< 0.97$ pairwise vs $f_0$):
  - $f_0 \text{ vs } f_{25\%}$: **`0.6634`** ($\Delta = -0.3066 \to \text{PASS}$)
  - $f_0 \text{ vs } f_{50\%}$: **`0.6921`** ($\Delta = -0.2779 \to \text{PASS}$)
  - $f_0 \text{ vs } f_{75\%}$: **`0.5989`** ($\Delta = -0.3711 \to \text{PASS}$)
  - **Overall Static Check**: `allSsimStatic = false` (High visual variance confirmed)
- **Bookend Integrity Checks**:
  - **Cold-Start Pre-Render Blank ($t=0.5\text{s}$)**: `false` (Rendered immediately on load)
  - **Dead Tail Air ($t=\text{end}-2\text{s}$)**: `false` (Tail SSIM vs $f_{75\%}$: `0.7131` vs threshold `0.995`)
- **Frame Size Variance**: `0.4519`
- **Structural Errors**: `0`

---

## 5. Adversarial Critic Reviews

- **Pre-Capture Critic**: **PASS** (`.studio/critic_pre_capture.md`)
  - Evaluated multi-route coverage, speed multiplier progression (35x and 50x), and camera auto-panning.
- **Post-Edit Critic**: **PASS** (`.studio/critic_post_edit.md`)
  - **GitHub Test**: **PASS** (Instantly communicates suborbital trajectory dynamics and real-time velocity calculation).
  - **Hero Image Assessment**: **EXCELLENT** (Captures London-to-Tokyo mid-flight climax over Northern Europe with live telemetry HUD).

---

## 6. Teardown, Port Hygiene & Resource Reclamation

1. **Dev Server Process**:
   - Recorded PID: `59980`
   - Process Tree: Next.js dev server and child Node.js workers terminated cleanly via `kill -TERM`.
   - Cleanup: `.studio/dev_server.pid` and `.studio/dev_server.port` unlinked.
2. **Port Hygiene**:
   - Port 3000 inspected via `lsof -iTCP:3000 -sTCP:LISTEN`.
   - Active listeners on port 3000: **`0`** (Port completely free).
   - Dangling workspace Node processes: **`0`**.
3. **Temporary Files & Workspace Disk Hygiene**:
   - Intermediate chunk files, QC review frames, and stress tests under `.studio/tmp/*` purged (`0` lingering temporary files).
   - Deliverable artifacts in `deliverables/` and `screenshots/` verified intact and complete.
4. **Completion Signal**:
   - Final completion marker `.studio/pipeline_complete` unblocked.
