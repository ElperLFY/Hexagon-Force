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
