# SongData / Music

These are one-shot voice announcements, not the level's background soundtrack.

| File | Trigger |
|---|---|
| `awesome.ogg` | First time this level reaches 30 seconds, saved across retries |
| `excellent.ogg` | First time this level reaches 60 seconds, saved across retries |
| `wonderful.ogg` | When the run establishes a new personal best |

The announcements are queued so spoken callouts do not overlap each other. The synchronized backing flourish is `SongData/Sounds/rankup.ogg`, mixed at 22% under the voice.

Use these exact lowercase filenames. OGG files are optional while developing; missing files are skipped without interrupting gameplay. The existing level soundtrack files and beat charts remain in `MusicData/`.
