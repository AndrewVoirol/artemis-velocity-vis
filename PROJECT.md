# Project: ais-artemis-velocity-vis Studio Multi-Agent Production

## Architecture
- **Framework**: Next.js 15.4.9 (App Router) + React 19.2.1 + Tailwind CSS v4.1.11 + Leaflet 1.9.4 / react-leaflet 5.0.0
- **Visualization Subsystem**: 2D Web Mercator Leaflet Map, Geodesic Polyline arc (101 points Haversine / spherical intermediate interpolation), HTML DivIcon spacecraft marker, auto-tracking `MapUpdater.panTo`
- **Simulation Clock**: `requestAnimationFrame` with dynamic multiplier (1x–100x), speed 24,500 mph (6.806 mi/s)
- **State A (Pre-Launch Idle)**: Route `'Coast to Coast (NYC to SF)'` loaded, `isRunning=false`, `elapsedTime=0`, `progress=0`, map fitted to continental US bounds
- **State B (In-Flight Telemetry)**: Moving marker along Great-Circle arc, `MapUpdater` panning across route, live telemetry HUD (Speed, Distance, Elapsed Time, Progress %, ETA), expanding progress bar
- **Output Artifacts**: `.studio/` blackboard, profile, choreography, Playwright raw screencast, `deliverables/` (`demo.mp4`, `demo.webp`, `demo.gif`, `hero.webp`), execution telemetry

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Phase 0 Discovery & App Profiling | Classify archetype, identify State A/B, detect viewport/theme, formulate `.studio/app_profile.json` | M1 | ORIGINAL_REQUEST §R1.1 |
| 2 | Phase 1 Choreography & EDL Formulation | Script multi-route switching (NYC→SF & London→Tokyo), speed adjustments (25x–50x), formulate `choreography.json` & `edl.yaml`, Pre-Capture Critic review | M2 | ORIGINAL_REQUEST §R1.2 |
| 3 | Phase 2 Playwright Capture Execution | Compile `capture_script.js` with `StudioInteractionEngine`, record `raw_screencast.webm`, write `capture_timeline.json` | M3 | ORIGINAL_REQUEST §R1.3 |
| 4 | Phase 3 Media Compression & Deterministic QA | Run `compress_media.sh` (H.264 MP4, WebP, GIF, hero image), `validate_media.sh` (SSIM checks), Post-Edit Critic review | M4 | ORIGINAL_REQUEST §R1.4 |
| 5 | Phase 4 Teardown, Telemetry & Pipeline Completion | Process hygiene, purge temp files, write `Studio_Telemetry.md` & `evaluation.json`, signal `pipeline_complete` | M5 | ORIGINAL_REQUEST §R1.5 |
| 6 | Deliverable Standards Compliance | `demo.mp4` ≤10MB, `demo.webp` ≤3MB, `demo.gif` ≤5MB, `hero.webp` ≤200KB, copy to `screenshots/` | M4/M5 | ORIGINAL_REQUEST §R2 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M1: Discovery & App Profile | Formulate `.studio/app_profile.json` and initialize `.studio/` | Survey | DONE |
| 2 | M2: Choreography & EDL Formulation | Generate `.studio/choreography.json` & `.studio/edl.yaml`, Pre-Capture Critic review | M1 | DONE |
| 3 | M3: Synthetic Capture & Screencast | Playwright record 1920x1080 `raw_screencast.webm` & `capture_timeline.json`, Gate 1 frame QC | M2 | DONE |
| 4 | M4: Compression, Deterministic QA & Post-Edit Review | `compress_media.sh`, `validate_media.sh`, Post-Edit Critic PASS on GitHub Test | M3 | DONE |
| 5 | M5: Teardown, Telemetry & Final Acceptance | Dev server termination, `.studio/Studio_Telemetry.md`, `evaluation.json`, `pipeline_complete` | M4 | DONE |

## Interface Contracts
- `.studio/app_profile.json` $\rightarrow$ `.studio/choreography.json` & `.studio/edl.yaml`
- `.studio/capture_script.js` $\rightarrow$ Playwright `record.js` $\rightarrow$ `.studio/raw_screencast.webm` & `.studio/capture_timeline.json`
- `.studio/raw_screencast.webm` + `.studio/capture_timeline.json` $\rightarrow$ `compress_media.sh` $\rightarrow$ `deliverables/`
- `deliverables/` $\rightarrow$ `validate_media.sh` $\rightarrow$ `.studio/validation.json`
- Final state $\rightarrow$ `Studio_Telemetry.md`, `evaluation.json`, `pipeline_complete`

## Code Layout
- `app/page.tsx`: Main UI page, telemetry calculations, animation loop, controls
- `components/Map.tsx`: Leaflet MapContainer, TileLayer, Polyline arc, spacecraft DivIcon, MapUpdater
- `lib/utils.ts`: Spherical Haversine distance, geodesic arc generation, intermediate coordinate interpolation
- `.studio/`: Pipeline metadata, `app_profile.json`, `choreography.json`, `edl.yaml`, `capture_script.js`, `raw_screencast.webm`, `capture_timeline.json`, `validation.json`, `Studio_Telemetry.md`, `evaluation.json`, `pipeline_complete`
- `deliverables/`: `demo.mp4`, `demo.webp`, `demo.gif`, `hero.webp`
- `screenshots/`: Demo assets for documentation
