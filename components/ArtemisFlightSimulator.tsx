'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  Play,
  Pause,
  RotateCcw,
  Gauge,
  Compass,
  MapPin,
  Eye,
  Activity,
  Layers,
  Globe,
  Radio,
  Zap,
  Info,
  Crosshair,
  Sliders,
  Clock,
  Sparkles,
  ArrowRight,
  TrendingUp,
  ShieldAlert,
  FastForward,
  Orbit
} from 'lucide-react';
import {
  MissionPresetId,
  ThemeId,
  TelemetryState,
  TelemetryData,
  DistortionStats,
  MISSION_PRESETS,
  MISSION_PRESETS_LIST,
  THEMES,
  computeTelemetry,
  calculateDistortionStats,
  geodesicArc,
  mercatorLinearChord,
  formatCoordinates,
  formatDuration,
  formatDistance,
  formatAltitude,
  SPEED_OF_SOUND_MPH
} from '@/lib/utils';
import type { MapProps } from './Map';

export interface ArtemisFlightSimulatorProps {
  initialPreset?: MissionPresetId;
  initialTheme?: ThemeId;
  initialVelocityMph?: number;
  showMercatorDefault?: boolean;
  className?: string;
  compact?: boolean;
  onTelemetryUpdate?: (telemetry: TelemetryData) => void;
}

// Fallback loading component during client-side Leaflet initialization
function MapLoadingFallback({ themeId }: { themeId: ThemeId }) {
  const theme = THEMES[themeId] || THEMES['nasa-dark'];
  const isEInk = themeId === 'e-ink';

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center font-mono p-6 select-none transition-colors duration-300"
      style={{
        backgroundColor: theme.mapBg,
        color: theme.textMain
      }}
    >
      <div className="relative flex items-center justify-center mb-6">
        <div
          className="w-24 h-24 rounded-full border-2 animate-ping opacity-40 absolute"
          style={{ borderColor: theme.accentPrimary }}
        />
        <div
          className="w-16 h-16 rounded-full border-2 flex items-center justify-center relative"
          style={{ borderColor: theme.accentPrimary, backgroundColor: theme.bgPanel }}
        >
          <Globe
            size={28}
            className="animate-spin"
            style={{ animationDuration: '8s', color: theme.accentPrimary }}
          />
        </div>
      </div>
      <div
        className="text-xs font-bold tracking-widest uppercase mb-1 flex items-center gap-2"
        style={{ color: theme.accentPrimary }}
      >
        <Radio size={14} className="animate-pulse" />
        Initializing Orbital Cartography Engine
      </div>
      <p className="text-[11px] opacity-60 max-w-xs text-center font-mono">
        Loading Web Mercator tiles and Haversine spherical geodesic projection...
      </p>
    </div>
  );
}

// Dynamically import Map with SSR disabled for clean client-side Leaflet hydration
const MapComponent = dynamic<MapProps>(() => import('./Map'), {
  ssr: false,
  loading: () => <MapLoadingFallback themeId="nasa-dark" />
});

const SPEED_PRESETS = [
  { label: 'Subsonic', mph: 575, mach: 'M0.75' },
  { label: 'Supersonic', mph: 1535, mach: 'M2.0' },
  { label: 'Hypersonic', mph: 5750, mach: 'M7.5' },
  { label: 'LEO Orbit', mph: 17500, mach: 'M22.8' },
  { label: 'Lunar Entry', mph: 24500, mach: 'M32.0' }
];

const SIM_SPEED_MULTIPLIERS = [1, 5, 10, 25, 50, 100];

export default function ArtemisFlightSimulator({
  initialPreset = 'lunar-return',
  initialTheme = 'nasa-dark',
  initialVelocityMph,
  showMercatorDefault = true,
  className = '',
  compact = false,
  onTelemetryUpdate
}: ArtemisFlightSimulatorProps) {
  // Core State
  const [selectedPresetId, setSelectedPresetId] = useState<MissionPresetId>(initialPreset);
  const [selectedThemeId, setSelectedThemeId] = useState<ThemeId>(initialTheme);
  const [velocityMph, setVelocityMph] = useState<number>(
    initialVelocityMph ?? (MISSION_PRESETS[initialPreset]?.defaultVelocityMph || 24500)
  );
  const [progress, setProgress] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [multiplier, setMultiplier] = useState<number>(10);
  const [showMercatorChord, setShowMercatorChord] = useState<boolean>(showMercatorDefault);
  const [cameraMode, setCameraMode] = useState<'overview' | 'follow'>('overview');
  const [activeTab, setActiveTab] = useState<'telemetry' | 'presets' | 'cartography' | 'controls'>('telemetry');

  // Resolved Mission Preset and Theme
  const currentPreset = useMemo(
    () => MISSION_PRESETS[selectedPresetId] || MISSION_PRESETS['lunar-return'],
    [selectedPresetId]
  );
  const currentTheme = useMemo(
    () => THEMES[selectedThemeId] || THEMES['nasa-dark'],
    [selectedThemeId]
  );

  // Derived Trajectory Geometry
  const arcPoints = useMemo(() => {
    return geodesicArc(
      currentPreset.origin.coords[0],
      currentPreset.origin.coords[1],
      currentPreset.destination.coords[0],
      currentPreset.destination.coords[1],
      100
    );
  }, [currentPreset]);

  const mercatorPoints = useMemo(() => {
    return mercatorLinearChord(
      currentPreset.origin.coords[0],
      currentPreset.origin.coords[1],
      currentPreset.destination.coords[0],
      currentPreset.destination.coords[1],
      100
    );
  }, [currentPreset]);

  const distortionStats = useMemo<DistortionStats>(() => {
    return calculateDistortionStats(
      currentPreset.origin.coords[0],
      currentPreset.origin.coords[1],
      currentPreset.destination.coords[0],
      currentPreset.destination.coords[1]
    );
  }, [currentPreset]);

  // Real-Time Telemetry Computation
  const telemetry = useMemo<TelemetryState>(() => {
    return computeTelemetry(currentPreset, progress, velocityMph);
  }, [currentPreset, progress, velocityMph]);

  // Telemetry Update Callback
  useEffect(() => {
    onTelemetryUpdate?.(telemetry);
  }, [telemetry, onTelemetryUpdate]);

  // Animation Loop Refs
  const lastTimeRef = useRef<number | null>(null);
  const requestRef = useRef<number | null>(null);
  const animateRef = useRef<((time: number) => void) | null>(null);

  // Smooth Animation Loop
  const animate = useCallback(
    (time: number) => {
      if (lastTimeRef.current != null) {
        const deltaTimeSec = (time - lastTimeRef.current) / 1000;
        const velocityMps = velocityMph / 3600;
        const totalDist = telemetry.totalDistMiles;
        const totalDurationSec = velocityMps > 0 ? totalDist / velocityMps : 1;

        const progressDelta = (deltaTimeSec * multiplier) / totalDurationSec;

        setProgress((prev) => {
          const next = prev + progressDelta;
          if (next >= 1.0) {
            setIsRunning(false);
            return 1.0;
          }
          return next;
        });
      }
      lastTimeRef.current = time;
      if (isRunning) {
        requestRef.current = requestAnimationFrame((t) => animateRef.current?.(t));
      }
    },
    [isRunning, multiplier, velocityMph, telemetry.totalDistMiles]
  );

  useEffect(() => {
    animateRef.current = animate;
  }, [animate]);

  useEffect(() => {
    if (isRunning) {
      requestRef.current = requestAnimationFrame((t) => animateRef.current?.(t));
    } else {
      lastTimeRef.current = null;
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isRunning]);

  // Handle Preset Switching
  const handleSelectPreset = (presetId: MissionPresetId) => {
    setSelectedPresetId(presetId);
    setProgress(0);
    setIsRunning(false);
    lastTimeRef.current = null;
    const nextPreset = MISSION_PRESETS[presetId];
    if (nextPreset) {
      setVelocityMph(nextPreset.defaultVelocityMph);
    }
  };

  // Launch / Pause Handlers
  const handleTogglePlay = () => {
    if (progress >= 1.0) {
      setProgress(0);
    }
    setIsRunning((prev) => !prev);
  };

  const handleReset = () => {
    setIsRunning(false);
    setProgress(0);
    lastTimeRef.current = null;
  };

  // Scrubber Handlers
  const handleProgressScrub = (val: number) => {
    const clamped = Math.max(0, Math.min(1, val));
    setProgress(clamped);
  };

  const handleVelocityChange = (val: number) => {
    setVelocityMph(val);
  };

  // Dynamic Styles
  const isEInk = currentTheme.id === 'e-ink';
  const isDark = currentTheme.id === 'nasa-dark';
  const themeClass = `theme-${currentTheme.id}`;

  return (
    <div
      className={`relative w-full ${compact ? 'min-h-[580px]' : 'h-screen'} flex flex-col md:flex-row overflow-hidden select-none font-sans ${themeClass} ${className}`}
      style={{
        backgroundColor: currentTheme.bgPage,
        color: currentTheme.textMain
      }}
    >
      {/* ------------------------------------------------------------- */}
      {/* LEFT SIDEBAR: MISSION CONTROL TELEMETRY & EXPERIMENT DECK    */}
      {/* ------------------------------------------------------------- */}
      <div
        className={`w-full ${
          compact ? 'md:w-[380px]' : 'md:w-[420px] lg:w-[450px]'
        } shrink-0 flex flex-col z-20 transition-all duration-300 border-b md:border-b-0 md:border-r overflow-hidden`}
        style={{
          backgroundColor: currentTheme.bgSidebar,
          borderColor: currentTheme.borderColor
        }}
      >
        {/* TOP BANNER: BRANDING & THEME SELECTOR */}
        <div
          className="p-4 sm:p-5 border-b shrink-0 flex flex-col gap-3"
          style={{ borderColor: currentTheme.borderColor, backgroundColor: currentTheme.bgPanel }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="p-2 rounded border flex items-center justify-center shadow-md"
                style={{
                  backgroundColor: currentTheme.bgSidebar,
                  borderColor: currentTheme.accentPrimary,
                  color: currentTheme.accentPrimary
                }}
              >
                <Orbit size={22} className={isRunning ? 'animate-spin' : ''} style={{ animationDuration: '6s' }} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-extrabold text-lg sm:text-xl tracking-tight leading-none">
                    ARTEMIS
                  </h1>
                  <span
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded font-bold uppercase"
                    style={{
                      backgroundColor: currentTheme.badgeBg,
                      color: currentTheme.badgeText,
                      border: `1px solid ${currentTheme.borderColor}`
                    }}
                  >
                    ORBITAL VIS
                  </span>
                </div>
                <p className="text-[10px] font-mono tracking-wider opacity-70 uppercase mt-0.5">
                  Spherical Geodesics &bull; Telemetry Deck
                </p>
              </div>
            </div>

            {/* THEME TOGGLE BUTTONS */}
            <div className="flex items-center gap-1 p-1 rounded border" style={{ borderColor: currentTheme.borderColor, backgroundColor: currentTheme.bgSidebar }}>
              {(['nasa-dark', 'e-ink', 'satellite'] as ThemeId[]).map((tId) => {
                const isActive = selectedThemeId === tId;
                return (
                  <button
                    key={tId}
                    onClick={() => setSelectedThemeId(tId)}
                    title={`Switch to ${THEMES[tId].name}`}
                    className={`px-2 py-1 text-[10px] font-mono font-bold rounded transition-all flex items-center gap-1 ${
                      isActive ? 'shadow-sm' : 'opacity-60 hover:opacity-100'
                    }`}
                    style={{
                      backgroundColor: isActive ? currentTheme.accentPrimary : 'transparent',
                      color: isActive ? (isEInk ? '#ffffff' : '#030712') : currentTheme.textMain
                    }}
                  >
                    {tId === 'nasa-dark' && <Zap size={11} />}
                    {tId === 'e-ink' && <Layers size={11} />}
                    {tId === 'satellite' && <Globe size={11} />}
                    <span className="hidden sm:inline">
                      {tId === 'nasa-dark' ? 'DARK' : tId === 'e-ink' ? 'E-INK' : 'SAT'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ACTIVE MISSION SUMMARY CARD */}
          <div
            className="p-2.5 rounded border text-xs font-mono flex items-center justify-between"
            style={{
              borderColor: currentTheme.borderColor,
              backgroundColor: isEInk ? '#f4f4f5' : 'rgba(255, 255, 255, 0.03)'
            }}
          >
            <div className="truncate pr-2">
              <span className="text-[9px] uppercase tracking-widest opacity-60 block">Active Mission:</span>
              <span className="font-bold truncate block">{currentPreset.name}</span>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[9px] uppercase tracking-widest opacity-60 block">Total Arc:</span>
              <span className="font-bold" style={{ color: currentTheme.accentPrimary }}>
                {formatDistance(telemetry.totalDistMiles)}
              </span>
            </div>
          </div>
        </div>

        {/* TAB NAVIGATION FOR COMPACT/MOBILE DECKS */}
        <div
          className="flex border-b text-xs font-mono font-bold shrink-0"
          style={{ borderColor: currentTheme.borderColor, backgroundColor: currentTheme.bgSidebar }}
        >
          <button
            onClick={() => setActiveTab('telemetry')}
            className={`flex-1 py-2 px-3 text-center border-b-2 transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'telemetry' ? '' : 'opacity-60 hover:opacity-90 border-transparent'
            }`}
            style={{
              borderBottomColor: activeTab === 'telemetry' ? currentTheme.accentPrimary : 'transparent',
              color: activeTab === 'telemetry' ? currentTheme.accentPrimary : currentTheme.textMain
            }}
          >
            <Activity size={13} />
            <span>Telemetry</span>
          </button>
          <button
            onClick={() => setActiveTab('presets')}
            className={`flex-1 py-2 px-3 text-center border-b-2 transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'presets' ? '' : 'opacity-60 hover:opacity-90 border-transparent'
            }`}
            style={{
              borderBottomColor: activeTab === 'presets' ? currentTheme.accentPrimary : 'transparent',
              color: activeTab === 'presets' ? currentTheme.accentPrimary : currentTheme.textMain
            }}
          >
            <Globe size={13} />
            <span>Missions</span>
          </button>
          <button
            onClick={() => setActiveTab('cartography')}
            className={`flex-1 py-2 px-3 text-center border-b-2 transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'cartography' ? '' : 'opacity-60 hover:opacity-90 border-transparent'
            }`}
            style={{
              borderBottomColor: activeTab === 'cartography' ? currentTheme.accentPrimary : 'transparent',
              color: activeTab === 'cartography' ? currentTheme.accentPrimary : currentTheme.textMain
            }}
          >
            <Layers size={13} />
            <span>Distortion</span>
          </button>
          <button
            onClick={() => setActiveTab('controls')}
            className={`flex-1 py-2 px-3 text-center border-b-2 transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'controls' ? '' : 'opacity-60 hover:opacity-90 border-transparent'
            }`}
            style={{
              borderBottomColor: activeTab === 'controls' ? currentTheme.accentPrimary : 'transparent',
              color: activeTab === 'controls' ? currentTheme.accentPrimary : currentTheme.textMain
            }}
          >
            <Sliders size={13} />
            <span>Controls</span>
          </button>
        </div>

        {/* SCROLLABLE CONTROL & TELEMETRY PANELS */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 custom-scrollbar min-h-0">
          {/* TAB 1: TELEMETRY DECK */}
          {activeTab === 'telemetry' && (
            <div className="space-y-4 font-mono">
              {/* PRIMARY FLIGHT INSTRUMENTS ROW */}
              <div className="grid grid-cols-2 gap-3">
                {/* VELOCITY & MACH */}
                <div
                  className="p-3.5 rounded border relative overflow-hidden"
                  style={{
                    borderColor: currentTheme.borderColor,
                    backgroundColor: currentTheme.bgPanel
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] uppercase tracking-wider opacity-60 flex items-center gap-1">
                      <Gauge size={11} /> Ground Speed
                    </span>
                    <span
                      className="text-[9px] px-1 py-0.2 rounded font-bold"
                      style={{
                        backgroundColor: currentTheme.badgeBg,
                        color: currentTheme.badgeText
                      }}
                    >
                      {telemetry.regime}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight" style={{ color: currentTheme.accentPrimary }}>
                      {velocityMph.toLocaleString('en-US')}
                    </span>
                    <span className="text-xs font-bold opacity-75">mph</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] mt-1 pt-1 border-t opacity-80" style={{ borderColor: currentTheme.borderColor }}>
                    <span>{telemetry.machStr}</span>
                    <span>{telemetry.velocityKms.toFixed(2)} km/s</span>
                  </div>
                </div>

                {/* ALTITUDE & REGIME */}
                <div
                  className="p-3.5 rounded border"
                  style={{
                    borderColor: currentTheme.borderColor,
                    backgroundColor: currentTheme.bgPanel
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] uppercase tracking-wider opacity-60 flex items-center gap-1">
                      <TrendingUp size={11} /> Altitude
                    </span>
                    <span className="text-[9px] opacity-75">{telemetry.altitudeMi} mi</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl sm:text-2xl font-extrabold font-mono">
                      {telemetry.altitudeFt.toLocaleString('en-US')}
                    </span>
                    <span className="text-[10px] font-bold opacity-75">ft</span>
                  </div>
                  <div className="text-[10px] truncate mt-1 pt-1 border-t font-medium" style={{ borderColor: currentTheme.borderColor, color: currentTheme.accentSecondary }}>
                    {telemetry.flightPhase}
                  </div>
                </div>
              </div>

              {/* COORDINATE & BEARING DISPLAY */}
              <div
                className="p-3.5 rounded border space-y-2.5"
                style={{
                  borderColor: currentTheme.borderColor,
                  backgroundColor: currentTheme.bgPanel
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider opacity-60 flex items-center gap-1">
                    <Crosshair size={11} /> Sub-Satellite Point
                  </span>
                  <span className="text-[10px] flex items-center gap-1 font-bold" style={{ color: currentTheme.accentPrimary }}>
                    <Compass size={11} /> {telemetry.headingStr}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded bg-black/10 dark:bg-white/5">
                    <span className="text-[9px] block opacity-60 uppercase">Latitude</span>
                    <span className="font-bold text-sm">{telemetry.latitudeStr}</span>
                  </div>
                  <div className="p-2 rounded bg-black/10 dark:bg-white/5">
                    <span className="text-[9px] block opacity-60 uppercase">Longitude</span>
                    <span className="font-bold text-sm">{telemetry.longitudeStr}</span>
                  </div>
                </div>
              </div>

              {/* FLIGHT PROGRESS & KINEMATIC SCRUBBER */}
              <div
                className="p-3.5 rounded border space-y-3"
                style={{
                  borderColor: currentTheme.borderColor,
                  backgroundColor: currentTheme.bgPanel
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider opacity-60 flex items-center gap-1">
                    <Clock size={11} /> Flight Progress
                  </span>
                  <span className="text-xs font-bold" style={{ color: currentTheme.accentPrimary }}>
                    {telemetry.progressPercent}
                  </span>
                </div>

                {/* CONTINUOUS BIDIRECTIONAL SCRUBBER */}
                <div className="space-y-1">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.001"
                    value={progress}
                    onChange={(e) => handleProgressScrub(parseFloat(e.target.value))}
                    className="w-full h-2 cursor-pointer"
                    style={{ accentColor: currentTheme.accentPrimary }}
                  />
                  <div className="flex justify-between text-[10px] opacity-60">
                    <span>{currentPreset.origin.name.split('(')[0].trim()}</span>
                    <span>{currentPreset.destination.name.split('(')[0].trim()}</span>
                  </div>
                </div>

                {/* DISTANCE & TIME ROW */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1 border-t" style={{ borderColor: currentTheme.borderColor }}>
                  <div>
                    <span className="text-[9px] opacity-60 block uppercase">Elapsed</span>
                    <span className="font-bold">{formatDuration(telemetry.elapsedTimeSec)}</span>
                  </div>
                  <div>
                    <span className="text-[9px] opacity-60 block uppercase">Distance</span>
                    <span className="font-bold">{formatDistance(telemetry.currentDistMiles)}</span>
                  </div>
                  <div>
                    <span className="text-[9px] opacity-60 block uppercase">ETA Remaining</span>
                    <span className="font-bold" style={{ color: currentTheme.accentSecondary }}>
                      {formatDuration(telemetry.etaSec)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ORBITAL MISSION PRESETS */}
          {activeTab === 'presets' && (
            <div className="space-y-3 font-mono">
              <div className="flex items-center justify-between text-xs opacity-75 mb-1">
                <span>Select Curated Trajectory:</span>
                <span className="text-[10px] font-bold">4 Catalogs Loaded</span>
              </div>

              {MISSION_PRESETS_LIST.map((p) => {
                const isSelected = selectedPresetId === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => handleSelectPreset(p.id)}
                    className={`w-full p-3.5 rounded border text-left transition-all relative overflow-hidden ${
                      isSelected ? 'ring-2 shadow-lg' : 'opacity-75 hover:opacity-100'
                    }`}
                    style={{
                      borderColor: isSelected ? currentTheme.accentPrimary : currentTheme.borderColor,
                      backgroundColor: isSelected ? currentTheme.bgPanel : currentTheme.bgSidebar
                    }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div>
                        <div className="font-bold text-xs sm:text-sm flex items-center gap-1.5">
                          {isSelected && (
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: currentTheme.accentPrimary }} />
                          )}
                          {p.name}
                        </div>
                        <p className="text-[10px] opacity-70 mt-0.5">{p.subtitle}</p>
                      </div>
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 uppercase"
                        style={{
                          backgroundColor: currentTheme.badgeBg,
                          color: currentTheme.badgeText
                        }}
                      >
                        {p.defaultVelocityMph.toLocaleString()} mph
                      </span>
                    </div>

                    <p className="text-[10.5px] opacity-80 leading-relaxed font-sans mt-2 border-t pt-2" style={{ borderColor: currentTheme.borderColor }}>
                      {p.description}
                    </p>

                    <div className="flex items-center justify-between text-[10px] opacity-60 mt-2 font-mono">
                      <span>From: {p.origin.name.split('(')[0]}</span>
                      <span>To: {p.destination.name.split('(')[0]}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* TAB 3: SPHERICAL GEODESIC VS MERCATOR CHORD DISTORTION */}
          {activeTab === 'cartography' && (
            <div className="space-y-4 font-mono text-xs">
              <div
                className="p-3.5 rounded border space-y-3"
                style={{
                  borderColor: currentTheme.borderColor,
                  backgroundColor: currentTheme.bgPanel
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers size={16} style={{ color: currentTheme.accentPrimary }} />
                    <span className="font-bold">Mercator Chord Visualizer</span>
                  </div>
                  <button
                    onClick={() => setShowMercatorChord((prev) => !prev)}
                    className={`px-3 py-1 text-xs font-bold rounded border transition-all ${
                      showMercatorChord ? 'shadow-md' : 'opacity-60'
                    }`}
                    style={{
                      backgroundColor: showMercatorChord ? currentTheme.accentPrimary : 'transparent',
                      color: showMercatorChord ? (isEInk ? '#ffffff' : '#030712') : currentTheme.textMain,
                      borderColor: currentTheme.accentPrimary
                    }}
                  >
                    {showMercatorChord ? 'ACTIVE (ON)' : 'DISABLED (OFF)'}
                  </button>
                </div>

                <p className="text-[11px] opacity-80 leading-relaxed font-sans">
                  The Mercator projection stretches high latitudes. A straight line on a flat Mercator map is a Rhumb line (constant compass bearing), which deviates significantly from the true shortest spherical Great-Circle geodesic arc.
                </p>
              </div>

              {/* DISTORTION METRICS BREAKDOWN */}
              <div
                className="p-3.5 rounded border space-y-3"
                style={{
                  borderColor: currentTheme.borderColor,
                  backgroundColor: currentTheme.bgPanel
                }}
              >
                <div className="font-bold text-xs uppercase tracking-wider opacity-80 border-b pb-1.5 flex items-center justify-between" style={{ borderColor: currentTheme.borderColor }}>
                  <span>Cartographic Delta Statistics</span>
                  <span className="text-[10px] px-1 rounded" style={{ backgroundColor: currentTheme.badgeBg, color: currentTheme.badgeText }}>
                    EPSG:3857 Analysis
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  {/* Great Circle Arc */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-1 rounded" style={{ backgroundColor: currentTheme.arcColor }} />
                      <span className="opacity-80">True Geodesic Arc:</span>
                    </div>
                    <span className="font-bold">{formatDistance(distortionStats.geodesicDistMiles)}</span>
                  </div>

                  {/* Mercator Linear Chord */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-1 border-b-2 border-dashed" style={{ borderColor: currentTheme.chordColor }} />
                      <span className="opacity-80">Flat Mercator Chord:</span>
                    </div>
                    <span className="font-bold">{formatDistance(distortionStats.mercatorDistMiles)}</span>
                  </div>

                  {/* Delta & % Distortion */}
                  <div className="p-2.5 rounded border mt-2 space-y-1" style={{ borderColor: currentTheme.borderColor, backgroundColor: isEInk ? '#f4f4f5' : 'rgba(255, 255, 255, 0.05)' }}>
                    <div className="flex items-center justify-between">
                      <span className="opacity-80">Length Penalty:</span>
                      <span className="font-bold text-amber-500">
                        +{distortionStats.deltaMiles.toFixed(1)} miles
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="opacity-80">Percentage Distortion:</span>
                      <span className="font-bold text-amber-500">
                        +{distortionStats.percentageDistortion.toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="opacity-80">Midpoint Separation:</span>
                      <span className="font-bold" style={{ color: currentTheme.accentPrimary }}>
                        {formatDistance(distortionStats.midpointSeparationMiles)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: VELOCITY SCRUBBER & CAMERA CONTROLS */}
          {activeTab === 'controls' && (
            <div className="space-y-4 font-mono text-xs">
              {/* VELOCITY & MACH SCRUBBER */}
              <div
                className="p-3.5 rounded border space-y-3"
                style={{
                  borderColor: currentTheme.borderColor,
                  backgroundColor: currentTheme.bgPanel
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider opacity-60 flex items-center gap-1">
                    <Gauge size={12} /> Velocity & Mach Scrubber
                  </span>
                  <span className="font-bold text-sm" style={{ color: currentTheme.accentPrimary }}>
                    {velocityMph.toLocaleString()} mph
                  </span>
                </div>

                <input
                  type="range"
                  min="500"
                  max="25000"
                  step="250"
                  value={velocityMph}
                  onChange={(e) => handleVelocityChange(Number(e.target.value))}
                  className="w-full h-2 cursor-pointer"
                  style={{ accentColor: currentTheme.accentPrimary }}
                />

                <div className="flex items-center justify-between text-[10px] opacity-60">
                  <span>500 mph (M0.65)</span>
                  <span>17,500 mph (LEO)</span>
                  <span>25,000 mph (M32.6)</span>
                </div>

                {/* SPEED QUICK PRESETS */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-2 border-t" style={{ borderColor: currentTheme.borderColor }}>
                  {SPEED_PRESETS.map((sp) => (
                    <button
                      key={sp.label}
                      onClick={() => setVelocityMph(sp.mph)}
                      className={`p-1.5 rounded border text-[10px] font-bold text-center transition-all ${
                        velocityMph === sp.mph ? 'shadow-sm' : 'opacity-70 hover:opacity-100'
                      }`}
                      style={{
                        borderColor: velocityMph === sp.mph ? currentTheme.accentPrimary : currentTheme.borderColor,
                        backgroundColor: velocityMph === sp.mph ? currentTheme.badgeBg : 'transparent',
                        color: velocityMph === sp.mph ? currentTheme.accentPrimary : currentTheme.textMain
                      }}
                    >
                      <div>{sp.label}</div>
                      <div className="text-[9px] opacity-75">{sp.mach}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* SIMULATION CLOCK MULTIPLIER */}
              <div
                className="p-3.5 rounded border space-y-2.5"
                style={{
                  borderColor: currentTheme.borderColor,
                  backgroundColor: currentTheme.bgPanel
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider opacity-60 flex items-center gap-1">
                    <FastForward size={12} /> Simulation Clock Multiplier
                  </span>
                  <span className="font-bold" style={{ color: currentTheme.accentPrimary }}>
                    {multiplier}x Speed
                  </span>
                </div>

                <div className="grid grid-cols-6 gap-1">
                  {SIM_SPEED_MULTIPLIERS.map((m) => (
                    <button
                      key={m}
                      onClick={() => setMultiplier(m)}
                      className={`py-1 rounded border text-xs font-bold transition-all ${
                        multiplier === m ? 'shadow-sm' : 'opacity-60 hover:opacity-100'
                      }`}
                      style={{
                        borderColor: multiplier === m ? currentTheme.accentPrimary : currentTheme.borderColor,
                        backgroundColor: multiplier === m ? currentTheme.accentPrimary : 'transparent',
                        color: multiplier === m ? (isEInk ? '#ffffff' : '#030712') : currentTheme.textMain
                      }}
                    >
                      {m}x
                    </button>
                  ))}
                </div>
              </div>

              {/* CAMERA TRACKING MODE */}
              <div
                className="p-3.5 rounded border space-y-2.5"
                style={{
                  borderColor: currentTheme.borderColor,
                  backgroundColor: currentTheme.bgPanel
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider opacity-60 flex items-center gap-1">
                    <Eye size={12} /> Camera Tracking Mode
                  </span>
                  <span className="font-bold text-xs uppercase" style={{ color: currentTheme.accentPrimary }}>
                    {cameraMode === 'follow' ? 'Vessel Locked' : 'Full Trajectory'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setCameraMode('overview')}
                    className={`py-2 px-3 rounded border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      cameraMode === 'overview' ? 'shadow-sm' : 'opacity-60 hover:opacity-100'
                    }`}
                    style={{
                      borderColor: cameraMode === 'overview' ? currentTheme.accentPrimary : currentTheme.borderColor,
                      backgroundColor: cameraMode === 'overview' ? currentTheme.accentPrimary : 'transparent',
                      color: cameraMode === 'overview' ? (isEInk ? '#ffffff' : '#030712') : currentTheme.textMain
                    }}
                  >
                    <Globe size={13} />
                    <span>Overview Bounds</span>
                  </button>

                  <button
                    onClick={() => setCameraMode('follow')}
                    className={`py-2 px-3 rounded border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      cameraMode === 'follow' ? 'shadow-sm' : 'opacity-60 hover:opacity-100'
                    }`}
                    style={{
                      borderColor: cameraMode === 'follow' ? currentTheme.accentPrimary : currentTheme.borderColor,
                      backgroundColor: cameraMode === 'follow' ? currentTheme.accentPrimary : 'transparent',
                      color: cameraMode === 'follow' ? (isEInk ? '#ffffff' : '#030712') : currentTheme.textMain
                    }}
                  >
                    <Crosshair size={13} />
                    <span>Follow Vessel</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM PRIMARY FLIGHT CONTROL BAR */}
        <div
          className="p-4 border-t shrink-0 flex items-center gap-3"
          style={{ borderColor: currentTheme.borderColor, backgroundColor: currentTheme.bgPanel }}
        >
          <button
            onClick={handleTogglePlay}
            className="flex-1 py-3 px-4 rounded border font-mono font-extrabold text-xs sm:text-sm tracking-wider uppercase flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
            style={{
              backgroundColor: currentTheme.accentPrimary,
              color: isEInk ? '#ffffff' : '#030712',
              borderColor: currentTheme.accentPrimary
            }}
          >
            {isRunning ? (
              <>
                <Pause size={16} fill="currentColor" />
                <span>PAUSE FLIGHT</span>
              </>
            ) : (
              <>
                <Play size={16} fill="currentColor" />
                <span>{progress >= 1.0 ? 'RE-LAUNCH MISSION' : 'IGNITE & LAUNCH'}</span>
              </>
            )}
          </button>

          <button
            onClick={handleReset}
            title="Reset flight trajectory to origin"
            className="py-3 px-4 rounded border font-mono font-bold text-xs uppercase flex items-center justify-center gap-1.5 transition-all opacity-80 hover:opacity-100 active:scale-95"
            style={{
              borderColor: currentTheme.borderColor,
              backgroundColor: currentTheme.bgSidebar,
              color: currentTheme.textMain
            }}
          >
            <RotateCcw size={15} />
            <span className="hidden sm:inline">RESET</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* RIGHT VIEWPORT: INTERACTIVE LEAFLET CARTOGRAPHY STAGE         */}
      {/* ------------------------------------------------------------- */}
      <div className="flex-1 relative w-full h-[400px] md:h-full overflow-hidden">
        <MapComponent
          arcPoints={arcPoints}
          mercatorPoints={mercatorPoints}
          currentPos={telemetry.currentPos}
          headingDeg={telemetry.headingDeg}
          preset={currentPreset}
          showMercatorChord={showMercatorChord}
          theme={currentTheme}
          cameraMode={cameraMode}
          telemetry={telemetry}
          distortionStats={distortionStats}
          showHudOverlay={true}
          className="w-full h-full"
        />

        {/* BOTTOM QUICK STATUS TICKER OVERLAY */}
        <div
          className="absolute bottom-4 left-4 z-[400] hidden sm:flex items-center gap-3 px-3 py-1.5 rounded border backdrop-blur-md font-mono text-[11px] shadow-lg pointer-events-none"
          style={{
            backgroundColor: isEInk ? 'rgba(255, 255, 255, 0.95)' : 'rgba(7, 11, 20, 0.85)',
            borderColor: currentTheme.borderColor,
            color: currentTheme.textMain
          }}
        >
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${isRunning ? 'animate-pulse' : ''}`}
              style={{ backgroundColor: isRunning ? currentTheme.accentPrimary : currentTheme.accentSecondary }}
            />
            <span className="font-bold uppercase tracking-wider">
              {isRunning ? 'SIMULATION ACTIVE' : 'TELEMETRY STANDBY'}
            </span>
          </div>
          <span className="opacity-40">|</span>
          <span>Clock: {multiplier}x</span>
          <span className="opacity-40">|</span>
          <span>Regime: {telemetry.regime}</span>
          {showMercatorChord && (
            <>
              <span className="opacity-40">|</span>
              <span className="text-amber-500 font-bold">
                Mercator Δ: +{distortionStats.percentageDistortion.toFixed(1)}%
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
