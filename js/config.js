// Costanti di gioco, livelli e palette. Modifica qui colori, canzoni e velocità.
export const TAU=Math.PI*2,SIDE=TAU/6,K=1.1547,RP=.19,HUB=.12,TH=.1,PW=.035;
export const SONG_DIR='MusicData/'; // le canzoni sono MusicData/<id>.mp3
const hsl=(h,s,l)=>`hsl(${h},${s}%,${l}%)`;
export const LEVELS=[
 {id:105,name:'VERDE · GIALLO · ROSSO',offset:0,speed:1,seed:105,
  pal(tt){let p=(tt/30)%2;p=p>1?2-p:p;const h=Math.round(120*(1-p));
   return{b1:hsl(h,62,64),b2:hsl(h,62,57),w:hsl(h,70,22),p:hsl(h,40,96)}}},
 {id:100,name:'CREMISI · NERO',offset:39,speed:1.1,seed:100,inv:true,
  pal(tt,inv){return inv?{b1:'#0b0308',b2:'#170610',w:'#7d0e24',p:'#f4bcc4'}:{b1:'#6f0c1f',b2:'#5b0819',w:'#07020a',p:'#f4bcc4'}}}
];
