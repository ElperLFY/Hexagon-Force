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

`{ t, g, w, th? }`

- `t`: inner-face arrival time in seconds on the song timeline.
- `g`: array of open sector indices (0–5).
- `w`: six booleans; `true` means a wall occupies that sector.
- `th` (optional): radial depth of this Part, in arena units. If absent, the renderer and collision system both use the global `TH`.

Legacy chart rows retain the compact array form:

`[time, openSector1, openSector2, ...]`

Extended geometry rows use an object:

`{ "t": time, "g": [openSector, ...], "th": radialDepth }`

The wall mask is reconstructed from the open sectors. The row time for a pattern event is:

`t = barTime + beatOffset × beatDur`

Pattern factories return events in the form:

`[beatOffset, [openSector, ...], spanBeats?]`

The optional third value specifies how far the Part extends radially, measured in beats. The generator converts it to arena depth using the level wall speed and beat duration. Events without it use the legacy global `TH`.

### Cyclic-sector arithmetic

Sector positions live in the cyclic group `Z₆`. All sector arithmetic is modulo 6:

`sector(next) = (sector(current) + signedUnits) mod 6`

This creates useful ambiguities that the pattern format must handle explicitly:

- `+3 ≡ -3 (mod 6)`: in a six-sector arena, a 3-unit clockwise destination is the same sector as a 3-unit counter-clockwise destination.
- `4L ≡ 2R (mod 6)` and `4R ≡ 2L (mod 6)`.
- The current chart rows record only *which sectors are open*. They do not record the intended turn direction or number of taps. A visual pattern that depends on distinguishing `3R` from `3L` needs additional path/orientation metadata; the existing gap-only JSON cannot preserve that distinction.

Example:

```js
ladder: (start, direction) => {
  // Extended events can describe two long rails and short alternating rungs.
  // See PatternGenerator.PAT.ladder for the complete six-sector construction.
}
```

This is only a schema example, not a claim that it reproduces the guide's exact Ladder diagram.

## 3. Geometry and thickness

The arena uses six sectors, each spanning `SIDE` radians. A wall sector is rendered as a quadrilateral between two radii:

- inner hexagon apothem offset: `m`
- outer hexagon apothem offset: `m + TH`

`TH` remains the global fallback wall thickness, defined in `js/config.js`. Pattern Parts can override it with `th`, a radial depth calculated from their authored span in beats.

The renderer and collision geometry read the same effective depth (`row.th ?? TH`). Legacy JSON arrays therefore retain their old appearance and collision behavior, while extended rows can produce long rails, rungs, and thicker Part silhouettes.

The span values are design parameters, not measurements stated by the Steam guide. They are initial visual tuning values and still need in-game inspection against the supplied screenshots.

## 4. Pattern definitions in the reference guide

These are textual descriptions from the guide, not image-verified reconstructions:

| Name | Guide description |
|---|---|
| Solo | One, two or three holes; may be striped |
| Triple C | Three C-shaped Parts; adjacent holes are 3 units apart in hexagon mode |
| Whirlpool | One spiral sequence, clockwise or counter-clockwise |
| Bat | Two-way pattern; guide recommends three separate presses (MMM) |
| Ladder | Zig-zag |
| Stair 1 | Several Parts with holes 3 units apart; each Part's holes move 1 unit apart |
| 321 | M-shaped path with movements of 3, then 2, then 1 unit |
| Multi C | Repeated movement in one direction |
| Double Whirlpool | Whirlpool on both sides; the guide describes the pair as rotating CW or CCW |
| 2-Spin | Repeated 2L, 2R, 2L… |
| 3-Spin | Starts with a hole on the left, then 3R, 3L, 3R, 3L |
| 4-Spin | Starts with a hole on the right, then 4L, 4R |
| Rain | Several three-hole Parts followed by a cap; the cap can be dangerous |
| Stair 2 | RRLLL sequence |

The guide also describes mode changers between hexagon, pentagon and square topology. HEXBEAT currently has a fixed six-sector arena; these mode changers are not represented by the current six-sector row schema.

## 5. How to add a pattern

1. Choose a unique, lowercase key in `PatternGenerator.PAT`.
2. Write a factory that receives `start` (starting sector), `direction` (+1 clockwise or -1 counter-clockwise), and optionally the seeded random function `rng`.
3. Return one or more events. Each event must have a non-negative beat offset and a non-empty list of open sectors.
4. Keep sector indices relative to `start`; wrap values with modulo six when producing rows.
5. Add the new name to the appropriate difficulty pool in `pool(x)`. Do not add it only to `PAT`: an unreferenced factory is never selected.
6. Add deterministic tests for the sequence, timing, sector wrapping, and reachability.
7. If the pattern needs custom Part thickness, update the row schema, renderer and collision test together, and retain the global-`TH` fallback for old JSON.

Factory shape:

```js
newPattern: (start, direction) => [
  [0, [start]],
  [1, [start + direction]],
  [2, [start + 2 * direction]]
]
```

This describes three events one beat apart. It does not itself guarantee the intended movement path: validate the sequence against the reference geometry and the player turn rate.

## 6. Timing and reachability

A beat lasts `beatDur` seconds. A pattern event at offset `b` occurs after `b × beatDur` seconds from the pattern's start.

For two consecutive rows separated by `Δt`, available movement time is reduced by wall traversal and the reaction margin. The repair pass estimates the number of sector steps that can be made before the next row. If the closest current opening is too far away, it inserts a reachable bridge opening.

This is a gameplay safeguard, not a proof that every pattern is visually faithful or fun. Always test:
- the first Part from the player's initial position;
- every transition between consecutive Parts;
- the seam between generated Void chunks;
- both clockwise and counter-clockwise variants;
- high-speed settings from the Mod Menu.

## 7. Reference images and current reconstruction scope

Four screenshots have now been supplied by the user:

1. A shared Spin Part silhouette, used for 2-, 3-, and 4-Spin by repeating the motif the named number of times.
2. The 3-2-1 M-shaped sequence (3, then 2, then 1 unit).
3. Double Whirlpool, with two simultaneous spiral lanes.
4. A 3-Spin reference illustrating the 1-2-3 movement progression.

The Steam guide text also calls Ladder a zig-zag, Whirlpool a one-way spiral, Double Whirlpool two spirals (one on each side), and 3-2-1 an M-shaped route. However, the guide's image placeholders do not expose the full original diagrams as directly retrievable image assets in this workflow. The current Ladder rails/rungs and wall span values are therefore a geometric reconstruction, not a pixel-verified copy of a missing Ladder screenshot.

The user screenshots define the intended Spin repetition and the movement silhouettes above; do not replace those with the differing abbreviated wording in the guide without asking.

## 8. Reference

JiminP, **Super Hexagon 101: Know your Patterns**, Steam Community Guide (2013):
https://steamcommunity.com/sharedfiles/filedetails/?id=121153531
