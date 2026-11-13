// Costanti di gioco, livelli e palette. I parametri di rotazione sono separati
// dalla velocita' dei muri: ogni livello puo' avere un ritmo visivo distinto.
export const TAU=Math.PI*2,SIDE=TAU/6,K=1.1547,RP=.19,HUB=.12,TH=.1,PW=.035;
export const PL={tip:RP+.045,back:RP-.03,half:.035};
export const SONG_DIR='MusicData/';

// Endless "void" phase. At START seconds into a run the authored chart is replaced by generated rows
// (forever), the whole screen inverts and a black gradient slowly creeps in from one side.
export const VOID={
  start:60,          // seconds into the run
  flip:.9,           // seconds for the inversion to sweep out from the centre
  fade:1,            // pause after the flip before the darkness starts to grow
  ramp:60,          // seconds for the darkness to reach full strength
  front:.45,         // final distance of the gradient's start from the centre (arena units, hub is ~.24)
  width:.3,          // softness of the gradient (arena units)
  alpha:[.3,.92],    // darkness at the far end: [at the start, at full strength] -> never fully black
  chunkBars:10,       // rows are generated this many bars at a time...
  ahead:3,          // ...and always at least this many seconds in advance
  noise:{file:'wn01.wav',gain:1,fade:1.5} // looped from the flip until you die (gain is relative to the volume slider)
};
const hsl=(h,s,l)=>`hsl(${h},${s}%,${l}%)`;

export const LEVELS=[
  {
    id:105,name:'VERDE · GIALLO · ROSSO',offset:0,speed:1,seed:105,turnRate:10,
    rotSpeed:1.5,rotAmp:-.2,rotBeats:16,
    randomSectionBeats:16,randomLaneShiftChance:.05,randomDropChance:.025,randomAddChance:.08,
    pal(tt){
      let p=(tt/30)%2;
      p=p>1?2-p:p;
      const h=Math.round(120*(1-p));
      return{b1:hsl(h,62,64),b2:hsl(h,62,57),w:hsl(h,70,22),p:hsl(h,40,96)};
    }
  },
  {
    id:100,name:'CREMISI · NERO',offset:39,speed:1.2,seed:100,inv:true,turnRate:8,
    rotSpeed:1.8,rotAmp:.2,rotBeats:16,
    patternWeights:{
  ladder:2,
  whirl:1.5,
  solo:.5
},
    randomSectionBeats:12,randomLaneShiftChance:.08,randomDropChance:.04,randomAddChance:.08,
    pal(tt,inv){
      return inv
        ?{b1:'#0b0308',b2:'#170610',w:'#7d0e24',p:'#f4bcc4'}
        :{b1:'#6f0c1f',b2:'#5b0819',w:'#07020a',p:'#f4bcc4'};
    }
  },
  {
    id:110,name:'BLU',offset:0,speed:1.3,seed:110,hard:true,diff:.25,ramp:45,turnRate:10,
    rotSpeed:2,rotAmp:0,rotBeats:14,
    randomSectionBeats:10,randomLaneShiftChance:.16,randomDropChance:.10,randomAddChance:.07,
    intensityThreshold:.065,
    extra:['dwhirl','stair1','stair2','spin3','spin4','t321','rain','doubleC'],
    pal(){return{b1:hsl(215,70,64),b2:hsl(215,70,57),w:hsl(222,85,16),p:hsl(210,60,97)}}
  },
  {
    id:115,name:'RGB',offset:0,speed:1.4,seed:115,hard:true,diff:.35,ramp:45,turnRate:10,
    rotSpeed:2.5,rotAmp:0,rotBeats:16,trip:true,
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
