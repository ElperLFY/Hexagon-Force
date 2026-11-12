// Costanti di gioco, livelli e palette. Modifica qui colori, canzoni e velocità.
export const TAU=Math.PI*2,SIDE=TAU/6,K=1.1547,RP=.19,HUB=.12,TH=.1,PW=.035;
export const PL={tip:RP+.045,back:RP-.03,half:.035}; // triangolo del giocatore
export const SONG_DIR='MusicData/'; // le canzoni sono MusicData/<id>.mp3
const hsl=(h,s,l)=>`hsl(${h},${s}%,${l}%)`;
export const LEVELS=[
 {id:105,name:'GYR',offset:0,speed:1,seed:105,
  pal(tt){let p=(tt/30)%2;p=p>1?2-p:p;const h=Math.round(120*(1-p));
   return{b1:hsl(h,62,64),b2:hsl(h,62,57),w:hsl(h,70,22),p:hsl(h,40,96)}}},
 {id:100,name:'CRIMSON',offset:39,speed:1.1,seed:100,inv:true,
  pal(tt,inv){return inv?{b1:'#0b0308',b2:'#170610',w:'#7d0e24',p:'#f4bcc4'}:{b1:'#6f0c1f',b2:'#5b0819',w:'#07020a',p:'#f4bcc4'}}},
 {id:110,name:'BLU',offset:0,speed:1.3,seed:110,hard:true,diff:.25,ramp:45,
  pal(){return{b1:hsl(215,70,64),b2:hsl(215,70,57),w:hsl(222,85,16),p:hsl(210,60,97)}}},
 {id:115,name:'RGB',offset:39,speed:1.4,seed:115,hard:false,diff:.35,ramp:45,trip:true,extra:['dwhirl','spin3','t321'],
  pal(tt){const s=Math.min(tt,120),h=(10*tt+25*s*s/120+50*(tt-s))%360; // il colore gira piano e poi accelera
   return{b1:hsl(h,75,62),b2:hsl((h+30)%360,75,56),w:hsl(h,85,18),p:hsl(h,40,96)}}}
];
