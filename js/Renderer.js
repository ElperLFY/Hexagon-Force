import {TAU,SIDE,K,RP,HUB,TH} from './config.js';
const poly=(c,pts)=>{c.beginPath();pts.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.closePath()};
const P=(a,m)=>[m*K*Math.cos(a),m*K*Math.sin(a)];
// Tutto il disegno su canvas: scena (sfondo, muri, hub, giocatore) e interfaccia.
export class Renderer{
 constructor(cv){this.cv=cv;this.c=cv.getContext('2d');this.p=null;addEventListener('resize',()=>this.resize());this.resize()}
 resize(){const d=devicePixelRatio||1;this.W=this.cv.width=innerWidth*d;this.H=this.cv.height=innerHeight*d;this.U=Math.min(this.W,this.H)*.46}
 text(s,x,y,size,col,al='center'){const c=this.c;c.font=`900 ${size}px Orbitron,'Trebuchet MS',Arial,sans-serif`;c.fillStyle=col;c.textAlign=al;c.textBaseline='middle';c.fillText(s,x,y)}
 arrow(x,y,s,dir,col){this.c.fillStyle=col;poly(this.c,[[x+dir*s,y-s],[x-dir*s,y],[x+dir*s,y+s]]);this.c.fill()}
 scene(L,t,ch,walls,phi){
  const c=this.c,tt=Math.max(0,t-L.offset),per=16*ch.beatDur;
  const n=L.inv?Math.max(0,Math.floor((t-ch.tg0)/per)):0,r=Math.min(1,(t-ch.tg0-n*per)/.9);
  let f=(t-ch.tg0)/ch.beatDur;f-=Math.floor(f);const sc=1+.04*Math.exp(-5*f),rot=ch.rot(t);
  c.save();c.translate(this.W/2,this.H/2);c.scale(this.U*sc,this.U*sc);
  const draw=inv=>{const p=this.p=L.pal(tt,inv);c.save();c.rotate(rot);
   c.fillStyle=p.b1;c.fillRect(-9,-9,18,18);c.fillStyle=p.b2;
   for(let i=1;i<6;i+=2){const a=i*SIDE;poly(c,[[0,0],[9*Math.cos(a),9*Math.sin(a)],[9*Math.cos(a+SIDE),9*Math.sin(a+SIDE)]]);c.fill()}
   if(walls){c.fillStyle=p.w;for(const w of ch.rows){const m=RP+(w.t-t)*L.speed;if(m>5||m+TH<.1)continue;
    for(let s=0;s<6;s++)if(w.w[s]){const a=s*SIDE,b=a+SIDE;poly(c,[P(a,m),P(b,m),P(b,m+TH),P(a,m+TH)]);c.fill()}}}
   poly(c,[0,1,2,3,4,5].map(i=>P(i*SIDE,HUB)));c.fillStyle=p.b1;c.fill();c.lineWidth=.03;c.strokeStyle=p.w;c.stroke();c.restore()};
  if(n>0&&r<1){draw((n-1)&1);c.save();c.beginPath();c.arc(0,0,(1-Math.pow(1-r,3))*4.5,0,TAU);c.clip();draw(n&1);c.restore()}else draw(n&1);
  if(walls){c.rotate(phi);c.fillStyle=this.p.p;poly(c,[[RP+.045,0],[RP-.03,.035],[RP-.03,-.035]]);c.fill()}
  c.restore()}
 draw(g){
  const L=g.level,t=g.time(),ch=g.chart,{W,H,U}=this;this.scene(L,t,ch,g.live,g.phi);const p=this.p,s=g.state;
  if(g.live){
   this.text((t-L.offset).toFixed(2)+'s',W-U*.12,U*.12,U*.07,p.p,'right');
   this.text('BPM '+ch.bpm.toFixed(1),U*.12,U*.1,U*.035,p.p,'left');
   if(s!=='play'){this.text(s==='win'?'COMPLETATO!':'GAME OVER',W/2,H*.4,U*.14,p.p);
    this.text('SPAZIO / TOCCA · RIPROVA   ESC · MENU',W/2,H*.62,U*.045,p.p)}return}
  this.text('HEXBEAT',W/2,H*.2,U*.24,p.w);
  if(s==='gate'){this.text('PREMI UN TASTO O TOCCA PER INIZIARE',W/2,H*.6,U*.05,p.w);return}
  this.text(L.name,W/2,H*.52,U*.075,p.w);
  this.arrow(W*.12,H*.52,U*.1,-1,p.w);this.arrow(W*.88,H*.52,U*.1,1,p.w);
  if(g.best[g.lv])this.text('MIGLIOR TEMPO '+g.best[g.lv].toFixed(2)+'s',W/2,H*.62,U*.045,p.w);
  this.text(s==='load'?'ANALIZZO LA MUSICA…':'SPAZIO / TOCCA PER GIOCARE',W/2,H*.8,U*.05,p.w);
  this.text('← → SCEGLI IL LIVELLO',W/2,H*.87,U*.035,p.w);
  if(g.msg)this.text(g.msg,W/2,H*.95,U*.03,p.w)}
}
