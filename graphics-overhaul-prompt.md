# Prompt: HYPERBLAST graphics overhaul

Give HYPERBLAST a big visual upgrade while keeping its identity: 320×256 pixel art, chunky metallic and biomechanical
late-80s Amiga styling, procedurally generated art (no asset files), and a solid 50 Hz. Everything below must be
pre-rendered or cheap enough per frame. Never smooth or blur the pixels: keep the final image integer-scaled with
nearest-neighbour filtering.

## 1. Depth and shadow (biggest win)
- **Scenery drop shadow.** Pre-render a shadow canvas from the collision mask, offset about 6 px right and 8 px down,
  dithered at 50% darkness. Draw it over the background but under the foreground, so walls visibly float above the
  parallax layer.
- **Entity shadows.** The ship, enemies and bosses each cast a dark, offset silhouette onto the background layer.
  Generate it once per sprite and cache it. The offset grows a little with each object's "height". While diving, the
  ship's shadow merges into its sprite.
- **Three-layer parallax.** The far layer is an Amiga copper-style vertical gradient band with slow raster bars. The
  mid layer is the existing silhouettes at 0.45×. Add a new **near-background layer** at 0.7× with theme props (coral
  fans, fossil ribs, hanging vines, pipes with blinking lights, chrome girders), drawn behind the foreground.

## 2. Light
- **Additive glow pass.** Draw bullets, lasers, engine flames, explosions, beams, tokens, electro-balls, vulnerable
  boss cores and blinking lights a second time into the frame with `globalCompositeOperation = 'lighter'`, using
  cached, dithered, quantised radial glow sprites. The result should read as neon light in 16-colour steps, not as a
  soft modern blur.
- **Terrain lighting.** Add rim highlights where the wall edge faces up-left, ambient occlusion that darkens pixels
  near concave corners, and a specular glint pass on metal themes.
- **Animated light.** Level 1 gets water caustics moving over the background and the wall faces. Level 4 gets glowing
  vents with pulsing light. Level 5 gets blinking running lights along the panel seams.

## 3. Scenery detail
- Stamp decorations into the foreground at build time, chosen by theme and only where they make sense (on edges,
  facing the open channel):
  - coral polyps and sea fans
  - embedded skulls, vertebrae and ammonites
  - flowers, thorns and egg clusters
  - rivets, vents, warning stripes and cables
  - chrome rails with light strips
- Add a second, darker detail ramp so wall interiors have large-scale variation (strata, plates) as well as the
  existing small-scale texture.

## 4. Sprites
- **Strikeblaster.** Redesign the ship larger and with more detail: a cockpit canopy with a reflection, panel lines,
  twin engine nacelles, and 5 banking frames (hard left, left, centre, right, hard right) with lighting that follows
  the bank. Draw a glowing engine core plus a dithered exhaust trail.
- **Enemies.** Give every enemy a 1-pixel rim light on its lit side, plus a coloured inner shade, so they pop off dark
  backgrounds.
- **Bullets.** Enemy bullets pulse between 2 frames and have a glow halo. Player bolts leave 2–3 fading trail pixels.

## 5. Explosions and effects
- Explosions are layered: a white flash frame (additive), then the fireball, then expanding dithered smoke that
  lingers and drifts with the scroll, plus burning embers that leave short trails.
- Big kills add a shockwave ring and a brief full-screen palette flash. Boss deaths add escalating white-outs.
- Show a short white impact flash at the hit point, and a spark burst whose colour depends on the material (armour
  shows silver sparks, flesh shows red splats).
- When the player takes damage, add a red edge vignette pulse. While crushed, flash a hazard-striped warning on the
  screen edge.

## 6. Presentation
- **HUD.** Replace the flat strip with a bevelled metal panel with rivets, a segmented shield gauge with a gloss
  highlight, and a cash counter that rolls up rather than jumping.
- **Title.** Add copper raster bars behind the logo, a 3D (perspective) starfield, a mirrored and faded reflection of
  the logo, and a ship that banks as it sways.
- **Transitions.** Use a dithered dissolve or a fade through black between scenes.
- **Shop.** Light the Gorbo scene properly: a hanging lamp casting a light cone, wood grain on the counter, and dust
  motes in the beam.

## Constraints
- Do not change gameplay, hitboxes or balance.
- Keep the frame time per render under about 4 ms in Chrome. Pre-render anything static, and cache every derived
  sprite (glow, shadow, rim).
- `npm run build` must pass with zero type errors. Verify every level, the shop, the title and a boss fight in the
  browser.
