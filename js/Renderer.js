import {TAU,SIDE,K,RP,HUB,TH,PL,VOID,VIS} from './config.js';
import {UIRenderer} from './UIRenderer.js';

const lerp=(a,b,k)=>a+(b-a)*k;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const poly=(c,pts)=>{
  c.beginPath();
  pts.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));
  c.closePath();
};
const P=(a,m)=>[m*K*Math.cos(a),m*K*Math.sin(a)];

const PLAYER_SIZE=.70;
const PLAYER_POINTS=[
  [0,0],
  [-(PL.tip-PL.back)*PLAYER_SIZE,PL.half*PLAYER_SIZE],
  [-(PL.tip-PL.back)*PLAYER_SIZE,-PL.half*PLAYER_SIZE]
];

// Canvas renderer: arena, incoming walls, player and HUD.
export class Renderer{
  constructor(cv){
    this.cv=cv;
    this.c=cv.getContext('2d');
    this.p=null;
    this.playerTilt=0;
    this.playerTiltTime=null;
    this.mapMul=1;
    this.hubLvl=0;
    this.camLvl=0;
    this.ui=new UIRenderer(this);
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

  drawPlayer(phi,color,turn=0){
    const c=this.c;
    // Turn is the smoothed angular velocity supplied by Game, normalized to
    // [-1,1]. A slightly longer response makes the lean clearly visible and
    // lets it settle naturally after the controls are released.
    const now=performance.now();
    const dt=this.playerTiltTime===null?1/60:Math.min((now-this.playerTiltTime)/1000,.05);
    this.playerTiltTime=now;
    const targetTilt=clamp(turn,1)*.62;
    const ease=1-Math.exp(-dt/.18);
    this.playerTilt+=(targetTilt-this.playerTilt)*ease;

    // Pivot exactly at the tip (PL.tip). The tip therefore remains at the
    // same orbital coordinate while the base leans around it.
    const placePlayer=()=>{
      c.rotate(phi);
      c.translate(PL.tip,0);
      c.rotate(this.playerTilt);
    };

    // One compact dark drop-shadow under the arrow; deliberately no trail.
    c.save();
    placePlayer();
    c.translate(-.006,.009);
    c.globalAlpha=.48;
    c.fillStyle='#000';
    poly(c,PLAYER_POINTS);c.fill();
    c.restore();

    c.save();
    placePlayer();
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
    const sc=(1+(.04+.05*tr)*Math.exp(-5*f)*VIS.beatZoom)*(1+VIS.cam.amount*this.camLvl);
    const rot=ch.rot(t,L);
    const hubS=VIS.hub.rest+VIS.hub.amount*this.hubLvl;

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
          const depth=w.th??TH;
          const outer=m+depth;
          // Match Chart.collision(): never draw a negative radius, which mirrors
          // a wall through the origin and makes it reappear from the Hub.
          if(m>5||outer<=HUB)continue;
          const innerVisible=Math.max(m,HUB);
          for(let s=0;s<6;s++)if(w.w[s]){
            const a=s*SIDE,b=a+SIDE;
            poly(c,[P(a,innerVisible),P(b,innerVisible),P(b,outer),P(a,outer)]);
            c.fill();
          }
        }
      }
      poly(c,[0,1,2,3,4,5].map(i=>P(i*SIDE,HUB*hubS)));
      c.fillStyle=p.b1;c.fill();
      if(VIS.hub.flash>0&&this.hubLvl>.01){
        const ga=c.globalAlpha;
        c.globalAlpha=ga*Math.min(1,VIS.hub.flash*this.hubLvl);
        c.fillStyle=p.w;c.fill();c.globalAlpha=ga;
      }
      c.lineWidth=.03*(1+VIS.hub.line*this.hubLvl);
      c.strokeStyle=p.w;c.stroke();c.restore();
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
    const al=Math.max(0,1-f.tau/1.2);
    c.fillStyle=c.strokeStyle=this.p.p;c.globalAlpha=al;c.lineWidth=.012;
    c.beginPath();c.arc(ox,oy,f.tau*1.6,0,TAU);c.stroke();
    for(const q of f.parts){
      c.save();c.translate(ox+Math.cos(q.a)*q.v*f.tau,oy+Math.sin(q.a)*q.v*f.tau);
      c.rotate(q.w*f.tau+f.phi);
      poly(c,[[q.s,0],[-q.s,q.s*.7],[-q.s,-q.s*.7]]);c.fill();c.restore();
    }
    c.globalAlpha=1;
  }

  // Void transition: inverted colours followed by the configured darkness sweep.
  post(g,t,ch){
    if(!g.live||ch.voidStart==null)return false;
    const vt=t-ch.voidStart;
    if(vt<0)return false;
    const c=this.c,{W,H,U}=this;
    const k=Math.min(1,vt/VOID.flip);
    c.save();
    if(k<1){
      c.beginPath();
      c.arc(W/2,H/2,(1-Math.pow(1-k,3))*Math.hypot(W,H)/2,0,TAU);
      c.clip();
    }
    c.globalCompositeOperation='difference';
    c.fillStyle='#fff';c.fillRect(0,0,W,H);
    c.restore();

    let p=Math.min(1,Math.max(0,(vt-VOID.flip-VOID.fade)/VOID.ramp));
    p=p*p*(3-2*p);
    const a=lerp(VOID.alpha[0],VOID.alpha[1],p)*(g.fx?Math.max(0,1-g.fx.tau*1.5):1);
    if(p>0&&a>.002){
      const edge=W/(2*U)+.05,s=ch.voidSide||1;
      const x0=W/2+s*lerp(edge,VOID.front,p)*U,x1=x0+s*VOID.width*U;
      const gr=c.createLinearGradient(x0,0,x1,0);
      gr.addColorStop(0,'rgba(0,0,0,0)');
      gr.addColorStop(1,`rgba(0,0,0,${a.toFixed(3)})`);
      c.fillStyle=gr;c.fillRect(0,0,W,H);
    }
    return true;
  }

  draw(g){
    const L=g.level,t=g.time(),ch=g.chart,{W,H,U}=this;
    const fx=g.fx,c=this.c;
    c.globalCompositeOperation='source-over';
    this.mapMul=g.mods?g.mods.mapSpeed:1;
    this.hubLvl=g.vis?g.vis.get(VIS.hub.band):0;
    this.camLvl=g.vis?g.vis.get(VIS.cam.band):0;
    if(fx){
      const k=Math.exp(-fx.tau*7);
      c.save();c.translate((Math.random()-.5)*U*.06*k,(Math.random()-.5)*U*.06*k);
    }

    const maxOmega=(L.turnRate??10)*(g.mods?.playerSpeed??1)*(g.voidActive?1.08:1);
    const turn=Number.isFinite(g.playerOmega)
      ?clamp(g.playerOmega/Math.max(.001,maxOmega),-1,1)
      :(g.input?(g.input.R-g.input.L):0);
    this.scene(L,t,ch,g.live,g.phi,fx,turn);

    if(fx){
      c.restore();c.fillStyle='#fff';c.globalAlpha=.55*Math.exp(-fx.tau*9);
      c.fillRect(0,0,W,H);c.globalAlpha=1;
    }

    // Results use the level palette rather than keeping the gameplay Void
    // compositing over the stage-complete presentation.
    const inverted=g.state!=='win'&&this.post(g,t,ch);
    if(inverted)c.globalCompositeOperation='difference';
    const p=inverted?{...this.p,p:'#fff',w:'#fff'}:this.p,s=g.state;
    if(g.uiOverlay==='scores'){this.ui.leaderboard(g,p);return;}
    if(s==='gate'){this.ui.title(g,p);return;}
    if(s==='menu'){this.ui.selection(g,p);return;}
    if(s==='win'||s==='dead'){this.ui.results(g,p,s==='win');return;}
    if(s==='load'){this.ui.loading(g,p);return;}
    if(g.live){
      this.text((t-L.offset).toFixed(2)+'s',W-U*.12,U*.12,U*.07,p.p,'right');
      this.text('BPM '+ch.bpm.toFixed(1),U*.12,U*.1,U*.035,p.p,'left');
      if(s!=='play'){
        this.text(s==='win'?'COMPLETATO!':'GAME OVER',W/2,H*.4,U*.14,p.p);
        this.text('SPAZIO / TOCCA · RIPROVA   ESC · MENU',W/2,H*.62,U*.045,p.p);
      }
      return;
    }

    // Fallback for any future UI state.

  }
}
