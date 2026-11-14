export const TAU=Math.PI*2,SIDE=TAU/6,K=1.1547,RP=.27,HUB=.18,TH=.09,PW=.035,PART_DEPTH_SCALE=.9;
export const PL={tip:RP+.045,back:RP-.03,half:.035};
export const SONG_DIR='MusicData/';
export const MUSIC_CUE_DIR='SongData/Music/';
export const SOUND_CUE_DIR='SongData/Sounds/';
export const MUSIC_CUES=['awesome','excellent','wonderful'];
export const SOUND_CUES=['start','die','begin','gameover','menuchoose','menuselect','rankup'];

// Endless "void" phase.
export const VOID={
  start:60,          // seconds into the run --10s best for testing (personally)
  flip:.9,           // seconds for the inversion to sweep out from the centre
  fade:2,            // pause after the flip before the darkness starts to grow
  ramp:150,          // seconds for the darkness to reach full strength
  front:.45,         // final distance of the gradient's start from the centre (arena units, hub is ~.24)
  width:.6,          // softness of the gradient (arena units)
  alpha:[.3,.92],    // darkness at the far end: [at the start, at full strength] -> never fully black
  chunkBars:16,       // rows are generated this many bars at a time...
  ahead:8,          // ...and always at least this many seconds in advance
  noise:{file:'wn01.wav',gain:.38,fade:1.5} // looped from the flip until you die (gain is relative to the volume slider)
};

// Music visualizer. The live audio is analysed every frame (frequency bands, like a spectrum analyser) and the
// centre hub and the camera follow it. Everything here is cosmetic: collisions never change.
export const VIS={
  enabled:true,
  // --- analysis ---
  fft:2048,                 // analyser size: more = finer bass resolution, slightly more lag
  smoothing:.2,             // analyser's own smoothing (0 = raw, 1 = frozen)
  bands:{                   // Hz ranges. 'all' is a weighted mix of the three
    bass:[30,160],
    mid:[160,2000],
    high:[2000,9000]
  },
  mix:{bass:.6,mid:.3,high:.1}, // weights of the 'all' band
  punch:.60,                // 0 = follows the sustained loudness, 1 = only the hits (kicks) above the recent average
  baseline:.5,              // seconds of "recent average" that hits are measured against (punch > 0)
  agc:6,                    // seconds the loudness reference takes to relax: quiet parts still pulse, 0 = off
  minPeak:.1,               // loudness reference never drops below this (stops silence from being amplified)
  floor:.12,                // 0..1  below this the visualizer stays still (kills constant jitter)
  gamma:1.2,                // >1 = only the strong hits pulse, <1 = reacts to everything
  gain:10,                   // overall sensitivity
  attack:.03,               // seconds to rise to a hit (smaller = snappier)
  release:.17,              // seconds to fall back (bigger = floaty)
  // --- what moves ---
  hub:{
    band:'bass',            // 'bass' | 'mid' | 'high' | 'all'
    rest:.88,               // hub size when the music is quiet (1 = the original size)
    amount:.26,             // extra size at a full-strength hit. Keep rest+amount <= ~1.15 or it touches the arrow
    flash:.2,               // 0..1 how much the hub fill lights up with the wall colour on a hit
    line:.3                 // how much the hub outline gets thicker on a hit
  },
  cam:{
    band:'bass',            // 'bass' | 'mid' | 'high' | 'all'
    amount:.02              // zoom at a full-strength hit (.02 = 2%, gameplay stays readable; 0 = off)
  },
  beatZoom:1                // the old fixed per-beat zoom (1 = unchanged, 0 = off). Lower it if both together feel like too much
};

