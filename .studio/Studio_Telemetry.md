# Studio Execution Telemetry — Artemis Velocity Vis Orbital Mechanics Laboratory

- **Execution Date**: 2026-08-31T22:08:44.230Z
- **Archetype**: map-based trajectory simulator / orbital mechanics laboratory
- **Overall Status**: PASS (100% Verification Criteria Met)

## Deliverables Summary

| Asset | Path | Size | Ceiling | Status | Dimensions / Specs |
|---|---|---|---|---|---|
| **Showcase Video** | `deliverables/demo.mp4` | 2.62 MB | $\le 10.0\text{ MB}$ | **PASS** | 1920x1080, H.264, 13.56s, CRF 20, +faststart |
| **Animated WebP** | `deliverables/demo.webp` | 2.09 MB | $\le 3.0\text{ MB}$ | **PASS** | 800x450, 12fps, q=65, loop=0 |
| **Screenshot WebP** | `screenshots/demo.webp` | 2.09 MB | $\le 5.0\text{ MB}$ | **PASS** | 800x450, 12fps, q=65, loop=0 |
| **Repository GIF** | `deliverables/demo.gif` | 3.71 MB | $\le 5.0\text{ MB}$ | **PASS** | 800x450, 10fps, 2-pass palettegen |
| **Hero Image** | `deliverables/hero.webp` | 59.3 KB | $\le 200.0\text{ KB}$ | **PASS** | 1920x1080, WebP q=85 |

## Hero Screenshot Suite

| Identifier | Path | Size | Description |
|---|---|---|---|
| **Re-entry Telemetry** | `screenshots/artemis-reentry-telemetry.png` | 234.1 KB | Trans-Lunar Return & Skip Entry at 24,500 mph (Mach 31.93), active telemetry HUD, high-altitude re-entry corridor |
| **Sub-Polar Geodesic** | `screenshots/artemis-london-tokyo-geodesic.png` | 478.0 KB | Trans-Eurasian Orbit Pass (London -> Tokyo), highlighting dramatic sub-polar great-circle arc |
| **Mission Control Dark** | `screenshots/artemis-mission-control-dark.png` | 312.8 KB | NASA Mission Control Dark theme with radar cyan HUD, amber indicators, and dark matter tiles |
| **Mercator Distortion** | `screenshots/artemis-geodesic-vs-mercator.png` | 483.3 KB | Geodesic Arc vs Flat Mercator Linear Chord comparison layer enabled, highlighting +18.15% distortion |

## Multi-Frame SSIM Visual Diversity

- `reentry_vs_eurasian`: **0.8399** (Max ceiling: 0.97) — PASS
- `eurasian_vs_continental`: **0.8259** (Max ceiling: 0.97) — PASS
- `continental_vs_distortion`: **0.7866** (Max ceiling: 0.97) — PASS
- **Visual Diversity Verdict**: PASS (Distinct perceptual states demonstrated across all milestones)

## Server Process Hygiene
- **Dev Server PID**: Cleanly terminated (0 dangling background processes on ports 3000 / 3005).
- **Temporary Chunks**: Purged from `.studio/tmp/`.
- **Pipeline Stop Hook**: Signal file `.studio/pipeline_complete` written.
