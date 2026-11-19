# Prompt for Claude Code: Build a Xenon 2–Style Vertical Shoot 'em Up

Copy everything below the line into Claude Code.

---

## Goal

Build a complete, polished, browser-playable vertical-scrolling shoot 'em up that plays as closely as possible to **Xenon 2: Megablast** (The Bitmap Brothers, 1989, Amiga/Atari ST). Match its **game design, mechanics, pacing, structure, and overall feel** as faithfully as you can.

**Important IP rule:** Copy the *gameplay*, not the *assets*. Every sprite, background, sound effect, music track, character name, and logo must be original. Do not use ripped sprites, the Bomb the Bass "Megablast" track or any arrangement of it, the "Xenon" name, or the original shopkeeper's design. Call the game **"HYPERBLAST"** (or another original name), the ship the **"Strikeblaster"**, the currency **"Hard Cash"**, the shopkeeper **"Gorbo"** and his store **"Gorbo's Trade Hut"**. Aim for the *vibe* of late‑80s Bitmap Brothers art: chunky, metallic, heavily shaded, biomechanical — but drawn from scratch.

## Tech stack

- TypeScript + Vite, HTML5 Canvas 2D (no game engine needed; Phaser is acceptable if you prefer).
- Internal resolution **320×256** (Amiga PAL low-res), integer-scaled to fit the window with nearest-neighbour filtering (`image-rendering: pixelated`). Playfield ~ 256 px wide with a side/bottom HUD, or full-width with an overlaid HUD — pick whichever reads better.
- Fixed-timestep game loop at **50 Hz** (PAL), rendering at display refresh with interpolation.
- Limited palette feel: draw all art procedurally or as pixel art generated in code (or via small PNG sprite sheets you create), restricted to ~32 colours per level like the Amiga.
- Audio via Web Audio API: procedurally synthesised SFX and an original tracker‑style chiptune/breakbeat soundtrack (sample‑based drums + bass + stabs, ~120 BPM, late‑80s hip‑hop/acid‑house energy). A small in‑code sequencer is fine.
- No backend. High scores in `localStorage`.

## Core feel (most important)

1. **Slow, steady vertical scroll** (original was deliberately slow — roughly 0.5–1 px per frame at 50 Hz). The level is a long hand‑designed vertical map, not random.
2. **Reverse scrolling:** when the ship is pressed against the bottom of the screen and the player keeps holding *down*, the scroll **reverses** and the level scrolls backwards a limited distance (cap it, e.g. ~1.5 screens behind the furthest point reached). Releasing resumes forward scroll. This is a signature mechanic — use it for dodging and for re‑collecting cash.
3. **Scenery is solid.** Levels have walls, narrow corridors and outcrops. Touching scenery doesn't kill instantly but **pushes the ship** and **drains shield** if the ship is being squeezed/crushed between the scrolling wall and the screen edge.
4. **Heavy, satisfying weapons** that visibly bolt onto the ship sprite as you upgrade.
5. **Enemies are mutated organic lifeforms** (tadpoles, worms, jellyfish, crustaceans, eyeballs, spores) that fly in authored wave patterns, plus fixed wall‑mounted turrets/growths.

## Ship, shield, lives

- 8‑direction movement with inertia‑free arcade control; base speed is slowish and upgradable.
- **Shield/energy bar** (not one‑hit death). Enemy bullets and collisions drain it. When empty, the next hit destroys the ship.
- **3 lives.** On death, respawn at the most recent **restart checkpoint** (6 per level), with brief invulnerability (flashing).
- On death, the player keeps purchased weapons but loses a level of each/some temporary pickups (choose a fair rule and document it).
- Start of each life: short **temporary invincibility shield** visual around the ship.
- Optional: 2‑player alternating (hot‑seat) mode, each with their own score, lives and loadout.

## Level structure

- **5 levels**, each a long hand‑authored vertical map with its own palette, enemies and tileset. Themes progress through time, from primordial to futuristic (all original designs):
  1. **Primordial Sea** – Cambrian‑era: trilobite‑like crawlers, shell creatures, tadpoles, coral rock walls.
  2. **Fossil Caverns** – bony, ribbed tunnels, worm creatures, spore pods.
  3. **Overgrown Jungle Hive** – organic vines, insectoid swarms, pulsing egg sacs.
  4. **Biomechanical Fortress** – flesh fused with metal pipes, mechanical turrets.
  5. **Metallic Spaceways** – sleek chrome corridors, robotic drones, laser gates.
- **Level 1 has one boss** (at the end). **Levels 2–5 each have a mid‑level boss and an end boss.**
- Each end boss guards a **bomb**; killing the boss defuses it (show a short "BOMB DEFUSED" sequence).
- Bosses are **huge** (larger than the screen width is fine, scrolling into view), and must be **destroyed piece by piece**: separate destructible parts (claws, eyes, shell plates, gun pods) with visible damage states; some weak points only open after others are destroyed. Each boss needs a distinct attack pattern and strategy.
- **Power‑up capsules** float through levels; shooting one releases a **token** that drifts and can be collected.

## Currency and the shop

- Destroyed enemies drop **Hard Cash** bubbles; bigger enemies drop more/bigger bubbles. Cash bubbles drift and must be flown into.
- The shop appears **twice per level**: at the halfway point and at the end (after the boss). Level 1's halfway shop still appears even without a mid‑boss.
- **Shop screen:** a full‑screen trading interface with an animated, original alien shopkeeper behind a counter who makes sarcastic quips. Layout: grid of item icons with name, price, and description; player's current cash; current loadout.
  - **Buy** items (stack/upgrade where applicable).
  - **Sell** owned items back for **half** their buy price.
  - Optional "Advice" button where the shopkeeper gives a (sometimes useless) tip for a price.
  - Some items are greyed out/unavailable early and unlock in later shops.
- After the final boss, show a deliberately anticlimactic "ending": the shopkeeper congratulates you and tells you to go switch off your computer, then the high‑score table. (An affectionate nod to the original — write your own line.)

## Weapons and items (~24 shop items, plus in‑level tokens)

Implement roughly this set; balance prices so a full upgrade path takes multiple levels:

**Forward fire**
- Base Blaster (default) → **Power Up** tokens increase its level (more/thicker shots).
- **Laser** – piercing beam, upgradable length/width.
- **Cannon** – slow, very heavy shots that punch through small enemies.
- **Twin/Spread Shot** upgrades.

**Side & rear**
- **Side Shot** – fires left/right; upgradable.
- **Rear Shot** – fires backwards; upgradable.
- **Wing Cannons** / **Side Pods** that attach to the ship and fire diagonally.

**Special**
- **Homing Missiles** – seek nearest enemy.
- **Electro‑Ball** – orbiting/rolling energy ball that damages on contact.
- **Mines** – dropped behind the ship.
- **Flamethrower** – short‑range cone (show a pilot light that ignites when firing).
- **Drone** – an orbiting satellite that blocks bullets and shoots.
- **Twister/Spinner** – rotating multi‑direction shot.
- **Auto‑Fire** – hold to fire continuously at max rate.

**Utility**
- **Speed Up** (stackable, few levels).
- **Shield Restore** (partial and full).
- **Extra Life** (expensive).
- **Dive** – ship dips "into the background" (darken + shrink sprite, parallax shift) for a few seconds, becoming immune to enemies and scenery.
- **Zapper/Smart Bomb** – damages everything on screen.
- **Super Power** (rare in‑level token, the equivalent of the original's top pickup): grants **every weapon** for ~10 seconds.
- **Repair/Armour** – increases max shield.

Weapons should visibly attach to the ship sprite (side pods, rear guns, missile racks), so a fully upgraded ship looks absurdly over‑armed.

## HUD

- Score, high score, lives, Hard Cash, shield bar, current level/section.
- Brief level intro card ("LEVEL 3 — OVERGROWN HIVE") and "GET READY".
- Big chunky bitmap font made in‑code, metallic gradient style.

## Presentation & screens

- **Title screen** with animated chrome logo, attract‑mode demo loop, scrolling credits text, high‑score table, and the main music track.
- Options: difficulty (Easy/Normal/Hard), 1 or 2 players (alternating), music/SFX volume, controls remap, scanline/CRT filter toggle.
- Pause menu (P / Esc).
- Explosions: multi‑frame, chunky, with debris and screen shake on big kills. Bosses explode in a long chain reaction.
- Parallax: at least 2 layers (foreground scenery + slower background).

## Controls

- Keyboard: Arrows/WASD to move, Space/Z to fire (hold for auto‑fire once bought; otherwise tapping fires faster than holding, like the original), X for special/zapper if owned, Enter to confirm in menus.
- Gamepad support via Gamepad API.
- Optional touch controls for mobile (virtual stick + fire).

## Architecture

```
src/
  main.ts            // boot, loop, scaling
  engine/            // input, audio, renderer, sprite & font helpers, collision (AABB + per-part hitboxes), RNG
  game/
    Game.ts          // state machine: Title → LevelIntro → Playing → Shop → BossDefeated → GameOver/HighScore
    Player.ts
    Weapons/         // one class per weapon type, shared Bullet pool
    Enemies/         // enemy archetypes + movement-path scripts
    Bosses/          // one file per boss, built from destructible parts
    Pickups.ts       // cash bubbles, capsules, tokens
    Scroller.ts      // forward/reverse scroll, checkpoints, tilemap collision
    Shop.ts
  levels/
    level1.ts ... level5.ts   // tilemap data + timed/position-triggered enemy spawn tables
  art/               // procedural pixel-art generators or sprite sheets
  audio/             // synth SFX + sequenced music data
```

- Spawns are triggered by **scroll position** (so reverse scrolling works deterministically). Enemies already killed stay dead when you scroll back; cash bubbles persist briefly.
- Object pooling for bullets/particles. Must hold 50 FPS with hundreds of bullets.
- A `?level=N&debug=1` URL flag to jump to any level, show hitboxes, grant cash, and toggle invincibility for testing.

## Delivery plan (work in milestones, run and test each)

1. Loop, scaling, input, ship movement, base shot, scroll, one test enemy.
2. Tilemap scenery with collision/crush, reverse scroll, checkpoints, shield/lives/respawn.
3. Enemy wave system, cash drops, capsules/tokens, HUD.
4. Full weapon set with visible attachments.
5. Shop screen (buy/sell/half‑price resale/shopkeeper quips).
6. Level 1 complete with boss → playtest & tune.
7. Levels 2–5 with mid‑ and end‑bosses.
8. Title, attract mode, high scores, options, 2‑player alternating.
9. Audio: SFX + original music per level, shop theme, boss theme.
10. Polish pass: explosions, screen shake, palette per level, CRT filter, balance, difficulty settings.

After each milestone: run `npm run build`, fix all type errors, and verify in the browser. At the end, write a `README.md` with controls, item list with prices, and a short design note on how each original mechanic was reproduced.
