<div align="center">

# 🎯 Browser Shooter

**A 3D first-person shooter that runs entirely in your browser — from solo wave survival to CS-style 5v5 competitive with a bomb objective, an economy, and a buy menu.**

[**▶ Play the Live Demo**](https://vkopitsa.github.io/browser-shooter/)

[![CI](https://github.com/vkopitsa/browser-shooter/actions/workflows/ci.yml/badge.svg)](https://github.com/vkopitsa/browser-shooter/actions/workflows/ci.yml)
[![Deploy](https://github.com/vkopitsa/browser-shooter/actions/workflows/deploy.yml/badge.svg)](https://github.com/vkopitsa/browser-shooter/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](#license)
[![Tests](https://img.shields.io/badge/tests-1000%2B%20unit%20%2B%20E2E-brightgreen.svg)](#testing)
[![Vibecoded](https://img.shields.io/badge/100%25-vibecoded-ff69b4.svg)](#vibecoding)

![Three.js](https://img.shields.io/badge/Three.js-000000?logo=three.js&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)
![WebRTC](https://img.shields.io/badge/Multiplayer-PeerJS%20%2F%20WebRTC-FF6600)

</div>

---

## Screenshots

<div align="center">

![Demo](screenshots/demo.gif)

| Main Menu | In-Game |
|:---------:|:-------:|
| ![Main Menu](screenshots/main-menu.png) | ![Gameplay](screenshots/gameplay.png) |

| Map Editor |
|:----------:|
| ![Map Editor](screenshots/map-editor.png) |

| Planetary | Planetary Picker |
|:---------:|:----------------:|
| ![Planetary](screenshots/planetary.png) | ![Planetary Picker](screenshots/planetary-picker.png) |

</div>

---

## Overview

Browser Shooter is a fast-paced 3D FPS built with **Three.js** and **React**. Everything — rendering, physics, audio, AI, networking, and game logic — runs client-side. There is **no game server**: multiplayer is peer-to-peer over WebRTC, with one player acting as the host-authoritative simulation.

It ships with three distinct experiences:

- 🧟 **Singleplayer** — Classic arena **wave survival**. Fight escalating waves of enemies, collect pickups, chase a persistent high score. Add AI bots to fill out the arena.
- 🔫 **Multiplayer** — Peer-to-peer **PvP** with a full **CS-style competitive mode**: Terrorists vs. Counter-Terrorists, round-based play, a plantable/defusable **C4 bomb objective**, a money **economy**, and a **buy menu** — on five hand-built competitive maps plus a procedurally generated random map, with AI teammates and opponents.
- 🌍 **Planetary** — Fight **anywhere on Earth**. Pick a spot on a world map and the game builds a playable level from real **OpenStreetMap** data — actual streets, buildings, and terrain — with a dynamic sun, a live minimap, and drop-in P2P multiplayer that matches you with players fighting nearby.

## Vibecoding

This project is **100% vibecoded**: every line of code, every test, and this README were written by an AI coding agent ([Claude Code](https://claude.com/claude-code)) directed through natural-language conversation. No code was written by hand.

## Game Modes

| Mode | Description |
|------|-------------|
| **Singleplayer — Wave Survival** | Survive progressively harder waves of Grunts, Runners, and Tanks. Health/ammo pickups spawn between waves. High score persists in `localStorage`. |
| **Multiplayer — Deathmatch / PvP** | Host or join a room over WebRTC. Host-authoritative simulation with lag compensation and client-side prediction. |
| **Multiplayer — Competitive (CS-style)** | Round-based CT vs. T play with a bomb objective, per-round economy, a buy phase, and a match score (first to the configured round limit). Fill empty slots with **AI bots**. |
| **Planetary** | Pick any location on Earth and fight in a level generated from real OpenStreetMap streets, buildings, and elevation — with a dynamic sun cycle, a circular minimap, and zoom-aware drop-in matchmaking into nearby live rooms. |

## Features

- **Three full game modes** — solo wave survival, peer-to-peer multiplayer (including CS-style competitive), and real-world Planetary battles.
- **Planetary mode** — Real-world levels streamed from OpenStreetMap tiles: buildings, streets, and terrain elevation anywhere on the planet, with a sun/atmosphere system, auto-degrading postprocessing for steady framerates, and drop-in P2P matches near your chosen spot.
- **Bomb objective** — Terrorists carry and plant the C4 at site A or B; Counter-Terrorists race to defuse (faster with a defuse kit). Plant/defuse timers, explosion, and win conditions are fully simulated.
- **Economy & buy menu** — Earn money from kills, wins, and losses; spend it each round on weapons, armor, grenades, a defuse kit, and utility upgrades.
- **Deep weapon roster** — Pistols (USP, Glock, Deagle), rifles (M4, AUG, AK-47, Galil), MP5, Shotgun, and the AWP, each with distinct damage, fire rate, spread, range, and reload.
- **Grenades** — HE grenade, Flashbang (with screen-flash blinding), and Smoke grenade, with full and short throws.
- **AI bots** — CS-style team bots that buy, navigate, fight, and play the objective. Add/remove them on the fly.
- **Six competitive zones** — Arid, Crossing, Ember, Haze, Reactor, and a procedurally generated **Random** zone, selectable from the room setup — plus your own maps from the editor.
- **3D Map Editor** — Drag-and-drop block placement with orbit camera, material picker, spawn/bombsite markers, and one-click save. Accessible from the singleplayer zone select screen.
- **Rebindable controls** — Full keybind editor (Settings → Keybinds) with CS-style per-key capture and live in-game updates.
- **Lobby passwords** — Password-protect rooms for both lobby and free-join policies.
- **Voice chat** — In-game push-to-talk voice over the peer mesh, with on-screen speaker indicators.
- **Configurable crosshair** — Live crosshair editor with dynamic bloom that reacts to movement and firing.
- **Enemy variety & AI** — Grunts, Runners, and Tanks with chase/attack behavior and difficulty scaling.
- **Particle & visual effects** — Muzzle flash, bullet-impact sparks, blood splatter, death explosions, damage vignette, flash overlay.
- **Spatial audio** — Web Audio API with HRTF spatialization, pitch variation, and synthesized fallbacks.
- **Rich HUD** — Health/armor, ammo, weapon & money indicators, round/score state, kill feed, minimap, scoreboard, respawn and match-over overlays.
- **Server directory & matchmaking** — Browse, filter, and ping public rooms, or use quick matchmaking.
- **Mobile-ready** — Responsive UI with on-screen touch controls and a rotate hint for portrait devices.

## Controls

| Key / Input | Action |
|-------------|--------|
| `W` `A` `S` `D` | Move |
| Mouse | Look |
| Left Click | Shoot / Throw grenade |
| Right Click | Short-throw grenade |
| `1` – `3` | Switch weapon |
| `4` – `6` | Select grenade (HE / Flash / Smoke) |
| `G` | Cycle grenade type |
| `R` | Reload |
| `Space` | Jump |
| `B` | Buy menu |
| `5` | Plant bomb (T, in a bombsite) |
| `E` | Defuse bomb (CT, near the bomb) |
| `Tab` | Scoreboard |
| `K` | Push-to-talk (voice) |
| `M` | Toggle mute |
| `H` | Help |
| `ESC` | Pause / Resume |
| `[` `]` `\` | Add CT bot / Add T bot / Remove last bot |

> All keys are rebindable via **Settings → Keybinds**.

## Tech Stack

| Technology | Purpose |
|------------|---------|
| [Three.js](https://threejs.org/) | 3D rendering, scene graph, materials, shadows |
| [React 19](https://react.dev/) | UI layer — HUD, menus, overlays |
| [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) | 3D Map Editor scene |
| [TypeScript](https://www.typescriptlang.org/) | Type-safe game logic and tooling |
| [Vite 6](https://vitejs.dev/) | Build tool and dev server |
| [PeerJS / WebRTC](https://peerjs.com/) | Peer-to-peer multiplayer signalling & transport, voice |
| [MapLibre GL](https://maplibre.org/) | Planetary mode world-map picker & minimap |
| [postprocessing](https://github.com/pmndrs/postprocessing) | Planetary visual effects pipeline |
| [Vitest](https://vitest.dev/) | Unit testing (1,000+ tests across 120+ files) |
| [Playwright](https://playwright.dev/) | End-to-end browser testing (10 spec files) |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 22+
- npm (comes with Node.js)

### Installation

```bash
git clone https://github.com/vkopitsa/browser-shooter.git
cd browser-shooter
npm install
```

### Development

```bash
npm run dev          # Start Vite dev server (http://localhost:5173)
```

### Testing

```bash
npm test             # Run all unit tests (Vitest)
npm run test:e2e     # Run E2E tests (Playwright, Chromium)
npm run lint         # ESLint
```

### Build

```bash
npm run build        # Production build → dist/
npm run preview      # Preview the production build locally
```

## Multiplayer Broker

Multiplayer signalling runs over PeerJS. By default the app uses the **public `0.peerjs.com` cloud broker**, which is rate-limited — heavy testing can earn a temporary Cloudflare `1015` IP ban, after which room codes and the server list stop appearing. To avoid that, run your own broker:

```bash
npm run peerserver   # local PeerJS broker on :9000
```

Then copy `.env.example` to `.env.local`, uncomment the `VITE_PEER_*` lines, and restart `npm run dev`. For two machines on a LAN, set `VITE_PEER_HOST` to the broker host's LAN IP. With no `.env.local`, the app keeps using the public broker.

## Project Structure

```
browser-shooter/
├── .github/workflows/   # CI/CD: ci.yml, deploy.yml, release.yml
├── e2e/                 # Playwright E2E specs (gameplay, UI, competitive, bomb, buy menu, multiplayer…)
├── public/              # Static assets (audio samples)
├── src/
│   ├── audio/           # Web Audio: AudioManager, SoundEffects, spatial audio
│   ├── bots/            # AI bot controller, behavior, names
│   ├── effects/         # Particle systems — muzzle flash, impacts, explosions, flash
│   ├── enemies/         # Singleplayer enemy AI, defs, wave manager
│   ├── engine/          # Three.js engine — renderer, camera, arena, lighting, game loop
│   ├── entities/        # Shared 3D character model
│   ├── net/             # P2P networking — host/client, PeerJS, directory, matchmaking, lag comp
│   ├── planetary/       # Planetary mode — OSM tiles, buildings, elevation, sun, minimap, map picker
│   ├── player/          # Player state, controls, purchase application
│   ├── session/         # Authoritative game session — rounds, bomb, economy, spawns, scoreboard
│   ├── settings/        # Settings, crosshair & keybind persistence
│   ├── systems/         # Health, ammo, score, pickups
│   ├── ui/              # React components — HUD, menus, buy menu, scoreboard, overlays, touch, map editor
│   ├── voice/           # Push-to-talk voice chat over the peer mesh
│   ├── weapons/         # Weapon defs, manager, viewmodel, grenades, store catalog, crosshair bloom
│   ├── zones/           # Competitive zones (Arid, Crossing, Ember, Haze, Reactor, Random) + map store
│   ├── App.tsx          # Root component & game-state orchestration
│   ├── main.tsx         # Entry point
│   └── types.ts         # Shared type definitions
├── index.html
├── vite.config.ts       # Vite + Vitest configuration
├── playwright.config.ts
└── package.json
```

## Deployment

Pushing to `main` triggers GitHub Actions:

1. **CI** — Lint, unit tests, E2E tests, and a production build.
2. **Deploy** — Automatic deployment to [GitHub Pages](https://vkopitsa.github.io/browser-shooter/).

Tag with `v*` (e.g. `v1.0.0`) to trigger a release build with a distributable zip attached to the GitHub Release.

## License

[MIT](LICENSE)
