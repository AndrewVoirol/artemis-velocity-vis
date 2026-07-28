'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';

// Custom icon for the spacecraft (a simple black square with a white border)
const spacecraftIcon = new L.DivIcon({
  className: 'custom-div-icon',
  html: `<div style="width: 12px; height: 12px; background-color: white; border: 3px solid black;"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

interface MapProps {
  arcPoints: [number, number][];
  currentPos: [number, number];
}

function MapUpdater({ currentPos }: { currentPos: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.panTo(currentPos, { animate: true, duration: 0.5 });
  }, [currentPos, map]);
  return null;
}

export default function Map({ arcPoints, currentPos }: MapProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) return <div className="w-full h-full bg-[#f8f8f8]" />;

  // Compute bounds from all arc points
  const bounds = L.latLngBounds(arcPoints.map(p => L.latLng(p[0], p[1]))).pad(0.2);

  return (
    <MapContainer
      bounds={bounds}
      scrollWheelZoom={true}
      className="w-full h-full z-0"
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />
      <Polyline positions={arcPoints} pathOptions={{ color: 'black', weight: 3, dashArray: '8, 8' }} />
      <Marker position={currentPos} icon={spacecraftIcon} />
      <MapUpdater currentPos={currentPos} />
    </MapContainer>
  );
}
