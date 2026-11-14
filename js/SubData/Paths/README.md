# Paths

The selectable routes and their levels are data-driven. The runtime does not need a new level-specific branch in `Game.js` for every stage.

## Files

- `catalog.json` lists the available paths and chooses the default path
- `path-of-joy.json` contains the current four stages
- `path-of-pain.json` is intentionally empty for now; it unlocks when all Path of Joy stages are cleared
- `path.schema.json` and `catalog.schema.json` document the data format

## Add a level

Append a level object to the relevant path JSON. Keep its `id` unique within the game and put the matching soundtrack at `MusicData/<id>.mp3`. The ID is also used for generated beat-chart exports.

Important fields:

- `number`: the visible stage number
- `goalSeconds`: how long the player must survive to clear it
- `wallThickness`: default wall depth for rows without a custom Part depth
- `chartMode`: `beat-sensitive` analyzes the soundtrack and generates patterns from its beat accents; `authored` loads `MusicData/<id>.json`
- `palette`: a named palette recipe used by the renderer and the Settings background
- `patternGapBeats`, `patternWeights`, `extra`: tuning values for pattern cadence and variety

The current Path of Joy uses a 60-second clear milestone. Reaching the goal saves that level as completed and unlocks the next level, but it does **not** stop the run: the player continues into the Endless Void / Hypermode. The results screen reports `STAGE COMPLETED` only when the player eventually dies. Dying before the 60-second goal leaves the level incomplete.

The stage selector shows one level at a time. Left / A and Right / D scroll through the levels; locked levels appear in gray as `LOCKED`. Passing the last Path of Joy level attempts to enter Path of Pain. It remains locked until all Path of Joy levels have reached their 60-second completion milestone.

Mods are forcibly disabled while Path of Pain is selected. The Settings controls remain visible as gray `LOCKED` rows, and both map and player speed are enforced at their default values.

## Add Path of Pain levels

Append level objects to `path-of-pain.json`. Its completion rule is already configured to require every Path of Joy stage to be cleared first. The path can be edited and populated independently from Path of Joy. Mods remain disabled there, regardless of saved Settings values.
