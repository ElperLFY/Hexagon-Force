# Pattern data

Each JSON file is one named pattern and declares `"$schema": "./pattern.schema.json"`. It owns its selection weights (`weight` for normal generation and `voidWeight` for Endless Void). The `parts` array is ordered by beat offset:

- `beat`: when the Part arrives, measured in beats from the motif start.
- `openOffsets`: open sectors relative to the starting sector `g`.
- `directionMode`: `relative` multiplies offsets by the movement direction; `fixed` keeps the listed arrangement; `by-direction` uses `openOffsetsByDirection`.
- `wallSpanBeats`: optional radial wall depth, measured in beats. If omitted, the game's normal Part thickness is used.
- `routeSpanBeats`: optional route-planning depth. Ladder's long rail uses `0` so it remains visually continuous without consuming the movement window.
- `aliasOf`: compatibility alias for another definition.
- `repeatTemplate`: describes the shared 1-2-3 Spin cycle used by Spin 2/3/4.

Use `pattern.schema.json` for editor autocomplete and validation of individual pattern definitions. Edit `catalog.json` to change the normal pools, hard-stage additions, Void pool and transition presets. Selection weights stay beside the pattern they belong to.

`js/PatternGenerator.js` is only the runtime loader/compiler. It converts this data into the existing factory interface; the pattern silhouettes, timings, pools and transition rules live in JSON.


## Selection and generation policy

`catalog.json` owns the runtime selection and scheduling policy:

- `selection.recentPatternHistory` avoids immediately reusing a named pattern.
- `selection.tagCooldowns` limits how recently a tagged movement family can occur.
- `selection.tagWeights` adjusts the relative probability of a family. A level's `patternWeights` still multiplies the pattern's `weight` or `voidWeight`.
- `selection.directionAlternation.tag` makes consecutive patterns with that tag use opposite relative directions.
- `generation` owns quiet thresholds, reaction margin, base gaps, and the Void iteration limit. The runtime increases a motif gap when wall thickness, Pointer radial size, active Map Speed, or reaction margin requires additional physical clearance.
- Transition entries specify their `triggerPatterns`, protected motif count, and allowed/final patterns. The selector does not keep a second hard-coded list of transition names.

Tags describe behavior rather than relying on names. For example, `c-shaped` identifies the repeated C construction, `unidirectional` identifies a motif whose relative movement follows one direction, and `alternating` identifies patterns that reverse their route. A pattern can carry multiple tags.

The six-sector chart stores openings, not a mandatory route direction. Opposite sectors are three steps apart in either direction (`+3 ≡ -3` modulo six), so a Triple-C Part alone cannot force the player to use Q rather than E. The generator can vary subsequent motifs and offer alternating-route patterns, but enforcing a unique route through an opposite-side transition would require explicit route metadata and corresponding collision geometry.
