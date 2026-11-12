import {TAU,SIDE,K,RP,HUB,TH,PL,VOID} from './config.js';
const lerp=(a,b,k)=>a+(b-a)*k;
const poly=(c,pts)=>{
  c.beginPath();
  pts.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));
  c.closePath();
};
const P=(a,m)=>[m*K*Math.cos(a),m*K*Math.sin(a)];
const PLAYER_POINTS=[[PL.tip,0],[PL.back,PL.half],[PL.back,-PL.half]];

// Canvas renderer: arena, incoming walls, player after-image and HUD.
export class Renderer{
  constructor(cv){
    this.cv=cv;
    this.c=cv.getContext('2d');
    this.p=null;
    this.turnTrail=0;
    this.mapMul=1; // ModMenu "map speed"
    addEventListener('resize',()=>this.resize());
    this.resize();
  }

  resize(){
    const d=devicePixelRatio||1;
    this.W=this.cv.width=innerWidth*d;
    this.H=this.cv.height=innerHeight*d;
    this.U=Math.min(this.W,this.H)*.46;
  }

  text(s,x,y,size,col,al='center'){
    const c=this.c;
    c.font=`900 ${size}px Orbitron,'Trebuchet MS',Arial,sans-serif`;
    c.fillStyle=col;c.textAlign=al;c.textBaseline='middle';c.fillText(s,x,y);
  }

  arrow(x,y,s,dir,col){
    this.c.fillStyle=col;
    poly(this.c,[[x+dir*s,y-s],[x-dir*s,y],[x+dir*s,y+s]]);
    this.c.fill();
  }

  drawPlayer(phi,color,turn){
    const c=this.c;
    if(turn)this.turnTrail=turn;
    else this.turnTrail*=.86;
    const direction=this.turnTrail;

    // A small dark drop-shadow keeps the pointer readable on bright palettes.
    c.save();
    c.rotate(phi);
    c.translate(-.006,.008);
    c.globalAlpha=.48;
    c.fillStyle='#000';
    poly(c,PLAYER_POINTS);c.fill();
    c.restore();
    
    c.save();
    c.rotate(phi);
    c.shadowColor=color;
    c.shadowBlur=9;
    c.fillStyle=color;
    poly(c,PLAYER_POINTS);c.fill();
    c.shadowBlur=0;
    c.lineWidth=.006;
    c.strokeStyle='rgba(255,255,255,.58)';
    c.stroke();
    c.restore();
  }

   

  scene(L,t,ch,walls,phi,fx,turn=0){
    const c=this.c,tt=Math.max(0,t-L.offset),per=16*ch.beatDur;
    const n=L.inv?Math.max(0,Math.floor((t-ch.tg0)/per)):0;
    const r=Math.min(1,(t-ch.tg0-n*per)/.9);
    let f=(t-ch.tg0)/ch.beatDur;f-=Math.floor(f);
    const tr=L.trip?.4+.6*Math.min(1,tt/120):0;
    const sc=1+(.04+.05*tr)*Math.exp(-5*f),rot=ch.rot(t,L);

    c.save();
    c.translate(this.W/2,this.H/2);
    c.scale(this.U*sc,this.U*sc);
    if(tr)c.transform(1,.05*tr*Math.sin(t*.7),.05*tr*Math.sin(t*.9+1),1,0,0);

    const draw=(inv,er=0)=>{
      const p=this.p=L.pal(tt,inv);
      c.save();c.rotate(rot+er);
      c.fillStyle=p.b1;c.fillRect(-9,-9,18,18);
      c.fillStyle=p.b2;
      for(let i=1;i<6;i+=2){
        const a=i*SIDE;
        poly(c,[[0,0],[9*Math.cos(a),9*Math.sin(a)],[9*Math.cos(a+SIDE),9*Math.sin(a+SIDE)]]);
        c.fill();
      }
      if(walls){
        c.fillStyle=p.w;
        for(const w of ch.rows){
          const m=RP+(w.t-t)*L.speed*this.mapMul;
          if(m>5||m+TH<.1)continue;
          for(let s=0;s<6;s++)if(w.w[s]){
            const a=s*SIDE,b=a+SIDE;
            poly(c,[P(a,m),P(b,m),P(b,m+TH),P(a,m+TH)]);
            c.fill();
          }
        }
      }
      poly(c,[0,1,2,3,4,5].map(i=>P(i*SIDE,HUB)));
      c.fillStyle=p.b1;c.fill();c.lineWidth=.03;c.strokeStyle=p.w;c.stroke();
      c.restore();
    };

    if(n>0&&r<1){
      draw((n-1)&1);
      c.save();c.beginPath();c.arc(0,0,(1-Math.pow(1-r,3))*4.5,0,TAU);c.clip();
      draw(n&1);c.restore();
    }else draw(n&1);

    if(tr){c.globalAlpha=.22;draw(n&1,.14*Math.sin(t*.6)*tr);c.globalAlpha=1;}

    if(walls){
      c.rotate(rot);
      if(fx)this.shards(fx);
      else this.drawPlayer(phi,this.p.p,turn);
    }
    c.restore();
  }

  shards(f){
    const c=this.c,ox=RP*Math.cos(f.phi),oy=RP*Math.sin(f.phi);
    const alpha=Math.max(0,1-f.tau/1.2);
    c.fillStyle=c.strokeStyle=this.p.p;
    c.globalAlpha=alpha;c.lineWidth=.012;
    c.beginPath();c.arc(ox,oy,f.tau*1.6,0,TAU);c.stroke();
    for(const q of f.parts){
      c.save();
      c.translate(ox+Math.cos(q.a)*q.v*f.tau,oy+Math.sin(q.a)*q.v*f.tau);
      c.rotate(q.w*f.tau+f.phi);
      poly(c,[[q.s,0],[-q.s,q.s*.7],[-q.s,-q.s*.7]]);c.fill();
      c.restore();
    }
    c.globalAlpha=1;
  }

  // Endless "void" phase: the whole frame is colour-inverted (sweeping out from the centre), then a black
  // gradient creeps in from one side of the screen. It stops short of the hub and never reaches full
  // black, so the walls close to the arrow stay readable: very hard, not impossible.
  post(g,t,ch){
    if(!g.live||ch.voidStart==null)return false;
    const vt=t-ch.voidStart;
    if(vt<0)return false;
    const c=this.c,{W,H,U}=this;
    const k=Math.min(1,vt/VOID.flip);
    c.save();
    if(k<1){c.beginPath();c.arc(W/2,H/2,(1-Math.pow(1-k,3))*Math.hypot(W,H)/2,0,TAU);c.clip();}
    c.globalCompositeOperation='difference';
    c.fillStyle='#fff';c.fillRect(0,0,W,H); // |white - pixel| = inverted pixel
    c.restore();

    let p=Math.min(1,Math.max(0,(vt-VOID.flip-VOID.fade)/VOID.ramp));
    p=p*p*(3-2*p);
    const a=lerp(VOID.alpha[0],VOID.alpha[1],p)*(g.fx?Math.max(0,1-g.fx.tau*1.5):1); // darkness lifts on the game-over screen
    if(p>0&&a>.002){
      const edge=W/(2*U)+.05,s=ch.voidSide||1; // starts just off-screen
      const x0=W/2+s*lerp(edge,VOID.front,p)*U,x1=x0+s*VOID.width*U;
      const gr=c.createLinearGradient(x0,0,x1,0);
      gr.addColorStop(0,'rgba(0,0,0,0)');gr.addColorStop(1,`rgba(0,0,0,${a.toFixed(3)})`);
      c.fillStyle=gr;c.fillRect(0,0,W,H);
    }
    return true;
  }

  draw(g){
    const L=g.level,t=g.time(),ch=g.chart,{W,H,U}=this;
    const fx=g.fx,c=this.c;
    c.globalCompositeOperation='source-over';
    this.mapMul=g.mods?g.mods.mapSpeed:1;
    if(fx){
      const k=Math.exp(-fx.tau*7);
      c.save();c.translate((Math.random()-.5)*U*.06*k,(Math.random()-.5)*U*.06*k);
    }
    const turn=g.input?(g.input.R-g.input.L):0;
    this.scene(L,t,ch,g.live,g.phi,fx,turn);
    if(fx){
      c.restore();c.fillStyle='#fff';c.globalAlpha=.55*Math.exp(-fx.tau*9);
      c.fillRect(0,0,W,H);c.globalAlpha=1;
    }

    // In the void the HUD is drawn last, in "difference" mode, so it stays readable on any background.
    const inverted=this.post(g,t,ch);
    if(inverted)c.globalCompositeOperation='difference';
    const p=inverted?{...this.p,p:'#fff',w:'#fff'}:this.p,s=g.state;
    if(g.live){
      this.text((t-L.offset).toFixed(2)+'s',W-U*.12,U*.12,U*.07,p.p,'right');
      this.text('BPM '+ch.bpm.toFixed(1),U*.12,U*.1,U*.035,p.p,'left');
      if(s!=='play'){
        this.text(s==='win'?'COMPLETATO!':'GAME OVER',W/2,H*.4,U*.14,p.p);
        this.text('SPAZIO / TOCCA · RIPROVA   ESC · MENU',W/2,H*.62,U*.045,p.p);
      }
      return;
    }

    this.text('HEXBEAT',W/2,H*.2,U*.24,p.w);
    if(s==='gate'){
      this.text('PREMI UN TASTO O TOCCA PER INIZIARE',W/2,H*.6,U*.05,p.w);
      return;
    }
    this.text(L.name,W/2,H*.52,U*.075,p.w);
    this.arrow(W*.12,H*.52,U*.1,-1,p.w);
    this.arrow(W*.88,H*.52,U*.1,1,p.w);
    if(g.best[g.lv])this.text('MIGLIOR TEMPO '+g.best[g.lv].toFixed(2)+'s',W/2,H*.62,U*.045,p.w);
    this.text(s==='load'?'ANALIZZO LA MUSICA…':'SPAZIO / TOCCA PER GIOCARE',W/2,H*.8,U*.05,p.w);
    this.text('← → SCEGLI IL LIVELLO  ·  J SALVA IL LIVELLO IN JSON',W/2,H*.87,U*.035,p.w);
    if(g.msg)this.text(g.msg,W/2,H*.95,U*.03,p.w);
  }
}
