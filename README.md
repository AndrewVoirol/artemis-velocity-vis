# Artemis Velocity Vis

An interactive visualization that demonstrates the speed of NASA's Artemis II spacecraft by simulating it traveling between real locations on Earth.

**Speed: 24,500 mph** — watch the spacecraft cross continents in seconds.

## Features

- **Geodesic trajectories** — routes follow true great-circle arcs, not straight lines on a flat projection
- **Live camera tracking** — the map pans to follow the spacecraft in real time
- **Telemetry dashboard** — distance, elapsed time, ETA, and progress displayed live
- **Adjustable simulation speed** — 1× to 100× time multiplier
- **Two preset routes** — NYC → San Francisco and London → Tokyo

## Tech Stack

- [Next.js 15](https://nextjs.org/) + [React 19](https://react.dev/)
- [Leaflet](https://leafletjs.com/) via [react-leaflet](https://react-leaflet.js.org/)
- [Tailwind CSS v4](https://tailwindcss.com/)
- [TypeScript](https://www.typescriptlang.org/)

## Getting Started

```bash
# Install dependencies
npm install

# Run the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the visualization.

## How It Works

The app computes the [Haversine distance](https://en.wikipedia.org/wiki/Haversine_formula) between two coordinates, then animates the spacecraft along the [great-circle path](https://en.wikipedia.org/wiki/Great-circle_distance) at 24,500 mph using spherical interpolation (slerp). A `requestAnimationFrame` loop drives the simulation clock.

## License

[MIT](LICENSE)
