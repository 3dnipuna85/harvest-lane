# Harvest Lane — project brief

Harvest Lane is a cute, cartoon-style farm tycoon game. The player plants and harvests crops, fills delivery orders, builds workshops that turn crops into goods, and hires helpers who work on their own. It targets mobile web first, then iPhone, iPad, Android and Mac from one codebase.

`harvest-lane-prototype.html` is the working prototype: one self-contained HTML file built with three.js, about 1,300 lines. Treat it as the reference for gameplay, feel and look. Do not edit it in place; port it into the project structure below.

## First task

1. Create a Vite + TypeScript project in this folder.
2. Port the prototype into modules (see Architecture). Keep behaviour identical.
3. Install `three` from npm and pin it. Do not load it from a CDN.
4. Self-host the fonts (Lilita One for display, Nunito for body). Google Fonts and jsDelivr are unreliable in mainland China, where the developer lives.
5. Add a PWA manifest and service worker so the game installs to the home screen and works offline.
6. Run the dev server with `--host` so it can be tested on a phone or iPad over local Wi-Fi.
7. Initialise git and commit the working port before starting new features.

## Game design (current numbers)

### Crops

| Crop | Seed cost | Grow time | Sell price | Unlocks at level | XP |
|---|---|---|---|---|---|
| Wheat | 2 | 6s | 4 | 1 | 1 |
| Corn | 6 | 12s | 11 | 2 | 2 |
| Carrot | 10 | 18s | 18 | 3 | 3 |
| Tomato | 16 | 28s | 30 | 5 | 5 |
| Strawberry | 26 | 40s | 50 | 7 | 7 |

Harvests have a 15% chance to yield double.

### Workshops

| Workshop | Recipe | Output | Time | Build cost | Unlocks at level |
|---|---|---|---|---|---|
| Bakery | 3 wheat | Bread (sells 22) | 8s | 120 | 2 |
| Popcorn Pot | 2 corn | Popcorn (38) | 10s | 350 | 3 |
| Juicer | 3 carrot | Carrot Juice (72) | 14s | 900 | 4 |
| Cannery | 3 tomato | Tomato Sauce (120) | 18s | 2200 | 6 |
| Cake Oven | 2 strawberry + 1 bread | Strawberry Cake (260) | 24s | 5000 | 8 |

Each workshop runs automatically when its ingredients are in the barn and has a Run on/off toggle. It can be upgraded to level 5; each level makes it 18% faster, at a cost of 0.6 × build cost × current level.

### Other systems

- **Plots:** the farm starts with 6 plots, with a maximum of 20. Each new plot costs 40 × 1.5^(plots − 6).
- **Orders:** there are always 3 delivery orders from named customers. Each pays about 1.6× market value plus XP. Skipping an order has a 15s cooldown.
- **Farmhands:** unlock at level 2, maximum 6, cost 80 × 1.8^n. They walk to ripe plots, harvest them, and replant with the selected seed.
- **Market sellers:** unlock at level 3, maximum 5, cost 150 × 1.9^n. Each one sells one of the best goods every 2.5s from the road cart. An option lets them also sell raw crops above 10.
- **Levels:** XP needed for the next level is round(14 × level^1.55). Levelling up shows a toast listing what was unlocked.
- **Player input:** tapping a plot queues a job (up to 12). The farmer walks over and then plants or harvests. Tapping a growing plot shows the time left.
- **Saving:** the game state saves to localStorage every 5s and when the tab is hidden. Crops keep growing while the player is away because growth is based on timestamps.

## Art direction

The goal is a cute cartoon look in the style of mobile farm games like Hay Day or Farm Away. Avoid flat low-poly facets.

- **Shading:** cel shading with `MeshToonMaterial` and a 4-step gradient map (110, 185, 240, 255).
- **Outlines:** ink outlines in `#4a2e1a`, drawn as an inverted hull: a back-face mesh pushed out along its normals in the vertex shader. See `olMat()` in the prototype.
- **Shapes:** rounded everywhere. Use the rounded-box helper `roundedBox()`, capsules and spheres; avoid hard boxes.
- **Characters:** chibi proportions with a big round head, eyes with white highlights, rosy cheeks, overalls and a straw hat tilted back. They face the camera (rotation π/4) while working.
- **Ground:** painted onto one large canvas texture with grass blotches, flowers, curvy dirt paths with pebbles, and a tilled field area.
- **Camera:** orthographic isometric, positioned at (24, 21, 24) and looking at the origin. Drag to pan, wheel, pinch or the +/− buttons to zoom.
- **Palette:** grass `#74c043`, soil `#a8693b`, barn red `#d9483a`, ink `#4a2e1a`, coin gold `#f0b21a`.
- **Motion:** hop when walking, squash-and-stretch when swinging the hoe, crops bounce and sparkle when ripe, harvested items fly in an arc to the barn, workshops puff smoke and bob while working, and new buildings pop in with a dust cloud.

Later, replace the procedural models with glTF models from Blender while keeping the same names, positions and animation hooks.

## Architecture (target)

```
src/
  main.ts            boot, game loop
  data/              crops.ts, goods.ts, machines.ts, customers.ts  (pure data)
  game/              state.ts (save/load, migrations), economy.ts, orders.ts, sim.ts
  scene/             renderer.ts, camera.ts, materials.ts (toon, outline), geometry.ts (roundedBox)
  scene/world/       ground.ts, barn.ts, workshops.ts, plots.ts, crops.ts, props.ts
  scene/actors/      person.ts, ai.ts (queue, farmhands), animals.ts
  scene/fx/          particles.ts, flyers.ts, labels.ts (HTML overlay)
  ui/                hud.ts, seeds.ts, panel.ts (orders, barn, machines, helpers), toasts.ts
  input/             pointer.ts (tap vs drag, pinch, raycast picking)
```

- Keep game logic (`game/`) free of three.js so it can be unit tested and later run on a server.
- Version the save format. Add a `version` field and migrations.
- Target 60 fps on a mid-range phone. Use instancing for repeated props, and cache geometries and materials (the prototype already does).

## Roadmap ideas

- Sound effects and music, plus haptics on mobile.
- Animal products (milk from cows, eggs from chickens) and feeding.
- A tap-to-collect coin pop on finished workshops, as an optional setting.
- Daily quests, an achievement list and a quest log.
- Decorations the player can place, with a build/move mode.
- Cloud save, then iPhone and Android builds with Capacitor (in-app purchases, notifications).
- A tutorial for the first two minutes of play.

## Conventions

- The UI copy is plain and friendly, and buttons say exactly what they do.
- Commit after each working feature with a short message.
- Test on a phone-sized viewport (about 390px wide) as well as desktop.
