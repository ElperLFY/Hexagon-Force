// Costanti di gioco, livelli e palette. I parametri di rotazione sono separati
// dalla velocita' dei muri: ogni livello puo' avere un ritmo visivo distinto.
export const TAU=Math.PI*2,SIDE=TAU/6,K=1.1547,RP=.22,HUB=.12,TH=.1,PW=.035;
export const PL={tip:RP+.045,back:RP-.03,half:.035};
export const SONG_DIR='MusicData/';

// Endless "void" phase. At START seconds into a run the authored chart is replaced by generated rows
// (forever), the whole screen inverts and a black gradient slowly creeps in from one side.
export const VOID={
  start:60,          // seconds into the run
  flip:.9,           // seconds for the inversion to sweep out from the centre
  fade:2,            // pause after the flip before the darkness starts to grow
  ramp:150,          // seconds for the darkness to reach full strength
  front:.45,         // final distance of the gradient's start from the centre (arena units, hub is ~.24)
  width:.6,          // softness of the gradient (arena units)
  alpha:[.3,.92],    // darkness at the far end: [at the start, at full strength] -> never fully black
  chunkBars:8,       // rows are generated this many bars at a time...
  ahead:14,          // ...and always at least this many seconds in advance
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
  punch:.85,                // 0 = follows the sustained loudness, 1 = only the hits (kicks) above the recent average
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
    flash:.3,               // 0..1 how much the hub fill lights up with the wall colour on a hit
    line:.3                 // how much the hub outline gets thicker on a hit
  },
  cam:{
    band:'bass',            // 'bass' | 'mid' | 'high' | 'all'
    amount:.02              // zoom at a full-strength hit (.02 = 2%, gameplay stays readable; 0 = off)
  },
  beatZoom:1                // the old fixed per-beat zoom (1 = unchanged, 0 = off). Lower it if both together feel like too much
};

const hsl=(h,s,l)=>`hsl(${h},${s}%,${l}%)`;

export const LEVELS=[
  {
    id:105,name:'VERDE · GIALLO · ROSSO',offset:0,speed:1,seed:105,
    rotSpeed:1,rotAmp:.5,rotBeats:16,
    randomSectionBeats:16,randomLaneShiftChance:.05,randomDropChance:.025,randomAddChance:.08,
    extra:['dwhirl','spin4','t321','rain'],
    pal(tt){
      let p=(tt/30)%2;
      p=p>1?2-p:p;
      const h=Math.round(120*(1-p));
      return{b1:hsl(h,62,64),b2:hsl(h,62,57),w:hsl(h,70,22),p:hsl(h,40,96)};
    }
  },
  {
    id:100,name:'CREMISI · NERO',offset:39,speed:1.1,seed:100,inv:true,
    rotSpeed:1.2,rotAmp:.6,rotBeats:16,
    randomSectionBeats:12,randomLaneShiftChance:.08,randomDropChance:.04,randomAddChance:.08,
    pal(tt,inv){
      return inv
        ?{b1:'#0b0308',b2:'#170610',w:'#7d0e24',p:'#f4bcc4'}
        :{b1:'#6f0c1f',b2:'#5b0819',w:'#07020a',p:'#f4bcc4'};
    }
  },
  {
    id:110,name:'BLU',offset:0,speed:1.3,seed:110,hard:true,diff:.25,ramp:45,
    rotSpeed:1.5,rotAmp:.72,rotBeats:14,
    randomSectionBeats:10,randomLaneShiftChance:.16,randomDropChance:.10,randomAddChance:.07,
    intensityThreshold:.065,
    extra:['dwhirl','stair1','stair2','spin3','spin4','t321','rain','doubleC'],
    pal(){return{b1:hsl(215,70,64),b2:hsl(215,70,57),w:hsl(222,85,16),p:hsl(210,60,97)}}
  },
  {
    id:115,name:'RGB',offset:0,speed:1.4,seed:115,hard:true,diff:.35,ramp:45,
    rotSpeed:2,rotAmp:.86,rotBeats:12,trip:true,
    randomSectionBeats:8,randomLaneShiftChance:.22,randomDropChance:.14,randomAddChance:.05,
    intensityThreshold:.055,
    extra:['dwhirl','stair1','stair2','spin3','spin4','t321','rain','doubleC'],
    patternWeights:{ladder:1.35,burst:1.3,whirl:1.25,dwhirl:1.2,stair2:1.2,spin3:1.2,t321:1.15},
    pal(tt){
      const s=Math.min(tt,120),h=(10*tt+25*s*s/120+50*(tt-s))%360;
      return{b1:hsl(h,75,62),b2:hsl((h+30)%360,75,56),w:hsl(h,85,18),p:hsl(h,40,96)};
    }
  }
];
