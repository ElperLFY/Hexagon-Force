# Settings data and interface

- `settings.json` is the source of truth for setting IDs, defaults, ranges, labels and descriptions.
- `settings.html` is the semantic dialog structure.
- `settings.css` owns all presentation and responsive layout.
- `js/SettingsPanel.js` loads the files, renders controls from JSON and connects them to the game.

V-Sync is shown as browser-managed because a web page cannot reliably switch the display compositor's hardware V-Sync on or off. The Framerate setting caps drawing frequency; the actual rate cannot exceed the display/browser refresh rate.

Sound Volume is intentionally disabled/WIP because the game currently has music playback but no separate sound-effects bus.
