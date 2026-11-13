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

`{ t, g, w }`

- `t`: wall arrival time in seconds on the song timeline.
- `g`: array of open sector indices (0–5).
- `w`: six booleans; `true` means a wall occupies that sector.

The JSON form is compact:

`[time, openSector1, openSector2, ...]`

The wall mask is reconstructed from the open sectors. The row time for a pattern event is:

`t = barTime + beatOffset × beatDur`

Every pattern factory returns an array of events:

`[[beatOffset, [openSector, ...]], ...]`

Example:

```js
ladder: (start, direction) => [
  [0, [start]],
  [1, [start + direction]],
  [2, [start]],
  [3, [start + direction]]
]
```

This is only a schema example, not a claim that it reproduces the guide's exact Ladder diagram.

## 3. Geometry and thickness

The arena uses six sectors, each spanning `SIDE` radians. A wall sector is rendered as a quadrilateral between two radii:

- inner hexagon apothem offset: `m`
- outer hexagon apothem offset: `m + TH`

`TH` is currently a **global wall thickness between parallel hexagon boundaries** in world units, defined in `js/config.js`. It is not a per-pattern property.

The current row schema stores only the time and open sectors. It cannot express different thickness per Part. To introduce pattern-specific thickness safely, the data model would need an optional field, for example:

`{ t, g, w, thickness }`

with a fallback to global `TH` for legacy JSON. The renderer and collision geometry must read the same effective thickness; changing only the drawing would desynchronise visuals and hit detection.

The Steam guide text describes silhouettes and movement, but does not specify numeric thicknesses. Exact per-pattern thickness therefore needs the guide diagrams or user-provided reference images.

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

## 7. Reference images still required

The Steam page text is accessible, but its embedded pattern diagrams are not present in the page content available to this workflow. The image placeholders appear as the word “Picture”; the separately exposed Steam image links resolve to decorative reaction icons, not pattern diagrams.

Before changing the exact pattern silhouettes or introducing per-pattern thickness values, attach the actual diagrams in this order:

1. `321`
2. `Ladder`
3. `Whirlpool`
4. `Double Whirlpool`
5. `2-Spin`
6. `3-Spin`
7. `4-Spin`

Name each attachment with the corresponding pattern name. For diagrams showing an entire sequence, include all Parts and their order.

## 8. Reference

JiminP, **Super Hexagon 101: Know your Patterns**, Steam Community Guide (2013):
https://steamcommunity.com/sharedfiles/filedetails/?id=121153531
