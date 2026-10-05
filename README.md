# Harvest Lane

A cute cartoon farm tycoon game for the web. Plant and harvest crops, fill delivery orders, build workshops that turn crops into goods, and hire helpers who work on their own.

Built with Vite, TypeScript and three.js (pinned at 0.149.0, the version the prototype used). The original single-file prototype is kept untouched in `assets/harvest-lane-prototype.html` as the reference; the project brief is `assets/CLAUDE.md`.

## Run it

You need Node.js 18 or newer.

```bash
npm install
npm run dev
```

Open the "Local" address it prints. To play on a phone or iPad, connect it to the same Wi-Fi and open the "Network" address (for example `http://192.168.1.20:5173`). On Windows, allow Node through the firewall the first time it asks.

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload, reachable on your local network |
| `npm run build` | Type-checks and builds the game into `dist/` |
| `npm run preview` | Serves the built `dist/` on your network, with offline support switched on |
| `npm test` | Runs the game-logic tests |
| `npm run typecheck` | Type-checks without building |

## Install to the home screen and play offline

The production build is a PWA. Run `npm run build` then `npm run preview`, open it, and use "Add to Home Screen" (iOS Safari) or "Install app" (Chrome, Edge, Android). After the first visit it works with no connection. The service worker is only registered in production builds, so `npm run dev` always serves fresh code.

Phones only allow installing and offline mode over HTTPS or on `localhost`. Testing over local Wi-Fi with a plain `http://192.168...` address plays fine but will not install; host `dist/` on any static HTTPS host to try that part on a phone.

Fonts (Lilita One and Nunito) are bundled from npm (`@fontsource`), so nothing loads from Google Fonts or a CDN.

## Code layout

```
src/
  main.ts            boot and game loop
  data/              crops, goods, machines, customers, limits (pure data)
  game/              state (save/load, versioned migrations), economy, orders, sim, events, clock
  scene/             renderer, camera, materials (toon + outline), geometry (roundedBox, part)
  scene/world/       ground, barn, workshops, plots, crops, props (trees, fences, pond, cart)
  scene/actors/      person (chibi rig + poses), ai (tap queue, farmhands, sellers), animals
  scene/fx/          particles, flyers, labels (HTML overlay)
  ui/                hud, seeds, panel (orders, barn, machines, helpers), actions, toasts
  input/             pointer (tap vs drag, pinch, wheel, raycast picking)
sw/sw.js             service worker template; the build fills in the file list
tests/               game-logic tests (Vitest)
```

`game/` never imports three.js or touches the DOM. It announces what happened through `game/events.ts` (`plant`, `harvest`, `machineDone`, `sellerSale`, `levelUp`, `earn`) and the scene and UI react, so the rules can be unit tested and later run on a server.

Saves live in `localStorage` under `harvest-lane-3d-v1` with a `version` field. To change the save shape, bump `SAVE_VERSION` in `src/game/state.ts` and add a step to `MIGRATIONS`.

## Art

`assets/concept/` is the target look and `assets/elements/` holds the painted UI sheets. The sprites the game uses are cut from those sheets into `public/ui/*.webp` (crops, coin, star, avatar, portraits, tab icons, plus spare ones like gem, energy, milk and wood for later features). `src/ui/art.ts` maps items to sprites; anything without art (the workshop goods) still shows its emoji.

The farmer, helpers and animals are 3D models built from smooth, high-detail shapes with soft shading and thin outlines (`src/scene/actors/smooth.ts`), so they read as rounded toys like the concept instead of low-poly shapes. Townsfolk from the character sheets are the customer portraits on order cards (`public/chars/`). The wooden panels sheet gives `public/ui/board-frame.webp`, drawn around the Farm Office panel with CSS `border-image`.


## Saving

The farm saves to the browser's localStorage every few seconds. On the hosted claude.ai build it is also saved to the artifact's private per-player store (`src/cloud.ts`, the page declares the `db` and `user` capabilities), so progress survives cleared browser data and carries across devices. When both exist, the newer save wins.

## Online play (Firebase + Cloudflare Pages)

The public build can sign players in with Google or email (Firebase Auth) and keep each farm in Firestore at `farms/{uid}`; players can also skip sign-in and keep a browser-only save.

1. In the Firebase console, add a Web app and put its `firebaseConfig` values in `.env.production` (see `.env.example`). They identify the project; they are not secrets.
2. Turn on Google and Email/Password under Authentication > Sign-in method, and create a Firestore database.
3. Paste `firestore.rules` into Firestore > Rules and publish (each player can only read and write their own farm).
4. `npm run build` and upload `dist/` to Cloudflare Pages (Workers & Pages > Create > Pages > Upload assets).
5. Add the Pages domain (for example `harvest-lane.pages.dev`) under Authentication > Settings > Authorized domains.

Without a Firebase config the build skips sign-in. On claude.ai the artifact's own per-user store is used instead.
