# SongData / Sounds

These are short gameplay, interface and announcement effects.

| File | Trigger |
|---|---|
| `start.ogg` | At the beginning of an actual gameplay run |
| `begin.ogg` | At the same time as `start.ogg` (spoken “Begin”) |
| `die.ogg` | Immediately after a collision kills the player |
| `gameover.ogg` | Spoken “Game Over”, immediately after `die.ogg` finishes |
| `menuselect.ogg` | When changing the selected level with the left/right navigation |
| `menuchoose.ogg` | When confirming the current menu selection |
| `rankup.ogg` | Synchronized, quieter backing flourish under `awesome`, `excellent` and `wonderful` |

The three voice announcements are loaded from `SongData/Music/`. `rankup.ogg` starts at the exact same AudioContext time as each voice and is mixed at 22% gain, so the spoken words remain prominent.

Use these exact lowercase filenames. Missing OGG files are skipped and do not block gameplay.
