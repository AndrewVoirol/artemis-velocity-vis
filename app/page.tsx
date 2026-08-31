import ArtemisFlightSimulator from '@/components/ArtemisFlightSimulator';

export default function Home() {
  return (
    <main className="w-full h-screen overflow-hidden">
      <ArtemisFlightSimulator
        initialPreset="lunar-return"
        initialTheme="nasa-dark"
        initialVelocityMph={24500}
        showMercatorDefault={true}
      />
    </main>
  );
}
