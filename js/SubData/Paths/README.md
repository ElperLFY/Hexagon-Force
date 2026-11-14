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

The current Path of Joy uses a 60-second clear goal. A level only unlocks the next one when the clear condition is reached; dying and retrying does not unlock anything.

## Add Path of Pain levels

Append level objects to `path-of-pain.json`. Its completion rule is already configured to require every Path of Joy stage to be cleared first. The path can be edited and populated independently from Path of Joy.
