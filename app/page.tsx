'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Map as MapIcon, Navigation, Play, RotateCcw, FastForward } from 'lucide-react';
import { calculateDistance, interpolatePosition, geodesicArc } from '@/lib/utils';

// Dynamically import Map to avoid SSR issues with Leaflet
const Map = dynamic(() => import('@/components/Map'), { ssr: false });

const ROUTES = {
  'Coast to Coast (NYC to SF)': {
    start: [40.7128, -74.0060] as [number, number],
    end: [37.7749, -122.4194] as [number, number],
  },
  'London to Tokyo': {
    start: [51.5074, -0.1278] as [number, number],
    end: [35.6762, 139.6503] as [number, number],
  }
};

const SPEED_MPH = 24500;
const SPEED_MPS = SPEED_MPH / 3600; // Miles per second

export default function Home() {
  const [selectedRoute, setSelectedRoute] = useState<keyof typeof ROUTES>('Coast to Coast (NYC to SF)');
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0); // in seconds
  const [multiplier, setMultiplier] = useState(1);
  
  const route = ROUTES[selectedRoute];
  const totalDistance = calculateDistance(route.start[0], route.start[1], route.end[0], route.end[1]);
  const totalTime = totalDistance / SPEED_MPS;
  
  const progress = Math.min(elapsedTime / totalTime, 1);
  const currentDistance = progress * totalDistance;
  const currentPos = interpolatePosition(route.start[0], route.start[1], route.end[0], route.end[1], progress);
  const arcPoints = geodesicArc(route.start[0], route.start[1], route.end[0], route.end[1]);
  const eta = Math.max(totalTime - elapsedTime, 0);

  const lastTimeRef = useRef<number | null>(null);
  const requestRef = useRef<number | null>(null);

  const animate = (time: number) => {
    if (lastTimeRef.current != null) {
      const deltaTime = (time - lastTimeRef.current) / 1000; // to seconds
      setElapsedTime(prev => {
        const nextTime = prev + (deltaTime * multiplier);
        if (nextTime >= totalTime) {
          setIsRunning(false);
          return totalTime;
        }
        return nextTime;
      });
    }
    lastTimeRef.current = time;
    if (isRunning) {
      requestRef.current = requestAnimationFrame(animate);
    }
  };

  useEffect(() => {
    if (isRunning) {
      requestRef.current = requestAnimationFrame(animate);
    } else {
      lastTimeRef.current = null;
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, multiplier, totalTime]);

  // Reset when route changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsRunning(false);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setElapsedTime(0);
    lastTimeRef.current = null;
  }, [selectedRoute]);

  const handleLaunch = () => {
    if (progress >= 1) {
      setElapsedTime(0);
    }
    setIsRunning(true);
  };

  const handleReset = () => {
    setIsRunning(false);
    setElapsedTime(0);
  };

  return (
    <div className="flex h-screen w-full bg-white text-black overflow-hidden font-sans">
      {/* Sidebar */}
      <div className="w-[320px] shrink-0 border-r-4 border-black flex flex-col z-10 bg-white">
        
        {/* Header */}
        <div className="p-6 border-b-4 border-black">
          <div className="flex items-center gap-3 mb-4">
            <div className="border-4 border-black p-1">
              <MapIcon size={28} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="font-bold text-2xl tracking-tight leading-none">ARTEMIS</h1>
              <p className="text-xs font-bold tracking-widest uppercase mt-1">Velocity Vis</p>
            </div>
          </div>
          <div className="font-mono text-sm space-y-1">
            <p>Speed: 24,500 mph</p>
            <p>Scale: Earth Surface</p>
          </div>
        </div>

        {/* Route Select */}
        <div className="p-6 border-b-4 border-black">
          <h2 className="font-bold text-sm tracking-widest uppercase mb-3">Route Select</h2>
          <select 
            className="w-full border-4 border-black p-3 font-mono text-sm bg-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
            value={selectedRoute}
            onChange={(e) => setSelectedRoute(e.target.value as keyof typeof ROUTES)}
          >
            {Object.keys(ROUTES).map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        {/* Telemetry */}
        <div className="p-6 border-b-4 border-black flex-1 overflow-y-auto min-h-0">
          <div className="flex items-center gap-2 mb-4">
            <Navigation size={16} strokeWidth={2.5} />
            <h2 className="font-bold text-sm tracking-widest uppercase">Telemetry</h2>
          </div>

          <div className="space-y-4">
            {/* Speed Box */}
            <div className="border-4 border-black p-3">
              <p className="font-bold text-xs tracking-widest uppercase mb-1">Speed</p>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-3xl font-bold">24,500</span>
                <span className="font-bold text-sm">mph</span>
              </div>
            </div>

            {/* Dist / Time Row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="border-4 border-black p-3">
                <p className="font-bold text-xs tracking-widest uppercase mb-1">Dist</p>
                <div className="flex items-baseline gap-1">
                  <span className="font-mono text-xl font-bold">{currentDistance.toLocaleString('en-US', {maximumFractionDigits: 0})}</span>
                  <span className="font-bold text-xs">mi</span>
                </div>
              </div>
              <div className="border-4 border-black p-3">
                <p className="font-bold text-xs tracking-widest uppercase mb-1">Time</p>
                <div className="flex items-baseline gap-1">
                  <span className="font-mono text-xl font-bold">{elapsedTime.toFixed(1)}</span>
                  <span className="font-bold text-xs">s</span>
                </div>
              </div>
            </div>

            {/* Progress Box */}
            <div className="border-4 border-black p-3">
              <div className="flex justify-between items-end mb-2">
                <p className="font-bold text-xs tracking-widest uppercase">Progress</p>
                <span className="font-mono text-sm font-bold">{(progress * 100).toFixed(1)}%</span>
              </div>
              <div className="h-4 border-2 border-black w-full p-[2px]">
                <div 
                  className="h-full bg-black transition-all duration-100 ease-linear"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
              <div className="text-right mt-2">
                <span className="font-mono text-xs">ETA: {eta.toFixed(1)}s</span>
              </div>
            </div>
            
            {/* Speed Multiplier */}
            <div className="border-4 border-black p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="font-bold text-xs tracking-widest uppercase flex items-center gap-1">
                  <FastForward size={14} /> Sim Speed
                </p>
                <span className="font-mono text-sm font-bold">{multiplier}x</span>
              </div>
              <input 
                type="range" 
                min="1" 
                max="100" 
                value={multiplier} 
                onChange={(e) => setMultiplier(Number(e.target.value))}
                className="w-full accent-black"
              />
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="p-6 flex gap-4 bg-white shrink-0">
          <button 
            onClick={isRunning ? () => setIsRunning(false) : handleLaunch}
            className="flex-1 bg-black text-white border-4 border-black py-3 px-4 font-bold tracking-widest uppercase flex items-center justify-center gap-2 hover:bg-gray-900 transition-colors"
          >
            {isRunning ? (
              <>PAUSE</>
            ) : (
              <><Play size={18} fill="currentColor" /> LAUNCH</>
            )}
          </button>
          <button 
            onClick={handleReset}
            className="bg-white text-black border-4 border-black py-3 px-4 font-bold tracking-widest uppercase hover:bg-gray-100 transition-colors"
          >
            RESET
          </button>
        </div>
      </div>

      {/* Map Area */}
      <div className="flex-1 relative bg-[#f8f8f8]">
        <Map arcPoints={arcPoints} currentPos={currentPos} />
      </div>
    </div>
  );
}
