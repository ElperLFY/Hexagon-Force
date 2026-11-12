import {TAU,SIDE,TH,RP,PL} from './config.js';
const mul=a=>()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
const cd=(a,b)=>{const m=((a-b)%6+6)%6;return Math.min(m,6-m)};
const sd=a=>Math.floor((((a%TAU)+TAU)%TAU)/SIDE);
const wmask=g=>[0,1,2,3,4,5].map(s=>!g.includes(s));

// Il livello "scritto": file di muri sincronizzate sul tempo della canzone. Si salva/legge in JSON.
export class Chart{
 constructor(rows=[],beatDur=.5,tg0=0,bpm=0,dur=0,speed=1){Object.assign(this,{rows,beatDur,tg0,bpm,dur,speed})}
 rot(t){return .35*t+.8*Math.sin(t*TAU/(16*this.beatDur))}
 hit(t,phi){ // triangolo del giocatore (nel campo ruotante) contro i trapezi dei muri
  const V=[[PL.tip,0],[PL.back,PL.half],[PL.back,-PL.half]],cs=Math.cos(phi),sn=Math.sin(phi);
  const pts=[...V,...V.map((v,i)=>[(v[0]+V[(i+1)%3][0])/2,(v[1]+V[(i+1)%3][1])/2])];
  for(const r of this.rows){if(Math.abs(r.t-t)>.5)continue;const m0=RP+(r.t-t)*this.speed;
   for(const [lx,ly] of pts){const x=lx*cs-ly*sn,y=lx*sn+ly*cs,a=((Math.atan2(y,x)%TAU)+TAU)%TAU,s=sd(a),
     m=Math.hypot(x,y)*Math.cos(a-(s+.5)*SIDE);if(r.w[s]&&m>=m0&&m<=m0+TH)return true}}
  return false}
 toJSON(){const{beatDur,tg0,bpm,dur,speed}=this;return{v:1,beatDur,tg0,bpm,dur,speed,rows:this.rows.map(r=>[+r.t.toFixed(4),...r.g])}}
 static fromJSON(j,L){return new Chart(j.rows.map(([t,...g])=>({t,g,w:wmask(g)})),j.beatDur,j.tg0,j.bpm,j.dur,L.speed)}
}
Chart.EMPTY=new Chart();

// Pattern ispirati a Super Hexagon. Ogni pattern = [[beat,[lati aperti]],...]
export class PatternGenerator{
 static PAT={
  solo:g=>[[0,[g]]],
  solo2:g=>[[0,[g,g+3]]],
  solo3:g=>[[0,[g,g+2,g+4]]],
  wall:(g,d,r)=>[[0,[g]],[2,[g+(r()*3|0)-1]]],
  zig:(g,d)=>[0,1,2,3].map(i=>[i,[g+(i%2)*d]]),                       // Ladder
  stair:(g,d)=>[0,1,2,3].map(i=>[i,[g+i*d]]),
  alt3:g=>[0,1,2,3].map(i=>[i,[g+i%2,g+i%2+2,g+i%2+4]]),
  pairs:(g,d)=>[0,1,2,3].map(i=>[i,[g+(i%2)*d,g+3+(i%2)*d]]),          // Bat
  burst:(g,d)=>[[0,[g]],[.5,[g]],[1,[g]],[1.5,[g]],[3,[g+2*d]]],
  tripleC:g=>[[0,[g]],[2,[g+3]],[4,[g]]],
  whirl:(g,d)=>[0,1,2,3,4,5].map(i=>[i,[g+i*d]]),                      // Whirlpool
  multiC:(g,d)=>[0,1,2,3,4].map(i=>[i*.75,[g+i*d]]),                   // Multi C (MMMMM)
  stair1:(g,d)=>[0,1,2,3,4].map(i=>[i,[g+i*d,g+3+i*d]]),
  dwhirl:(g,d)=>[0,1,2,3,4,5].map(i=>[i,[g+i*d,g+3+i*d]]),             // Double Whirlpool
  t321:(g,d)=>[[0,[g]],[2,[g+3]],[4,[g+3+2*d]],[5,[g+3+3*d]]],         // 3-2-1
  rain:g=>[0,1,2,3].map(i=>[i,[g+i%2,g+i%2+2,g+i%2+4]]).concat([[4.5,[g+3]]]),
  spin2:(g,d)=>[0,1,2,3,4].map(i=>[i,[g+(i%2)*2*d]]),
  spin3:g=>[0,2,4,6].map((b,i)=>[b,[g+(i%2)*3]])};
 constructor(L){this.L=L;this.rng=mul(L.seed)}
 pool(x){const L=this.L;
  let p=x<.3?['wall']:x<.5?['zig','wall','stair']:x<.7?['zig','stair','alt3','pairs']:['burst','alt3','pairs','stair','burst'];
  if(L.hard){if(x>=.3)p=p.concat(['solo2','solo3','whirl']);if(x>=.5)p=p.concat(['tripleC','spin2','multiC']);
   if(x>=.7)p=p.concat(['stair1','spin3','t321','rain']);if(x>=.5&&L.extra)p=p.concat(L.extra,L.extra)}
  return p}
 generate(S,bd,tg0,dur){ // S(beat)=intensità 0..1 di quel punto della griglia
  const L=this.L,r=this.rng,rows=[],t0=L.offset;
  for(let bar=0;;){const b0=bar*4,tb=tg0+b0*bd;if(tb+4*bd>dur-1.5)break;
   if(tb<t0+2){bar++;continue}
   let it=0;for(let h=0;h<8;h++)it+=S(b0+h/2);it/=8;if(it<.1){bar++;continue} // musica calma = pausa
   const ramp=Math.min(1,(tb-t0)/(L.ramp||90)),x=it*.6+ramp*.4+(L.diff||0)+(r()-.5)*.3,g=r()*6|0,d=r()<.5?1:-1;
   const p=this.pool(x),pat=PatternGenerator.PAT[p[r()*p.length|0]](g,d,r);let end=0;
   for(const [b,gp] of pat){rows.push({t:tb+b*bd,g:gp});end=Math.max(end,b)}
   bar+=Math.max(1,Math.ceil((end+1)/4))}
  return this.repair(rows.filter(w=>w.t<dur-1))}
 repair(rows){ // ogni passaggio deve essere raggiungibile dal giocatore
  let pr=null;
  for(const r of rows){r.g=r.g.map(v=>((v%6)+6)%6);
   if(pr){const al=Math.max(0,Math.floor((r.t-pr.t-TH/this.L.speed-.05)/.19));let bd=9,bp=0,bc=0;
    for(const a of pr.g)for(const c of r.g){const dd=cd(a,c);if(dd<bd){bd=dd;bp=a;bc=c}}
    if(bd>al){const sg=((bc-bp+6)%6)<=3?1:-1;r.g.push(((bp+sg*al)%6+6)%6)}}
   r.w=wmask(r.g);pr=r}
  return rows}
}
