# HEXBEAT — Pattern Generator

This document describes the current chart format and how to extend the generator safely.
Pattern names and definitions below follow the text of JiminP's Steam guide,
**[Super Hexagon 101: Know your Patterns](https://steamcommunity.com/sharedfiles/filedetails/?id=121153531)**.
The guide itself warns that its list may omit patterns or contain inaccuracies.
The guide's embedded diagrams are not available from the page's readable HTML export.
Do not infer exact visual thickness or silhouettes from the text descriptions alone.

## 1. Vocabulary

The guide uses these terms:

- **Pointer**: the player-controlled arrow.
- **Part**: a polygon wall section with one or more holes.
- **Pattern**: a recognizable collection of Parts, or a Whirlpool.
- **C-shaped Part**: a Part with only one side open.
- **Unit**: one step from a side to an adjacent side.
- **R / L**: one unit clockwise / counter-clockwise.
- **M**: either direction.
- **2R**: two clockwise units; **RR** means two successive one-unit clockwise movements.

HEXBEAT currently models a six-sided arena. One unit is therefore:

`SIDE = 2π / 6 = π / 3 = 60°`

The sector index is wrapped modulo six. Sector 5 and sector 0 are neighbours.

## 2. Current chart data model

A chart row is stored internally as:

`{ t, g, w, th?, routeDepth?, motifId?, motifName?, motifStart?, motifEnd? }`

- `t`: inner-face arrival time in seconds on the song timeline.
- `g`: array of open sector indices (0–5).
- `w`: six booleans; `true` means a wall occupies that sector.
- `th` (optional): radial depth of this Part, in arena units. If absent, the renderer and collision system both use the global `TH` (`0.09`). Ordinary authored Part spans are multiplied by `PART_DEPTH_SCALE` (`0.9`); the long Ladder rail is exempt so it still spans the full phrase.

Legacy chart rows retain the compact array form:

`[time, openSector1, openSector2, ...]`

Extended geometry rows use an object:

`{ "t": time, "g": [openSector, ...], "th": radialDepth, "rd": routeDepth, "mid": motifId, "mn": motifName, "ms": motifStart, "me": motifEnd }`

The wall mask is reconstructed from the open sectors. The row time for a pattern event is:

`t = barTime + beatOffset × beatDur`

Pattern factories return events in the form:

`[beatOffset, [openSector, ...], spanBeats?, routeSpanBeats?]`

The optional third value specifies how far the Part extends radially, measured in beats. The generator converts it to arena depth using the level wall speed and beat duration. Events without it use the legacy global `TH`. The optional fourth value specifies route-planning depth separately from visual/collision depth; this is used for persistent Ladder rails whose corridor remains open while short rungs move. A route span of zero preserves that rail's full authored radial length when the general Part-depth reduction is applied.

### Cyclic-sector arithmetic

Sector positions live in the cyclic group `Z₆`. All sector arithmetic is modulo 6:

`sector(next) = (sector(current) + signedUnits) mod 6`

This creates useful ambiguities that the pattern format must handle explicitly:

- `+3 ≡ -3 (mod 6)`: in a six-sector arena, a 3-unit clockwise destination is the same sector as a 3-unit counter-clockwise destination.
- `4L ≡ 2R (mod 6)` and `4R ≡ 2L (mod 6)`.
- The current chart rows record only *which sectors are open*. They do not record the intended turn direction or number of taps. A visual pattern that depends on distinguishing `3R` from `3L` needs additional path/orientation metadata; the existing gap-only JSON cannot preserve that distinction.

Example extended events:

```js
[
  [0,   [1, 2, 3, 4, 5], 4],  // long Part: four beats of radial depth
  [0.5, [0, 3, 4, 5],    0.22] // short Part: two-sector wall rung
]
```

The full six-sector Ladder construction is defined in `js/SubData/PatternGenerator/ladder.json` and loaded by `js/PatternGenerator.js`.

## 3. Geometry and thickness

The arena uses six sectors, each spanning `SIDE` radians. A wall sector is rendered as a quadrilateral between two radii:

- inner hexagon apothem offset: `m`
- outer hexagon apothem offset: `m + (row.th ?? TH)`

`TH` remains the global fallback wall thickness, defined in `js/config.js`. Pattern Parts can override it with `th`, a radial depth calculated from their authored span in beats.

The renderer and collision geometry read the same effective depth (`row.th ?? TH`). Legacy JSON arrays therefore retain their old appearance and collision behavior, while extended rows can produce long rails, rungs, and thicker Part silhouettes.

The span values are design parameters, not measurements stated by the Steam guide. They are initial visual tuning values and still need in-game inspection against the supplied screenshots.

## 4. Pattern definitions in the reference guide

These are textual descriptions from the guide, not image-verified reconstructions:

| Name | Guide description |
|---|---|
| Solo | One, two or three holes; may be striped |
| Triple C | Three C-shaped Parts; adjacent holes are 3 units apart in hexagon mode. HEXBEAT spaces the three-sector transitions 2.5 beats apart for the slowest stage turn rate |
| Whirlpool | One spiral sequence, clockwise or counter-clockwise |
| Bat | Two-way pattern; guide recommends three separate presses (MMM) |
| Ladder | Zig-zag |
| Stair 1 | Several Parts with holes 3 units apart; each Part's holes move 1 unit apart |
| 321 | M-shaped path with movements of 3, then 2, then 1 unit |
| Multi C | Repeated movement in one direction |
| Double Whirlpool | Whirlpool on both sides; the guide describes the pair as rotating CW or CCW |
| 2-Spin | User-provided reference: repeat the shared 1-2-3 motif twice |
| 3-Spin | User-provided reference: repeat the shared 1-2-3 motif three times |
| 4-Spin | User-provided reference: repeat the shared 1-2-3 motif four times |
| Rain | Several three-hole Parts followed by a cap; the cap can be dangerous |
| Stair 2 | RRLLL sequence |

The guide also describes mode changers between hexagon, pentagon and square topology. HEXBEAT currently has a fixed six-sector arena; these mode changers are not represented by the current six-sector row schema.

## 5. How to add or edit a pattern

Pattern geometry belongs in `js/SubData/PatternGenerator/`, not in a JavaScript factory.

1. Create or edit one named JSON file. Copy the structure of a nearby pattern and keep `"$schema": "./pattern.schema.json"` at the top.
2. Set `id`, `name`, `category`, `description`, and `tags`. Set `weight` (normal selection) and `voidWeight` (Endless Void selection) in this same file.
3. Add one object per Part in `parts`. Use `beat` for the arrival offset, `openOffsets` for sectors relative to the motif's starting sector, `directionMode` for clockwise/counter-clockwise behavior, and optional `wallSpanBeats` / `routeSpanBeats` for geometry and route planning.
4. If the definition reuses another pattern, use `aliasOf`; repeated Spin variants use `repeatCount` plus the base Spin `repeatTemplate`.
5. Register the pattern ID and filename in `catalog.json` under `patterns` and `definitionFiles`. Add it to `poolBands` or `hardAdditions` to make it selectable in normal stages; add it to `voidPool` if it should appear in Endless Void. Edit `transitions` only when it is safe to use during a protected exit sequence.
6. Add deterministic checks in `smoke-test.mjs` and reachability coverage in `pattern-reachability-test.mjs`.

Sector offsets are wrapped modulo six at runtime. Keep the Parts in beat order. Do not alter the loader/compiler in `js/PatternGenerator.js` for ordinary pattern edits; it should remain the small runtime bridge from JSON to chart rows.

## 6. Timing and reachability

A beat lasts `beatDur` seconds. A pattern event at offset `b` occurs after `b × beatDur` seconds from the pattern's start.

For two consecutive Parts separated by `Δt`, available movement time is reduced by wall traversal and the reaction margin. Authored multi-Part motifs are treated atomically: if the entry lane needs to change, the repair pass rotates the entire motif in six-sector space rather than adding or deleting openings in individual Parts. That preserves the authored silhouette of Ladder, Spin and other compound patterns. Legacy ungrouped chart rows retain bridge-opening repair. The concrete reachable lane is also carried across generated Void chunk boundaries.

The enclosed `smoke-test.mjs` checks structural invariants (including both continuous Ladder rails, every mirrored rung and full rail depth), motif grouping/serialization, the four-motif post-Ladder corridor (including Stair 1 followed by the next protected Part), the two-motif post-Bat exit, the paired Solo shape, reduced Part depth, hard-stage quiet-audio cadence, Void chunk timing and hub collision clipping. It also time-simulates Ladder → four protected motifs → the first normal Solo as one overlapping collision sequence. `pattern-reachability-test.mjs` runs a time-expanded collision simulation: it combines overlapping wall Parts, applies each stage's actual turn rate and wall speed, and reserves angular clearance for the Pointer body. It audits every pattern factory in all four stages and both directions, then checks deterministic multi-pattern Void sequences across three consecutive generated chunks per seed.

Blu/RGB always re-analyze their audio instead of loading the legacy JSON charts, because those files contain skipped low-intensity bars (up to several beats long). Their hard-stage generator continues through quiet audio and schedules the next motif after the previous Part's actual wall thickness plus a short clearance interval; single-Part motifs no longer receive an arbitrary full-beat pause.

Void uses a dedicated pool and alternates multi-lane Parts with other pattern families, rather than inheriting the stage's ordinary pool. It starts with a multi-opening Part, chooses each new motif orientation to retain an opening from the previous motif, and carries the concrete reachable lane across rows and chunk boundaries. Chunks begin at the previous generated motif's exact next time, not at a rounded four-beat boundary.

Radial geometry is clipped consistently in both renderer and collision at the hub radius. A negative inner radius would make the polar-coordinate polygon reflect through the origin by 180°, creating walls that appear to emerge from the hub and phantom collisions that can hold the Pointer still after the wall is no longer visibly present.

This catches a critical class of bug that row-by-row tests miss: individually reachable openings can still overlap into a fully closed ring. The test is conservative and does not prove visual fidelity or fun; still playtest:
- the first Part from the player's actual angle;
- every transition between consecutive Parts;
- the seam between generated Void chunks;
- both clockwise and counter-clockwise variants;
- high-speed settings from Settings → Gameplay (Mod Menu).

For visual diagnosis, append `?debugPatterns=1` to the game URL. The gameplay HUD then shows the currently active generated motif name and elapsed time within that motif. This is especially useful because screenshots without the label cannot distinguish a Ladder-like silhouette from Stair, Whirlpool or another family.

## 7. Reference images and current reconstruction scope

Four screenshots have now been supplied by the user:

1. A shared Spin Part silhouette, used for 2-, 3-, and 4-Spin by repeating the motif the named number of times.
2. The 3-2-1 M-shaped sequence (3, then 2, then 1 unit).
3. Double Whirlpool, with two simultaneous spiral lanes.
4. A 3-Spin reference illustrating the 1-2-3 movement progression.

The Steam guide text also calls Ladder a zig-zag, Whirlpool a one-way spiral, Double Whirlpool two spirals (one on each side), and 3-2-1 an M-shaped route. However, the guide's image placeholders do not expose the full original diagrams as directly retrievable image assets in this workflow. The current Ladder is represented as one composite row for its two persistent opposing rails, followed by eight mirrored rung events. The rail row leaves the four non-rail sectors open. Each rung row also explicitly leaves the two persistent rail sectors open, plus one opposite pair; the intersection of the long rail mask and the active rung mask therefore retains exactly two opposite playable openings. The rung pairs alternate at a regular 0.75-beat interval and each has the same 0.22-beat span. Keeping both rails in one row is important: when they were separate rows with the same timestamp, the route-repair pass treated them as sequential transitions and could shift only one side. The persistent rail row uses a zero `routeDepth` for route planning (it does not shorten the corridor-change window), while its visual/collision depth still spans the whole motif. The entire Ladder also carries one motif identity, so section-based randomization applies one mirror/rotation to the complete multi-beat phrase rather than reflecting its second half independently.

Immediately after a Ladder, the generator stays in a four-motif safety corridor. The first three exit motifs may be `solo3`, `alt3` or `stair1`; the fourth is restricted to `solo3` or `alt3`. Stair 1 can therefore occur inside the corridor, but can never be followed directly by a C/Spin or another single-opening family. Only after the final three-opening Part does the normal pool resume. Bat uses a shorter two-motif wide-opening exit (`solo3` and `alt3`). Void applies both rules and carries them across generated chunks.

The project's `Solo` reconstruction follows the supplied screenshot as two same-lane single-hole Parts, one beat apart. The Steam guide describes Solo more generally as single bodies with one, two or three holes, and warns about a Solo followed by a three-unit turn; it does not specify a universal two-Part count. The fixed pair here is therefore the project's screenshot-based interpretation, not a claim about every original Solo variant.

Triple C uses 2.5-beat spacing for its 3-sector transitions. Whirlpool, Double Whirlpool and Multi C use 1.25-beat spacing between one-sector changes. Ordinary Part wall spans are 10% thinner in both standard generation and Void; the persistent Ladder rails retain their full phrase-spanning depth. These intervals are calculated against the slower stage turn-rate constraints, rather than relying on a generic beat spacing.

This is a reconstruction based on the user's marked screenshot, not a pixel-perfect copy of an unavailable original guide diagram.

The user screenshots define the intended Spin repetition and the movement silhouettes above; do not replace those with the differing abbreviated wording in the guide without asking.

## 8. Human-editable pattern and settings data

The source of truth for generated pattern shapes is now `js/SubData/PatternGenerator/`:

- `catalog.json` defines pattern IDs, pool bands, hard-stage additions, Void pool and safe transition presets. Each pattern JSON stores its own normal and Void selection weights.
- Each pattern has its own JSON file. A Part records its beat offset, open sectors (relative to the motif start), optional wall span and optional route-planning span.
- `pattern-catalog.schema.json` documents the catalog; `pattern.schema.json` documents each pattern definition. The folder README explains the Part fields and aliases.
- `js/PatternGenerator.js` is the runtime loader/compiler. It turns JSON definitions into the factory interface used by the existing chart and Void code; adding or editing a pattern's shape no longer requires editing a JavaScript factory.

The general Settings source is `js/SubData/Settings/`:

- `settings.json` defines categories, labels, defaults, limits, descriptions and feature dependencies.
- `settings.html` is the semantic dialog markup.
- `settings.css` contains the visual style and responsive layout.
- `settings.schema.json` describes the JSON format.
- `js/SettingsPanel.js` loads those assets and connects the controls to the game. It is intentionally the controller, not the location where settings are defined or styled.

The Mod Menu is now a section inside Settings (shortcut `M` or `S`); there is no separate slide-down Mod Menu. Framerate is a render-rate cap, while V-Sync is shown as browser-managed because a web page cannot reliably toggle hardware V-Sync. Sound Volume remains disabled/WIP because the new OGG cues currently share the main volume control; independent adjustment is still planned.

`js/config.js` remains the source for existing level/game constants and is not part of the editable pattern or Settings data model.

## 9. Reference

JiminP, **Super Hexagon 101: Know your Patterns**, Steam Community Guide (2013):
https://steamcommunity.com/sharedfiles/filedetails/?id=121153531
