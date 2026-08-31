'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  LatLngTuple,
  MissionPreset,
  TelemetryState,
  DistortionStats,
  ThemeId,
  ThemeConfig,
  THEMES,
  formatCoordinates,
  formatAltitude
} from '@/lib/utils';

export interface MapProps {
  arcPoints?: LatLngTuple[];
  mercatorPoints?: LatLngTuple[];
  currentPos: LatLngTuple;
  headingDeg?: number;
  preset?: MissionPreset;
  originCoords?: LatLngTuple;
  originName?: string;
  originType?: string;
  destCoords?: LatLngTuple;
  destName?: string;
  destType?: string;
  showMercatorChord?: boolean;
  theme?: ThemeId | ThemeConfig;
  cameraMode?: 'overview' | 'follow';
  telemetry?: TelemetryState;
  distortionStats?: DistortionStats;
  showHudOverlay?: boolean;
  className?: string;
}

/**
 * Creates custom spacecraft DivIcon with dynamic rotation and radar ping pulse
 */
function createSpacecraftIcon(
  headingDeg: number,
  themeConfig: ThemeConfig
): L.DivIcon {
  const isEInk = themeConfig.id === 'e-ink';
  const isDark = themeConfig.id === 'nasa-dark';

  const vesselSvg = isEInk
    ? `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" style="transform: rotate(${headingDeg}deg); transform-origin: 50% 50%;">
        <polygon points="12,2 20,21 12,17 4,21" fill="#000000" stroke="#ffffff" stroke-width="2"/>
        <circle cx="12" cy="12" r="2.5" fill="#ffffff"/>
       </svg>`
    : isDark
    ? `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" style="transform: rotate(${headingDeg}deg); transform-origin: 50% 50%; filter: drop-shadow(0 0 6px #00f0ff);">
        <polygon points="12,2 21,21 12,16 3,21" fill="#00f0ff" stroke="#ffffff" stroke-width="1.5"/>
        <circle cx="12" cy="12" r="2" fill="#ffffff"/>
       </svg>`
    : `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" style="transform: rotate(${headingDeg}deg); transform-origin: 50% 50%; filter: drop-shadow(0 0 6px #facc15);">
        <polygon points="12,2 21,21 12,16 3,21" fill="#facc15" stroke="#000000" stroke-width="1.5"/>
        <circle cx="12" cy="12" r="2" fill="#84cc16"/>
       </svg>`;

  const html = `
    <div class="spacecraft-marker-container" style="width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; position: relative;">
      <div class="animate-radar-ping spacecraft-radar-ring" style="border: 2px solid ${themeConfig.markerColor}; background: ${themeConfig.pingColor};"></div>
      <div class="spacecraft-vessel">
        ${vesselSvg}
      </div>
    </div>
  `;

  return L.divIcon({
    className: 'spacecraft-div-icon',
    html,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

/**
 * Creates custom origin marker DivIcon
 */
function createOriginIcon(themeConfig: ThemeConfig, label: string = 'A'): L.DivIcon {
  const isEInk = themeConfig.id === 'e-ink';
  const bg = isEInk ? '#000000' : '#10b981';
  const fg = '#ffffff';

  const html = `
    <div style="
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      background: ${bg};
      color: ${fg};
      border: 2px solid #ffffff;
      border-radius: 4px;
      font-family: monospace;
      font-weight: bold;
      font-size: 11px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.5);
    ">
      ${label}
    </div>
  `;

  return L.divIcon({
    className: 'origin-node-icon',
    html,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
}

/**
 * Creates custom destination marker DivIcon
 */
function createDestIcon(themeConfig: ThemeConfig, label: string = 'B'): L.DivIcon {
  const isEInk = themeConfig.id === 'e-ink';
  const bg = isEInk ? '#ffffff' : '#f43f5e';
  const fg = isEInk ? '#000000' : '#ffffff';
  const border = isEInk ? '3px solid #000000' : '2px solid #ffffff';

  const html = `
    <div style="
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      background: ${bg};
      color: ${fg};
      border: ${border};
      border-radius: 50%;
      font-family: monospace;
      font-weight: bold;
      font-size: 11px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.5);
    ">
      ${label}
    </div>
  `;

  return L.divIcon({
    className: 'dest-node-icon',
    html,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
}

/**
 * Controller component for camera auto-fit and follow mode
 */
function MapController({
  bounds,
  currentPos,
  cameraMode
}: {
  bounds: L.LatLngBounds;
  currentPos: LatLngTuple;
  cameraMode: 'overview' | 'follow';
}) {
  const map = useMap();
  const prevBoundsKeyRef = useRef<string>('');
  const prevModeRef = useRef<'overview' | 'follow'>(cameraMode);

  useEffect(() => {
    const key = bounds.toBBoxString();
    const boundsChanged = key !== prevBoundsKeyRef.current;
    const modeSwitchedToOverview = cameraMode === 'overview' && prevModeRef.current !== 'overview';

    if (boundsChanged || modeSwitchedToOverview) {
      prevBoundsKeyRef.current = key;
      prevModeRef.current = cameraMode;
      map.fitBounds(bounds, { padding: [50, 50], animate: true, duration: 0.8 });
    }
  }, [bounds, cameraMode, map]);

  useEffect(() => {
    prevModeRef.current = cameraMode;
    if (cameraMode === 'follow') {
      map.panTo(currentPos, { animate: true, duration: 0.3 });
    }
  }, [currentPos, cameraMode, map]);

  return null;
}

export default function Map({
  arcPoints = [],
  mercatorPoints,
  currentPos,
  headingDeg = 0,
  preset,
  originCoords,
  originName,
  originType,
  destCoords,
  destName,
  destType,
  showMercatorChord = false,
  theme = 'nasa-dark',
  cameraMode = 'overview',
  telemetry,
  distortionStats,
  showHudOverlay = true,
  className = ''
}: MapProps) {
  // Resolve Theme Configuration
  const themeConfig: ThemeConfig = useMemo(() => {
    if (typeof theme === 'string') {
      return THEMES[theme] || THEMES['nasa-dark'];
    }
    return theme;
  }, [theme]);

  // Determine Origin & Destination
  const startNode: LatLngTuple = useMemo(() => {
    if (originCoords) return originCoords;
    if (preset) return preset.origin.coords;
    if (arcPoints.length > 0) return arcPoints[0];
    return currentPos;
  }, [originCoords, preset, arcPoints, currentPos]);

  const endNode: LatLngTuple = useMemo(() => {
    if (destCoords) return destCoords;
    if (preset) return preset.destination.coords;
    if (arcPoints.length > 0) return arcPoints[arcPoints.length - 1];
    return currentPos;
  }, [destCoords, preset, arcPoints, currentPos]);

  const originLabel = originName || preset?.origin.name || 'Origin';
  const originSubtitle = originType || preset?.origin.type || 'Launch Site';
  const destLabel = destName || preset?.destination.name || 'Destination';
  const destSubtitle = destType || preset?.destination.type || 'Target Splashdown';

  // Compute Map Bounds
  const bounds = useMemo(() => {
    const pointsToFit = arcPoints.length > 0 ? arcPoints : [startNode, endNode, currentPos];
    const latLngs = pointsToFit.map(p => L.latLng(p[0], p[1]));
    return L.latLngBounds(latLngs).pad(0.15);
  }, [arcPoints, startNode, endNode, currentPos]);

  // Icons
  const spacecraftIcon = useMemo(
    () => createSpacecraftIcon(headingDeg, themeConfig),
    [headingDeg, themeConfig]
  );
  const originIcon = useMemo(() => createOriginIcon(themeConfig, 'A'), [themeConfig]);
  const destIcon = useMemo(() => createDestIcon(themeConfig, 'B'), [themeConfig]);

  // Floating HUD metrics fallback if telemetry state not passed
  const formattedCoords = formatCoordinates(currentPos[0], currentPos[1]);
  const hudAltitude = telemetry ? formatAltitude(telemetry.altitudeFt) : 'Surface Track';
  const hudMach = telemetry ? telemetry.machStr : 'M0.00';
  const hudSpeed = telemetry ? `${telemetry.velocityMph.toLocaleString('en-US')} mph` : '0 mph';
  const hudPhase = telemetry?.flightPhase || preset?.orbitalContext || 'Orbital Cruise';

  const themeClass = `theme-${themeConfig.id}`;

  return (
    <div className={`relative w-full h-full overflow-hidden ${themeClass} ${className}`}>
      <MapContainer
        bounds={bounds}
        scrollWheelZoom={true}
        className="w-full h-full z-0"
        zoomControl={false}
      >
        {/* Dynamic Tile Layer */}
        <TileLayer
          key={themeConfig.id}
          attribution={themeConfig.tileAttribution}
          url={themeConfig.tileUrl}
        />

        {/* Great-Circle Geodesic Arc (Solid / Glowing Primary Path) */}
        {arcPoints.length > 0 && (
          <Polyline
            positions={arcPoints}
            pathOptions={{
              color: themeConfig.arcColor,
              weight: themeConfig.arcWeight,
              dashArray: themeConfig.arcDashArray,
              opacity: 0.95,
              lineCap: 'round',
              lineJoin: 'round'
            }}
          />
        )}

        {/* Flat Mercator Linear Chord (Dashed Secondary Comparison Path) */}
        {showMercatorChord && mercatorPoints && mercatorPoints.length > 0 && (
          <Polyline
            positions={mercatorPoints}
            pathOptions={{
              color: themeConfig.chordColor,
              weight: themeConfig.chordWeight,
              dashArray: themeConfig.chordDashArray || '6, 6',
              opacity: 0.85,
              lineCap: 'round',
              lineJoin: 'round'
            }}
          />
        )}

        {/* Origin Marker */}
        <Marker position={startNode} icon={originIcon}>
          <Tooltip direction="top" offset={[0, -14]} opacity={0.95}>
            <div className="font-mono text-xs p-1">
              <p className="font-bold text-sm">{originLabel}</p>
              <p className="text-gray-500 text-[10px] uppercase tracking-wider">{originSubtitle}</p>
              <p className="text-[10px] mt-1">{formatCoordinates(startNode[0], startNode[1]).combined}</p>
            </div>
          </Tooltip>
        </Marker>

        {/* Destination Marker */}
        <Marker position={endNode} icon={destIcon}>
          <Tooltip direction="top" offset={[0, -14]} opacity={0.95}>
            <div className="font-mono text-xs p-1">
              <p className="font-bold text-sm">{destLabel}</p>
              <p className="text-gray-500 text-[10px] uppercase tracking-wider">{destSubtitle}</p>
              <p className="text-[10px] mt-1">{formatCoordinates(endNode[0], endNode[1]).combined}</p>
            </div>
          </Tooltip>
        </Marker>

        {/* Spacecraft Active Position Marker */}
        <Marker position={currentPos} icon={spacecraftIcon}>
          <Tooltip direction="top" offset={[0, -22]} opacity={0.95}>
            <div className="font-mono text-xs p-1 space-y-0.5">
              <p className="font-bold text-cyan-400">ARTEMIS VEHICLE</p>
              <p>Lat/Lon: {formattedCoords.combined}</p>
              <p>Speed: {hudSpeed} ({hudMach})</p>
              <p>Altitude: {hudAltitude}</p>
              {telemetry && <p>Heading: {telemetry.headingStr}</p>}
            </div>
          </Tooltip>
        </Marker>

        {/* Map Controller for Camera Bounds & Tracking */}
        <MapController
          bounds={bounds}
          currentPos={currentPos}
          cameraMode={cameraMode}
        />
      </MapContainer>

      {/* Floating In-Map Telemetry HUD Overlay */}
      {showHudOverlay && (
        <div
          className="absolute top-4 right-4 z-[500] pointer-events-none transition-all duration-200 select-none max-w-[280px] sm:max-w-[320px]"
        >
          <div
            className="p-3 sm:p-4 rounded-lg font-mono text-xs border backdrop-blur-md shadow-2xl space-y-2 pointer-events-auto"
            style={{
              backgroundColor: themeConfig.id === 'e-ink' ? 'rgba(255, 255, 255, 0.95)' : 'rgba(7, 11, 20, 0.88)',
              borderColor: themeConfig.id === 'e-ink' ? '#000000' : themeConfig.borderColor,
              color: themeConfig.textMain,
              boxShadow: themeConfig.id === 'nasa-dark' ? '0 0 20px rgba(0, 240, 255, 0.15)' : '0 4px 12px rgba(0,0,0,0.3)'
            }}
          >
            {/* Header / Flight Phase */}
            <div className="flex items-center justify-between border-b pb-1.5" style={{ borderColor: themeConfig.borderColor }}>
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block w-2 h-2 rounded-full animate-ping"
                  style={{ backgroundColor: themeConfig.accentPrimary }}
                />
                <span className="font-bold text-[11px] tracking-wider uppercase" style={{ color: themeConfig.accentPrimary }}>
                  {telemetry?.regime || 'ORBITAL TELEMETRY'}
                </span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ backgroundColor: themeConfig.badgeBg, color: themeConfig.badgeText }}>
                {hudMach}
              </span>
            </div>

            {/* Position & Altitude Grid */}
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-[10px] block opacity-60 uppercase tracking-tight">Coordinates</span>
                <span className="font-bold">{formattedCoords.latStr}</span>
                <span className="block text-[10px] font-mono">{formattedCoords.lonStr}</span>
              </div>
              <div>
                <span className="text-[10px] block opacity-60 uppercase tracking-tight">Altitude</span>
                <span className="font-bold">{hudAltitude}</span>
                {telemetry && <span className="block text-[10px] opacity-75">{telemetry.altitudeMi} mi</span>}
              </div>
            </div>

            {/* Phase / Status Banner */}
            <div
              className="p-1.5 rounded text-[10px] font-medium leading-tight"
              style={{
                backgroundColor: themeConfig.id === 'e-ink' ? '#f4f4f5' : 'rgba(255, 255, 255, 0.05)',
                borderLeft: `3px solid ${themeConfig.accentPrimary}`
              }}
            >
              <span className="opacity-60 block text-[9px] uppercase">Flight Phase:</span>
              <span className="font-bold">{hudPhase}</span>
            </div>

            {/* Distortion Delta if Mercator is active */}
            {showMercatorChord && distortionStats && (
              <div
                className="pt-1 border-t text-[10px] flex justify-between items-center"
                style={{ borderColor: themeConfig.borderColor }}
              >
                <span className="opacity-70">Mercator Distortion:</span>
                <span className="font-bold text-amber-400">
                  +{distortionStats.deltaMiles.toFixed(1)} mi (+{distortionStats.percentageDistortion.toFixed(2)}%)
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
