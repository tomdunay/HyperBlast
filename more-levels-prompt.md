# Prompt: HYPERBLAST — 10 more levels and a seeded level/enemy randomiser

Extend HYPERBLAST (TypeScript + Vite, 320×256 canvas, 50 Hz fixed step) from 5 levels to **15**. Do it with a
**seeded procedural level generator** that builds levels 6–15 and can also remix any level on demand ("Randomiser
mode"). Read the existing code before you start. In particular, read `src/levels/builder.ts` (the `LB` DSL),
`src/levels/level1..5.ts`, `src/game/enemies.ts`, `src/game/bosses.ts`, `src/game/Scroller.ts`, `src/game/items.ts`
and `src/game/Game.ts`. Reuse the existing systems everywhere. Do not write a second engine.

## Goals
1. Ten new levels (6–15) that feel as hand-crafted as levels 1–5: readable pacing, fair corridors, and a rising
   difficulty curve.
2. A **deterministic, seeded generator**. The same seed must always produce the same level: terrain, spawns,
   capsules, checkpoints and bosses. This keeps reverse scrolling, checkpoint respawns and 2-player alternation
   deterministic.
3. A **Randomiser** option that, for a fresh seed, regenerates every level, including 1–5, and shuffles enemy rosters,
   palettes and bosses. Show the seed in the HUD and on the title screen so a run can be shared. Typing a seed in
   Options must reproduce the run.
4. No change to the core mechanics, hitboxes or the existing hand-made levels when Randomiser is off.

## Part A — the generator (`src/levels/generator.ts`)

Write `generateLevel(index: number, seed: number, opts: GenOpts): LevelDef`. Drive it with the existing `RNG` class
from `engine/gfx.ts`, seeded from `hash(seed, index)`. Never call `Math.random()` in generation code.

### A1. Structure
- Target length: **260–340 rows**, growing slightly with the level index.
- Lay the level out as a sequence of **sections**, each 10–24 rows, chosen from a weighted grammar:

  | Section | Description |
  |---|---|
  | `open` | Walls 1–2 tiles, gentle `wig`, used for big waves |
  | `taper` | Walls widen or narrow between widths over the section |
  | `corridor` | Open width 6–9 tiles, offset left/right; never narrower than **6 tiles (96 px)** |
  | `zigzag` | Corridor whose centre shifts every 4–6 rows; max shift 2 tiles per step |
  | `islands` | 1–3 `block()` obstacles, keeping a ≥5-tile gap on at least one side |
  | `pillars` | Paired blocks forming gates, with gaps ≥5 tiles |
  | `fork` | Central block splits the path into two lanes, each ≥5 tiles wide |
  | `gauntlet` | Medium corridor lined with wall turrets on both sides |
  | `breather` | Open section with a capsule and no enemies (after hard sections) |

- Mandatory skeleton, in order:
  1. Intro: `open`, with one easy wave.
  2. Body.
  3. Checkpoint.
  4. Body.
  5. Mid-boss arena via `LB.mid()`, then a checkpoint.
  6. Body.
  7. Checkpoint.
  8. Body.
  9. Checkpoint.
  10. Body.
  11. End-boss arena via `LB.end()`.

  This keeps exactly 6 checkpoints, and the halfway shop after the mid boss, exactly as in levels 2–5.
- Transitions: make the walls at the end of one section equal the walls at the start of the next, so the terrain is
  continuous. Use `seg(len, l0, r0, l1, r1, wig)` tapers between sections.

### A2. Fairness validator (required)
After generating the terrain, run a check on the tile grid: a **6-tile-wide flood fill / sweep from the start row to
the boss arena**. For every row there must be a horizontal run of open tiles of at least `MIN_GAP` (5 tiles), and
consecutive rows' open runs must overlap by at least 3 tiles. This means the ship can always get through at scroll
speed.

If a row fails, widen it locally (carve tiles) and re-check. Log a warning in debug mode. Add a unit-style self-test,
run with `?gentest=1`, that generates 200 seeds × 15 levels and reports any failures in the console.

### A3. Spawns
- Each section places 1–3 spawn groups using the existing `wave / one / wall / cap` calls. Spacing is driven by a
  **difficulty budget**:
  - `budget = base + index * k`.
  - Each enemy type has a threat cost, roughly `hp × fireRate × speed`; define a `THREAT` table next to `ENEMIES`.
  - Spend the budget per section, with a cooldown so there is a quiet stretch of 4–6 rows after every heavy group.
- Pick movement patterns from `PATTERNS`, with parameters constrained to the open area of that row. Use
  `LB.L / LB.R` to clamp the spawn `x` and the `sine` amplitude so enemies don't spawn inside walls.
- Wall enemies (`wall` kind) are placed only where the wall is ≥2 tiles thick at that row, and at most one per side
  every 6 rows.
- Capsules: 2–4 per level. The token is rolled from the existing weights, guaranteeing at least one `P` before the
  mid boss. `X` (Super Power) is allowed at most once per level.

### A4. Enemy roster per level
- Each level has a **theme** (see A5) and a roster of 5–8 enemy types: 3–5 themed types plus 1–3 "guest" types from
  other themes. Higher levels draw more guests and more elite types (`walker`, `cyclops`, `beetle`, `crab`).
- Add **enemy variants** without new code paths. Create a `variant(def, mods)` helper that clones an `EnemyDef` with:
  - an hp multiplier,
  - a fire-rate multiplier,
  - a bullet type swap,
  - a palette swap: re-render the frames with a different ramp via `renderShapes`, using a ramp-substitution map.

  Name them, for example: `tadpole_red` (faster, aimed shots), `jelly_void`, `drone_gold` (armoured, more cash).
  Generate about 2 variants per base type, deterministically from the seed.
- Optionally add 6 genuinely new enemy archetypes. Build them from the existing `Shape` primitives and `PATTERNS`, for
  example:
  - `ray`: a wide manta that glides sideways with a sine.
  - `mine_layer`: drops slow orbs.
  - `splitter`: splits into 2 small ones on death.
  - `orbiter`: circles the player.
  - `sniper`: wall turret with a long telegraphed shot.
  - `swarm_queen`: spawns wasps.

### A5. Themes and palettes for levels 6–15
Create 10 new themes (`Theme` objects). Reuse the 5 texture kinds (`coral | bone | vine | biomech | metal`), each with
a new palette and ambient settings, and add 2 new texture kinds to `Scroller.texture()`, `buildNear()` and `DECOR`:
- **`crystal`**: faceted cells using Voronoi-ish `noise2` thresholds, with glowing gems as decor lights.
- **`lava`**: cracked basalt with glowing orange fissures, ember ambience, and a heat-shimmer near layer.

Suggested sequence (all names original):

| Level | Name | Texture | Notes |
|---|---|---|---|
| 6 | Abyssal Trench | coral | dark palette |
| 7 | Crystal Grotto | crystal | |
| 8 | Ossified Wastes | bone | ash palette |
| 9 | Magma Veins | lava | |
| 10 | Fungal Labyrinth | vine | purple and teal |
| 11 | Hive Foundry | biomech | gold and flesh |
| 12 | Frozen Relay | metal | ice palette |
| 13 | Shattered Moon | crystal | grey and cyan |
| 14 | Core Furnace | lava | biomech decor |
| 15 | The Last Gate | metal | chrome and red alarm lighting |

Each theme also chooses its music track (reuse the existing tracks, with `root`/`bpm` transposed per level via a
small `transposeTrack(track, semis, bpmDelta)` helper in `audio/music.ts`).

### A6. Bosses
- The 9 existing bosses are reused for levels 6–15 (mid and end), with **boss modifiers** applied deterministically:
  - an hp multiplier: `1 + 0.12 × (index - 5)`;
  - gun intervals scaled down by up to 30%;
  - a palette swap of the body and part sprites (pass the ramp-substitution map through `buildBossArt`, and cache
    each variant by key);
  - **one extra gun added** per boss, from `aim3 | ring | spiral | spawn`.
- Add a "remix" mode: the generator may assemble a **new boss from parts**. Take a body from one `BossDef` and parts
  from another, reposition the parts onto anchor points on the body's `bodyHit` rectangle, and rebuild the `requires`
  chain so the core is always gated by 2–4 outer parts. Validate that every `requires` part is reachable by shots,
  using the same path check as `Boss.hitTest`: no vulnerable part directly behind an armoured one that can never
  open.
- Level 15's end boss must be the hardest. Use the Overmind Engine with all modifiers maxed, plus a second phase:
  once the core drops below 50% hp, respawn 2 gun parts.

## Part B — Randomiser mode
- Options gets a new row, **LEVELS: CLASSIC / RANDOMISER**, and **SEED: [8 hex digits]**, editable with up/down per
  digit and typing, plus **REROLL**. Persist both in `Settings`.
- Classic: levels 1–5 are the hand-made ones; levels 6–15 are generated from a fixed built-in seed, so everyone gets
  the same "official" levels 6–15.
- Randomiser: all 15 levels come from `generateLevel(i, settings.seed)`, including themes, rosters, bosses and
  capsule tokens.
- Store the seed in high-score entries and show it in the Hall of Fame, for example `ACE 0123456 L9 #3F2A91C0`.
- The attract demo picks a random seed each time, so it shows off variety.

## Part C — integrating 15 levels
- `LEVELS` / `LEVEL_NAMES` become functions of `(index, settings)`. `getLevel` caches by `(index, seed, mode)`, and
  `Scroller.cache` is already keyed by `LevelDef`.
- Game flow:
  - The final level becomes `LEVELS.length - 1` (replace the hard-coded `4` in `Game.onLevelDone` and the `?level=N`
    clamp).
  - The ending scene triggers after level 15.
  - Update Gorbo's ending line to mention 15 bombs.
  - Shops keep `shopIdx = level*2 (+1)`. Extend the item `unlock` values to stay sensible: everything is unlocked by
    shop 8.
- Balance:
  - Scale enemy hp and bullet speed gently with the level index: hp ×(1 + 0.04 × index), bullet speed
    ×(1 + 0.015 × index).
  - Raise cash drops so later shops stay meaningful.
  - Cap simultaneous enemy bullets at the existing 260.
- Level intro card: show the level number out of 15, the theme name, and (in Randomiser mode) the seed.
- HUD: `L12-3` already fits; make sure two-digit level numbers don't overlap the dive/zapper counters.

## Part D — debugging aids
- `?level=N&debug=1` works for N up to 15.
- `?seed=XXXXXXXX` forces Randomiser mode with that seed.
- New debug key **G** regenerates the current level with seed + 1 and restarts it at checkpoint 0.
- New debug key **V** toggles a minimap overlay: the whole level's tile grid scaled down, with spawn markers coloured
  by kind, checkpoint lines, boss arenas and the current scroll position.

## Acceptance criteria
- `npm run build` passes with zero type errors.
- `?gentest=1` reports **0 fairness failures** across 200 seeds × 15 levels and prints generation times; a level must
  generate in < 50 ms excluding art pre-rendering.
- The same seed produces byte-identical `rows` and `spawns`. Verify this by generating twice and comparing JSON.
- An automated pass (the existing `window.step` hook) can do the following for each of levels 1–15 in Classic mode
  and for 3 random seeds:
  - jump to each boss with debug `B`;
  - destroy it by aiming at `bossTarget()`;
  - reach the shop / ending.
- Levels 1–5 in Classic mode are unchanged. The original level files are not modified.
- Update `README.md` with the generator design, the section grammar, the difficulty budget, Randomiser usage and
  seeds.
