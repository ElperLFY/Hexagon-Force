// Costanti di gioco, livelli e palette. I parametri di rotazione sono separati
// dalla velocita' dei muri: ogni livello puo' avere un ritmo visivo distinto.
export const TAU=Math.PI*2,SIDE=TAU/6,K=1.1547,RP=.19,HUB=.12,TH=.1,PW=.035;
export const PL={tip:RP+.045,back:RP-.03,half:.035};
export const SONG_DIR='MusicData/';
const hsl=(h,s,l)=>`hsl(${h},${s}%,${l}%)`;

export const LEVELS=[
  {
    id:105,name:'VERDE · GIALLO · ROSSO',offset:0,speed:1,seed:105,
    rotSpeed:.38,rotAmp:.5,rotBeats:16,
    pal(tt){
      let p=(tt/30)%2;
      p=p>1?2-p:p;
      const h=Math.round(120*(1-p));
      return{b1:hsl(h,62,64),b2:hsl(h,62,57),w:hsl(h,70,22),p:hsl(h,40,96)};
    }
  },
  {
    id:100,name:'CREMISI · NERO',offset:39,speed:1.1,seed:100,inv:true,
    rotSpeed:.5,rotAmp:.6,rotBeats:16,
    pal(tt,inv){
      return inv
        ?{b1:'#0b0308',b2:'#170610',w:'#7d0e24',p:'#f4bcc4'}
        :{b1:'#6f0c1f',b2:'#5b0819',w:'#07020a',p:'#f4bcc4'};
    }
  },
  {
    id:110,name:'BLU',offset:0,speed:1.3,seed:110,hard:true,diff:.25,ramp:45,
    rotSpeed:.78,rotAmp:.72,rotBeats:14,
    intensityThreshold:.065,
    extra:['dwhirl','stair1','stair2','spin3','spin4','t321','rain','doubleC'],
    pal(){return{b1:hsl(215,70,64),b2:hsl(215,70,57),w:hsl(222,85,16),p:hsl(210,60,97)}}
  },
  {
    id:115,name:'RGB',offset:0,speed:1.4,seed:115,hard:true,diff:.35,ramp:45,
    rotSpeed:.98,rotAmp:.86,rotBeats:12,trip:true,
    intensityThreshold:.055,
    extra:['dwhirl','stair1','stair2','spin3','spin4','t321','rain','doubleC'],
    patternWeights:{ladder:1.35,burst:1.3,whirl:1.25,dwhirl:1.2,stair2:1.2,spin3:1.2,t321:1.15},
    pal(tt){
      const s=Math.min(tt,120),h=(10*tt+25*s*s/120+50*(tt-s))%360;
      return{b1:hsl(h,75,62),b2:hsl((h+30)%360,75,56),w:hsl(h,85,18),p:hsl(h,40,96)};
    }
  }
];
