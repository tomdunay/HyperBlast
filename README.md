# HYPERBLAST

An original vertical-scrolling shoot 'em up for the browser, in the late-80s Amiga style. You fly the **Strikeblaster**,
earn **Hard Cash**, and spend it at **Gorbo's Trade Hut**. All art, sound and music are generated in code at load time;
there are no asset files.

## Running

```bash
npm install
```

```bash
npm run dev
```

```bash
npm run build
```

`npm run build` type-checks with `tsc --noEmit` and then bundles to `dist/` with Vite.

### Debug flags

`?level=N&debug=1` skips the title and starts at level N (1–15) with $20,000.

`?seed=XXXXXXXX` starts a Randomiser run with that hex seed.

`?gentest=1` runs the generator self-test (see **Level generator** below).

In debug mode these keys work during play:

| Key | Effect |
|-----|--------|
| H | toggle hitboxes (blue = armoured part, red = vulnerable, grey = destroyed) |
| I | toggle invincibility |
| M | +5000 cash |
| K | kill every enemy on screen |
| B | jump to the next boss |
| N | jump to the next checkpoint |
| O | open the shop |
| L | finish the level |
| G | regenerate the current level with the next seed and restart it at checkpoint 0 |
| V | toggle a minimap of the whole level |

The minimap draws spawns as coloured dots (red = wave, orange = single, yellow = wall mount, cyan = capsule),
checkpoints as green lines, boss arenas in magenta, and the current view as a white box.

`?level=N` without `debug=1` just starts at that level.

## Controls

| Action | Keyboard | Gamepad |
|---|---|---|
| Move | Arrows / WASD | Left stick / D-pad |
| Fire | Space / Z (tapping fires faster than holding unless you own Auto Fire) | A / RT |
| Zapper (smart bomb) | X | B |
| Dive | C | X / Y |
| Pause | P / Esc | Start |
| Menus | Arrows + Enter, Esc back | D-pad + A |

Every gameplay key can be remapped in Options → Controls. Touch devices get a virtual stick (drag on the left 60% of the
screen) plus FIRE / ZAP / DIVE / pause buttons. The shop also works with the mouse or touch: tap an item to select it,
tap it again to buy.

The game fills the window and never stretches the image. The playfield is always 320×256. On a wider screen the view
grows sideways, up to 2.5:1 (enough for 21:9 monitors), and shows extra scenery on both sides: the level's walls
continue into cave walls, parallax props, lights and atmosphere. Press **F** to toggle browser fullscreen. Options →
SCREEN switches between three modes:

- **Wide fill** (default): fills the window edge to edge, widening the view to suit the screen.
- **Classic 5:4**: the original frame, as large as it fits.
- **Pixel perfect**: like wide fill, but only at whole-number scales.

Options → BLOOM GLOW toggles the WebGL post pass, and CRT FILTER adds scanlines, an aperture mask and slight
curvature on top of it.

In the shop, Fire or Enter buys, X or Backspace sells, and Esc leaves.

### Saving and continuing

The run saves automatically:

- at the start of every level and life;
- at each checkpoint;
- after the shop;
- when you close or hide the tab.

To stop mid-run, pause and choose **SAVE AND QUIT**. The title screen then offers **CONTINUE**, which shows your level,
lives and cash. Continue restarts at the last checkpoint with the same loadout, score, lives, cash, difficulty and
level seed. **END GAME** on the pause menu ends the run properly, with Hall of Fame entry. Game over and the ending
also clear the save.

### Threat

The game watches how strong your ship is and pushes back (`game/director.ts`), so a fully kitted Strikeblaster
still has to work for it. Threat is set by two things:

- **Power gap.** Every weapon level adds to a firepower rating, weighted by how often it really connects. Armour,
  regeneration and speed count for less. The rating is compared with what a sensible buyer has at that point in the
  game. Running ahead of that curve raises the threat, and running behind it lowers it.
- **Form.** A slow rubber band. About 25 seconds without being hit starts to lean on you. Taking hits and losing lives
  ease off, and this carries over between lives and levels.

As threat rises:

- enemies fire more often, with faster bullets that hit harder;
- enemies have more HP;
- enemies gain **flat armour**, which soaks a fixed amount from every hit (never more than 60%). Heavy weapons like the
  cannon, laser and homing missiles shrug it off, and chip-damage sprays like spread, side shot and twister feel it.
  That keeps choosing weapons meaningful instead of buying everything;
- **elite** enemies appear: gilded, glowing, tougher, faster-firing and worth more cash;
- waves bring mirrored **reinforcements**;
- bosses get more HP and fire faster.

The **THREAT** meter under the hi-score shows five levels. Gorbo radios in when it goes up. The regenerator now only
repairs after three seconds without damage. When you are underpowered, threat goes negative and enemies ease off.

## Game structure

- **15 levels.** Levels 1–5 are hand-authored: Primordial Sea, Fossil Caverns, Overgrown Hive, Biomech Fortress and
  Metallic Spaceways. Levels 6–15 come from the seeded generator; see **15 levels and Randomiser mode** below. Every
  level has its own palette, tile texture, parallax background, ambient particles, enemy set and music.
- **Bosses**: level 1 has one end boss (Carcinox). Levels 2–5 each have a mid boss (Ossuar, Larva Queen, Pipe Heart,
  Sentinel) and an end boss (Mother Spore, Vinemaw, Fleshforge, Overmind Engine). Every boss is built from separately
  destructible parts with crack, smoke and charred damage states. Each core stays armoured until the parts guarding it
  are destroyed, and it glints once it becomes vulnerable. Killing an end boss plays the **BOMB DEFUSED** sequence.
- **Shops**: at the halfway point of every level (after the mid boss on levels 2–5) and after every end boss. The final
  boss leads to Gorbo's closing speech, then the high-score table.
- **Six checkpoints per level.** Dying restarts you at the last checkpoint you passed.

### Death rule

You keep everything you bought. On death you lose **one Blaster power level** (never below 1) and any active Super
Power, and you respawn with a full shield and about 3 seconds of invincibility (the shield bubble). The Sauce meter
resets too. Score passes 50,000 and every 75,000 after that also award an extra life.

### The Sauce

Flying close to a bullet without touching it (a graze) fills the **Sauce** meter, and so do kill chains and broken
boss parts. A hit cools it off. The white notch is the danger line.

- **Banked** (past the notch, under a full bar): the next hit that would kill you is spent as a **Sauce Save**. You
  keep about 40% shield and a short invincibility bubble, and the meter empties.
- **Full**: the meter boils over into a few seconds of **HOT** shots, at 1.4× damage, with a pink rim on the screen.
  A full meter spends the bank, so a hot streak and a clutched save are a choice you make by how long you sit on it.

Gorbo commentates grazes, streaks, bosses, deaths, and the shop. He is not a reliable person.

### 2-player mode

Set Options → Players to "2 alternating". Each player has their own score, lives, cash, loadout, level and checkpoint.
Turns pass to the other player whenever the current player dies.

## Items (Gorbo's Trade Hut)

Prices go up by 50% of the base price for each level you already own. Selling returns half of what that level cost.
"Shop" below is the first hut where the item is stocked (L1 mid = 1, L1 end = 2, and so on).

| Item | Base price | Max | First shop | Effect |
|---|---|---|---|---|
| Power Up | 350 | 5 | 1 | More and fatter Blaster bolts |
| Spread Shot | 700 | 3 | 1 | Angled bolts from the wing fins |
| Side Shot | 550 | 3 | 1 | Fires left and right |
| Rear Shot | 500 | 3 | 1 | Fires backwards |
| Speed Up | 400 | 3 | 1 | Faster ship, bigger engine flames |
| Half Shield | 350 | – | 1 | Restore 50% of shield |
| Full Shield | 650 | – | 1 | Restore all shield |
| Zapper | 700 | 5 charges | 1 | Smart bomb (X) |
| Cannon | 1000 | 3 | 2 | Slow, heavy slugs that punch through small enemies |
| Dive | 600 | 5 charges | 2 | Duck under the scenery for 4 s (C) |
| Cash Magnet | 750 | 2 | 2 | Pulls cash bubbles towards you |
| Laser | 1300 | 3 | 3 | Piercing beams; upgrades add length and width |
| Homing Missile | 1800 | 3 | 3 | Seeks the nearest enemy or boss weak point |
| Armour | 1500 | 3 | 3 | +25 maximum shield per level |
| Wing Cannon | 1400 | 2 | 4 | Diagonal guns on the wing tips |
| Mines | 900 | 2 | 4 | Dropped behind you; area blast |
| Auto Fire | 1500 | 1 | 4 | Hold fire for the full rate |
| Electro Ball | 1800 | 2 | 5 | Orbiting balls that damage enemies and absorb bullets |
| Flamethrower | 1600 | 2 | 5 | Short-range cone; the pilot light flickers when idle |
| Rapid Fire | 1600 | 2 | 6 | Faster trigger for every gun |
| Drone | 2400 | 2 | 7 | Orbiting satellite that shoots and blocks bullets |
| Regenerator | 2200 | 2 | 7 | Slow shield regeneration |
| Twister | 2600 | 2 | 8 | Rotating multi-directional shots |
| Extra Life | 5000 | – | 1 | One more go |

The **Advice** button costs $100 and gets you a tip from Gorbo. Some of the tips are useful.

### In-level tokens

Shoot the silver capsules to release a spinning token, then fly into it:

| Token | Effect |
|---|---|
| P | Power Up |
| S | Speed Up |
| H | +40 shield |
| $ | +250 cash |
| Z | Zapper charge |
| D | Dive charge |
| X | **Super Power**: every weapon at maximum for 10 seconds |
| 1 | Extra life |

## Design notes: how each mechanic is reproduced

- **Slow scroll with a 50 Hz fixed step.** Scroll speed runs from 0.5 px/tick (level 1) to 0.62 px/tick (level 5). The
  loop in `main.ts` runs the simulation at exactly 50 Hz and renders at the display rate. Positions are interpolated
  with each entity's previous and current position, and world-attached objects carry the scroll delta in that
  interpolation.
- **Reverse scrolling.** If the ship is at the bottom edge and you keep holding down, the scroll target becomes −1.1
  px/tick, eased in and out. It can go back at most 1.5 screens behind the furthest point reached
  (`World.update`). Cash bubbles are attached to the world, so scrolling back lets you collect ones you missed.
- **Solid scenery and crushing.** `Scroller` bilinearly smooths the tile grid, adds fbm noise to get organic edges, and
  then shades it per pixel: bevel lighting from the field gradient, a texture for each theme, and Bayer dithering to an
  8-colour ramp. Collision uses the same pixel mask that was drawn, so it matches what you see exactly. Ship movement
  is resolved one axis at a time with sliding. When scenery moves into the ship, it is pushed out. If it is pinned
  against the screen edge, it is crushed and its shield drains each tick (`Player.update`, `World.crushPlayer`).
- **Deterministic spawns.** Every spawn has a scroll position and fires once, when the scroll crosses that position
  going forward. Killed enemies stay dead. Wall growths that leave through the top while you scroll backwards are
  re-armed. Restarting at a checkpoint marks every earlier spawn as spent.
- **Shield, not one-hit deaths.** Bullets and contact take shield away. A hit taken with an empty shield destroys the
  ship.
- **Tapping beats holding.** A new press fires after 4 ticks, but holding down only re-fires every 15 ticks. Auto Fire
  holds at the full rate, and Rapid Fire shortens both delays.
- **Visible weapons.** `Player.draw` stacks a separate pixel-art attachment sprite for every owned weapon: nose gun,
  laser rods, cannon barrel, spread fins, side pods, rear guns, wing cannons, missile racks, mine dispenser, rotating
  twister dish, armour plates, flamer nozzle and pilot light, and orbiting balls and drones.
- **Bosses.** These are data-driven (`bosses.ts`): a hull sprite, plus parts with their own hit points, guns
  (aimed, aimed-3, spread, ring, spiral, telegraphed beam, minion spawns), a `requires` list that gates armour, and a
  movement style (sway, figure-8, charge, track). They fire faster as parts are lost, and they die in a 3-second chain
  of explosions with screen shake.
- **Art.** Everything is drawn procedurally by `SB` (`engine/gfx.ts`): sphere, cylinder and bevel shading quantised
  to colour ramps with ordered dithering, depth-tested composition, dark outlines, and auto-generated flash, crack and
  charred variants.
- **Audio.** Sound effects are synthesised with Web Audio. Music comes from a small look-ahead step sequencer: a
  synthesised kick, snare and hats with breakbeat and house patterns, an acid saw bass with a resonant filter
  envelope, detuned square chord stabs, and a lead. There are 10 original tracks: title, five levels, boss, shop,
  ending and game over.

## 15 levels and Randomiser mode

**Classic mode** (the default) plays levels 1–5 exactly as hand-made. Levels 6–15 are produced by the generator from
one fixed built-in seed, so every player gets the same "official" levels:

| Level | Name |
|---|---|
| 6 | Abyssal Trench |
| 7 | Crystal Grotto |
| 8 | Ossified Wastes |
| 9 | Magma Veins |
| 10 | Fungal Labyrinth |
| 11 | Hive Foundry |
| 12 | Frozen Relay |
| 13 | Shattered Moon |
| 14 | Core Furnace |
| 15 | The Last Gate |

**Randomiser mode** (Options → LEVELS) generates all 15 levels from your seed, including 1–5:

- Terrain and spawns are generated.
- The 15 themes are shuffled so each one appears exactly once per run.
- Enemy rosters are generated.
- Bosses are generated, including remixed bosses built from two designs.
- Capsule tokens are generated.

To set the seed, select SEED in Options, press Enter, then edit it with up/down or by typing hex digits. REROLL SEED
picks a new one. The seed appears on the title screen, the level intro card, the in-game HUD and the Hall of Fame, so
a run can be shared. The same seed always produces the same levels.

## Level generator (`src/levels/generator.ts`)

`generateLevel(index, seed, randomise)` uses only the seeded `RNG` and never calls `Math.random()`. The same inputs
always produce byte-identical rows, spawns, checkpoints and bosses. Generation has six stages.

1. **Skeleton.** The level is built in this order:
   1. intro
   2. body, checkpoint
   3. body, then a mid-boss arena, checkpoint
   4. body, checkpoint
   5. body, checkpoint
   6. body, then the end-boss arena

   That gives 6 checkpoints and the halfway shop after the mid boss. Each "body" is 3–5 sections of 10–24 rows.
2. **Section grammar.** Sections are picked by weight from the table below. Wall widths taper smoothly from one
   section into the next. After a heavy section (corridor, zigzag or gauntlet) the next one is always a breather.

   | Section | What it is |
   |---|---|
   | open | Wide passage for big waves |
   | taper | Walls narrow or widen through the section |
   | corridor | Passage 6–9 tiles wide |
   | zigzag | Corridor that shifts left and right |
   | islands | Blocks sitting in the passage |
   | pillars | Paired blocks forming gates |
   | fork | Central block splitting the route into two lanes |
   | gauntlet | Corridor lined with wall turrets |
   | breather | Quiet open stretch with a capsule |

3. **Fairness validator.** The validator sweeps up from the start row. Every row must contain a reachable run of at
   least 5 open tiles, and that run must overlap the previous row's reachable run by at least 3 tiles. Wherever a row
   fails, 6 tiles are carved open, centred on the widest reachable run below it.
4. **Threat budget.** Each enemy type has a threat score (`STYLE` table), roughly hp × fire rate × speed. Each section
   gets a budget of `1.6 + 0.32 × level` (plus a little randomness). The budget is spent first on wall mounts (only
   where the wall is at least 2 tiles thick), then on up to 3 flying groups at least 5 rows apart. A section that
   overspends makes the next section quieter. Movement-pattern parameters are clamped to the open width of the row
   where the group spawns.
5. **Rosters.** Each texture style has its own set of flying and wall-mounted enemies. A few "guest" enemies from
   other styles are added, more of them at later levels. The chance of seeded **variants** rises with the level
   number. There are two variants per enemy type, `red` and `void`, made by palette-swapping the sprite and adjusting
   hp, fire rate, bullet type and cash. Six new enemy types are also in the mix:
   - **ray**: a manta that glides across the screen.
   - **minelayer**: drops slow mines.
   - **splitter**: splits into three when destroyed.
   - **orbiter**: circles the player.
   - **sniper**: a wall turret with a telegraphed sight line.
   - **swarm queen**: spawns wasps.
6. **Bosses.**
   - **Variants.** Later-level variants get an hp multiplier of `1 + 0.12 × tier`, guns that fire up to 30% faster, a
     palette swap and one extra core gun.
   - **Remixes.** About 30% of bosses (45% in Randomiser) are remixes: the hull and movement come from one design and
     the destructible parts from another, scaled and clamped onto the new hull. A remix never pairs a design with
     itself.
   - **Rotation.** Classic mode rotates through the base designs so each appears about equally often.
   - **Final boss.** Level 15's end boss is the Overmind Engine with maximum modifiers and a **second phase**. When
     its core falls below half health, two of its destroyed gun emplacements rebuild themselves.

The two new texture styles are **crystal** (faceted Worley cells, glowing gems, shard parallax) and **lava** (cracked
basalt with glowing fissures, basalt columns). Each generated level plays an existing track transposed to a new key
and tempo.

Later levels scale enemy hp by `1 + 0.04 × level`, bullet speed by `1 + 0.015 × level`, and cash drops by
`1 + 0.06 × level`.

**Verification.**
- `?gentest=1` generates 200 seeds × 15 levels. Current results: 0 fairness failures, 0 non-deterministic levels,
  about 0.5 ms per level on average and 32 ms at worst.
- An automated run beat every boss and reached the shop or ending on all 15 Classic levels and on 3 Randomiser seeds
  × 15 levels.

## Graphics pipeline

`graphics-overhaul-prompt.md` is the brief this pipeline was built from. Each in-level frame is drawn in this order:

1. **Copper-bar sky.** A raster gradient with moving bars, quantised to 12-bit colour.
2. **Far silhouettes** at 0.35× scroll.
3. **Near-background props** at 0.7× scroll: kelp, giant ribs, vines, pipes or girders, depending on the level.
4. **Caustics.** Animated underwater light, level 1 only.
5. **Scenery drop shadow.** Pre-rendered from the collision mask.
6. **Entity drop shadows.** Cached silhouettes of the ship, enemies and bosses, offset by each object's height.
7. **Foreground scenery.** Strata, rim light, contact shading, a specular glint on metal, and decorations stamped
   along the wall edges and inside the walls.
8. **Running lights** embedded in the scenery, drawn additively.
9. **Sprites.** Every procedural sprite gets an automatic rim light and underside shading.
10. **Additive glow pass.** Bullets with trails, engines, satellites, tokens, exposed boss cores, beams, explosion
    flashes and embers. Glows are quantised and dithered so they stay pixel art.
11. **Dynamic scenery lighting.** Light sources are drawn into an offscreen buffer, masked to the wall pixels, then
    added on top, so walls light up around them. The sources are:
    - explosions and their flashes;
    - the ship's engines and muzzle flashes;
    - cannon, laser and flamethrower shots;
    - enemy bullets;
    - boss beams and burning wreckage;
    - laser gates.
12. **Atmosphere.** Each theme has an additive overlay:
    - sea, hive, crystal and bone levels get dithered light shafts slanting down from above;
    - lava levels get heat glowing up from below;
    - metal and biomech levels get two sweeping searchlights.
13. **Near-foreground silhouettes.** Dark shapes at 1.45× scroll rush past the screen edges, above everything except
    the HUD.
14. **Muzzle flashes and exhaust trails** from the ship. Destroyed boss parts keep burning and smoking.
15. **Screen effects.** Full-screen flashes, a red damage vignette, crush-warning hazard stripes, and the riveted HUD
    panel with a segmented shield gauge and rolling cash counter.

Scene changes use an ordered-dither dissolve. The title screen has copper bars, a 3D starfield, a mirrored logo
reflection and a banking ship. The shop is lit by a swinging lamp with dust motes, over a wood-grain counter.

A dark dithered vignette frames the play area at all times. Each boss arrives with a cinematic intro: letterbox bars,
scrolling hazard stripes, a flashing WARNING, and the guardian's name typing out.

The walls are shaded from a height map. A chamfer distance transform gives every wall a rounded bevel (machined on
metal themes), with noise lumps and the theme texture embossed into it. That map is lit by a light from the upper
left, plus specular highlights and ambient occlusion in deep interiors.

The finished low-res frame goes to a WebGL presenter (`engine/post.ts`), which:

- scales it to the window with sharp-bilinear filtering, so pixels stay crisp at any scale without shimmer;
- adds a two-level bloom that makes bullets, lights and explosions glow;
- bends the image around big explosions with shockwave refraction rings;
- adds chromatic aberration that spikes on damage;
- grades the colour and adds a vignette.

Without WebGL, the game falls back to a plain nearest-neighbour blit.

### Art resolution

Game logic runs in 320×256 logical pixels, but all art renders at twice that resolution (`RES` in `engine/gfx.ts`):

- **Hi-res canvases.** A hi-res canvas carries its logical size in `.width`/`.height` (the real bitmap is
  `._rw × ._rh`). `drawImage` is patched so these canvases draw at their logical size, which means game code never
  needs to know the art resolution.
- **Sprites.** The sprite builder (`SB`) renders every primitive at `RES` with 16-step colour ramps and fine
  dithering. Ellipses get specular highlights and bounce light. Organic ramps get a bumpy, mottled surface, and metal
  ramps get a chrome sky/ground reflection. Outlines and rim lights are thinner, and the ship is redesigned with more
  panels, intakes and a framed canopy.
- **Terrain.** The 1× height maps are sampled bilinearly at 2× for smooth contours. A soft two-pixel rim light and a
  contact shadow run along the edges, plus micro-relief grain. Scenery scrolls smoothly at sub-pixel steps, and
  sprites snap to the 2× grid.
- **Backgrounds.** These are all smooth and anti-aliased: the copper-gradient sky, the defocused far silhouettes, the
  near props, the foreground silhouettes (blurred for depth of field) and 12-frame caustics. The wall shadow has a
  soft penumbra.
- **Effects.** Glows have smooth falloff and white-hot cores. Explosions use feathered heat gradients with lit
  billows, smoke is soft volumetric puffs, embers streak, and shockwave rings are anti-aliased. Ambient bubbles,
  spores and embers are proper sprites, and scene changes fade smoothly.
- **Text.** The 5×7 font is rasterised with smoothed diagonals, a continuous metallic gradient, a top lip and a soft
  shadow. The logo is bevelled chrome.

A level's scenery takes 1–3 s to build. It runs as a resumable generator (`Scroller.prepare`), a slice at a time, on
the title screen, the level intro card, the stats screen and the shop. When play starts it is usually already done.

All of these layers are pre-rendered and cached per level. Rendering a frame costs about 3.5 ms in Chrome.

## Architecture

```text
src/
  main.ts              boot, view sizing, 50 Hz loop
  engine/              gfx (sprite builder, ramps, noise), view (wide view geometry), post (WebGL presenter),
                       light, font, input, audio + sequencer, pool
  art/sprites.ts       ship, attachments, bullets, pickups, explosions, shape renderer
  audio/music.ts       sequenced track data
  game/
    Game.ts            state machine and all menu screens
    World.ts           in-level play: scroll, spawns, collisions, HUD
    Player.ts          ship, crush and dive, attachments
    weapons.ts         every weapon, using a shared bullet pool
    enemies.ts         enemy archetypes and movement scripts
    bosses.ts          boss framework, boss designs, procedural armour and glow detail
    director.ts        threat director: power rating, adaptive difficulty, elites
    Scroller.ts        tilemap rendering, collision mask, parallax
    Shop.ts            Gorbo's Trade Hut
    items.ts           catalogue, prices, player state
    particles.ts       explosions, debris, text
    save.ts            options and high scores (localStorage)
  levels/              builder DSL, level1..level5 (hand-made), generator.ts (seeded levels), index.ts (mode/seed routing)
```

Weapons live in one module instead of one class per weapon, because they share a single pooled bullet type and only
differ in their spawn patterns.
