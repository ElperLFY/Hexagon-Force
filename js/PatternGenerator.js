import {TAU,SIDE,TH,PW} from './config.js';
const mul=a=>()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
const cd=(a,b)=>{const m=((a-b)%6+6)%6;return Math.min(m,6-m)};
const sd=a=>Math.floor((((a%TAU)+TAU)%TAU)/SIDE);

// Il livello "scritto": file di muri sincronizzate sul tempo della canzone.
export class Chart{
 constructor(rows=[],beatDur=.5,tg0=0,bpm=0,dur=0,speed=1){Object.assign(this,{rows,beatDur,tg0,bpm,dur,speed})}
 rot(t){return .35*t+.8*Math.sin(t*TAU/(16*this.beatDur))}
 hit(t,a){const s1=sd(a-.07),s2=sd(a+.07);
  for(const r of this.rows){if(Math.abs(r.t-t)>.5)continue;const m=(r.t-t)*this.speed;
   if(m<PW&&m+TH>-PW&&(r.w[s1]||r.w[s2]))return true}return false}
}
Chart.EMPTY=new Chart();

// Sceglie i pattern in base all'intensità della musica. Ogni pattern = [[beat,[lati aperti]],...]
export class PatternGenerator{
 static PAT={
  wall:(g,d,r)=>[[0,[g]],[2,[g+(r()*3|0)-1]]],
  zig:(g,d)=>[0,1,2,3].map(i=>[i,[g+(i%2)*d]]),
  stair:(g,d)=>[0,1,2,3].map(i=>[i,[g+i*d]]),
  alt3:(g)=>[0,1,2,3].map(i=>[i,[g+i%2,g+i%2+2,g+i%2+4]]),
  pairs:(g,d)=>[0,1,2,3].map(i=>[i,[g+(i%2)*d,g+3+(i%2)*d]]),
  burst:(g,d)=>[[0,[g]],[.5,[g]],[1,[g]],[1.5,[g]],[3,[g+2*d]]]};
 constructor(L){this.L=L;this.rng=mul(L.seed)}
 generate(S,bd,tg0,dur){ // S(beat)=intensità 0..1 di quel punto della griglia
  const L=this.L,r=this.rng,rows=[],t0=L.offset;
  for(let bar=0;;bar++){const b0=bar*4,tb=tg0+b0*bd;if(tb+4*bd>dur-1.5)break;if(tb<t0+2)continue;
   let it=0;for(let h=0;h<8;h++)it+=S(b0+h/2);it/=8;if(it<.1)continue; // musica calma = pausa
   const ramp=Math.min(1,(tb-t0)/90),x=it*.6+ramp*.4+(r()-.5)*.3,g=r()*6|0,d=r()<.5?1:-1;
   const ty=x<.3?['wall']:x<.5?['zig','wall','stair']:x<.7?['zig','stair','alt3','pairs']:['burst','alt3','pairs','stair','burst'];
   for(const [b,gp] of PatternGenerator.PAT[ty[r()*ty.length|0]](g,d,r))rows.push({t:tb+b*bd,g:gp})}
  return this.repair(rows)}
 repair(rows){ // ogni passaggio deve essere raggiungibile dal giocatore
  let pr=null;
  for(const r of rows){r.g=r.g.map(v=>((v%6)+6)%6);
   if(pr){const al=Math.max(0,Math.floor((r.t-pr.t-TH/this.L.speed-.05)/.19));let bd=9,bp=0,bc=0;
    for(const a of pr.g)for(const c of r.g){const dd=cd(a,c);if(dd<bd){bd=dd;bp=a;bc=c}}
    if(bd>al){const sg=((bc-bp+6)%6)<=3?1:-1;r.g.push(((bp+sg*al)%6+6)%6)}}
   r.w=[0,1,2,3,4,5].map(s=>!r.g.includes(s));pr=r}
  return rows}
}
