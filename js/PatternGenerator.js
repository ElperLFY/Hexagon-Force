import {TAU,SIDE,K,TH,RP,PL} from './config.js';

// Deterministic PRNG: the same level seed produces the same chart.
const mul=a=>()=>{
  a|=0;
  a=a+0x6D2B79F5|0;
  let t=Math.imul(a^a>>>15,1|a);
  t=t+Math.imul(t^t>>>7,61|t)^t;
  return ((t^t>>>14)>>>0)/4294967296;
};
const cd=(a,b)=>{
  const m=((a-b)%6+6)%6;
  return Math.min(m,6-m);
};
const norm=s=>((s%6)+6)%6;
const sd=a=>Math.floor((((a%TAU)+TAU)%TAU)/SIDE);
const wmask=g=>[0,1,2,3,4,5].map(s=>!g.includes(s));
const unique=a=>[...new Set(a.map(norm))];
const P=(a,m)=>[m*K*Math.cos(a),m*K*Math.sin(a)];

// Separating-axis polygon test. This avoids the old six-sample approximation,
// which could miss a triangle/wall overlap between sampled points.
function overlaps(a,b){
  for(const poly of [a,b]){
    for(let i=0;i<poly.length;i++){
      const p=poly[i],q=poly[(i+1)%poly.length];
      const ax=-(q[1]-p[1]),ay=q[0]-p[0];
      let amin=Infinity,amax=-Infinity,bmin=Infinity,bmax=-Infinity;
      for(const v of a){const d=v[0]*ax+v[1]*ay;amin=Math.min(amin,d);amax=Math.max(amax,d)}
      for(const v of b){const d=v[0]*ax+v[1]*ay;bmin=Math.min(bmin,d);bmax=Math.max(bmax,d)}
      if(amax<bmin-1e-9||bmax<amin-1e-9)return false;
    }
  }
  return true;
}

// The chart is the authored, song-synchronised wall sequence.
export class Chart{
  constructor(rows=[],beatDur=.5,tg0=0,bpm=0,dur=0,speed=1){
    Object.assign(this,{rows,beatDur,tg0,bpm,dur,speed});
  }

  // Each level has its own arena spin. The small beat-synchronised oscillation
  // adds motion without changing the authored wall timings.
  rot(t,L={}){
    const omega=L.rotSpeed??.35;
    const amp=L.rotAmp??.8;
    const beats=L.rotBeats??16;
    return omega*t+amp*Math.sin(t*TAU/(beats*this.beatDur));
  }

  hit(t,phi){
    const cs=Math.cos(phi),sn=Math.sin(phi);
    const tri=[[PL.tip,0],[PL.back,PL.half],[PL.back,-PL.half]].map(([x,y])=>[
      x*cs-y*sn,
      x*sn+y*cs
    ]);

    for(const row of this.rows){
      const dt=row.t-t;
      if(dt<-.55)continue;
      if(dt>.55)break;
      const inner=RP+dt*this.speed;
      if(inner+TH<=0)continue;
      for(let s=0;s<6;s++){
        if(!row.w[s])continue;
        const a=s*SIDE,b=a+SIDE;
        const wall=[P(a,inner),P(b,inner),P(b,inner+TH),P(a,inner+TH)];
        if(overlaps(tri,wall))return true;
      }
    }
    return false;
  }

  toJSON(){
    const{beatDur,tg0,bpm,dur,speed}=this;
    return{
      v:1,beatDur,tg0,bpm,dur,speed,
      rows:this.rows.map(r=>[+r.t.toFixed(4),...r.g])
    };
  }

  static fromJSON(j,L){
    if(!j||!Array.isArray(j.rows))throw new Error('Chart JSON non valido');
    const rows=j.rows.map(([t,...g])=>{
      if(!Number.isFinite(t)||!g.length)throw new Error('Riga chart non valida');
      const gaps=unique(g.map(Number).filter(Number.isFinite));
      if(!gaps.length)throw new Error('Riga chart senza aperture');
      return{t,g:gaps,w:wmask(gaps)};
    }).sort((a,b)=>a.t-b.t);
    return new Chart(rows,j.beatDur,j.tg0,j.bpm,j.dur,L.speed);
  }
}
Chart.EMPTY=new Chart();

// Pattern catalog inspired by the named movement families documented for
// Super Hexagon. Each entry is [beatOffset, openSectors].
export class PatternGenerator{
  static PAT={
    solo:g=>[[0,[g]]],
    solo2:g=>[[0,[g,g+3]]],
    solo3:g=>[[0,[g,g+2,g+4]]],

    wall:(g,d,r)=>[[0,[g]],[2,[g+(r()*3|0)-1]]],

    // Ladder: a genuine alternating zig-zag, faster than the former 4-step zig.
    ladder:(g,d)=>[0,.5,1,1.5,2,2.5,3,3.5].map((b,i)=>[b,[g+(i%2)*d]]),
    zig:(g,d)=>PatternGenerator.PAT.ladder(g,d),

    // One-way stair and three-hole alternating C shapes.
    stair:(g,d)=>[0,1,2,3].map(i=>[i,[g+i*d]]),
    alt3:g=>[0,1,2,3].map(i=>[i,[g+i%2,g+i%2+2,g+i%2+4]]),

    // Bat: two opposed openings drift together around the hexagon.
    bat:(g,d)=>[0,1,2,3].map(i=>[i,[g+(i%2)*d,g+3+(i%2)*d]]),
    pairs:(g,d)=>PatternGenerator.PAT.bat(g,d),

    burst:(g,d)=>[[0,[g]],[.5,[g]],[1,[g]],[1.5,[g]],[3,[g+2*d]]],

    // Three C-shaped parts, with successive openings three sectors apart.
    tripleC:g=>[[0,[g]],[1,[g+3]],[2,[g]]],

    // Single and double whirlpools.
    whirl:(g,d)=>[0,1,2,3,4,5].map(i=>[i*.75,[g+i*d]]),
    dwhirl:(g,d)=>[0,1,2,3,4,5].map(i=>[i*.75,[g+i*d,g+3+i*d]]),

    // Multi-C: consecutive single openings moving in one direction.
    multiC:(g,d)=>[0,1,2,3,4].map(i=>[i*.75,[g+i*d]]),

    // Stair 1: two opposite openings, both advancing by one sector.
    stair1:(g,d)=>[0,1,2,3,4].map(i=>[i,[g+i*d,g+3+i*d]]),

    // Stair 2: RRLLL (or its mirror), expressed as cumulative sector offsets.
    stair2:(g,d)=>[0,1,2,3,4,5].map((b,i)=>[b,[g+[0,1,2,1,0,-1][i]*d]]),

    // 3-2-1: move three, then two, then one sector.
    t321:(g,d)=>[[0,[g]],[2,[g+3]],[4,[g+3+2*d]],[5,[g+3+3*d]]],

    // Rain: alternating triple openings followed by a single-hole cap.
    rain:g=>[0,1,2,3].map(i=>[i,[g+i%2,g+i%2+2,g+i%2+4]])
      .concat([[4.5,[g+3]]]),

    // 2-spin: 2L, 2R, 2L...; 3-spin: 3R, 3L, 3R...
    spin2:(g,d)=>[0,1,2,3,4].map((b,i)=>[b,[g+(i%2)*2*d]]),
    spin3:g=>[0,1,2,3,4].map((b,i)=>[b,[g+(i%2)*3]]),

    // 4-spin is geometrically equivalent to alternating two-sector gaps
    // in a six-sided arena; the pattern timing preserves the long turn cue.
    spin4:(g,d)=>[[0,[g]],[1.5,[g-2*d]],[3,[g]]],

    // Two adjacent C-shaped gaps, staggered as a compact double-C figure.
    doubleC:(g,d)=>[0,1,2,3].map(i=>[i,[g+i*d,g+1+i*d]])
  };

  constructor(L){this.L=L;this.rng=mul(L.seed);}

  pool(x){
    const L=this.L;
    let p=x<.3
      ?['wall','solo','solo2']
      :x<.5
        ?['ladder','wall','stair','bat','solo2','tripleC']
        :x<.7
          ?['ladder','stair','bat','tripleC','whirl','spin2','doubleC']
          :['burst','ladder','tripleC','whirl','bat','multiC','spin2','spin3','t321','rain','doubleC'];

    if(L.hard){
      if(x>=.3)p.push('solo3','dwhirl');
      if(x>=.5)p.push('stair1','multiC','doubleC');
      if(x>=.68)p.push('stair2','spin4','spin3','t321','rain','dwhirl');
      if(x>=.5&&Array.isArray(L.extra))p.push(...L.extra);
    }
    return [...new Set(p)].filter(name=>typeof PatternGenerator.PAT[name]==='function');
  }

  choose(names,r){
    // Slightly favour fast, recognisable motifs without duplicating array entries.
    const weights=this.L.patternWeights||{};
    const weight=name=>Math.max(.1,Number(weights[name]??(
      name==='ladder'||name==='burst'||name==='whirl'?1.25:1
    )));
    const total=names.reduce((sum,name)=>sum+weight(name),0);
    let v=r()*total;
    for(const name of names){v-=weight(name);if(v<=0)return name;}
    return names[names.length-1];
  }

  generate(S,bd,tg0,dur){
    const L=this.L,r=this.rng,rows=[],t0=L.offset;
    if(!(bd>0)||!(dur>0))return rows;
    const quiet=L.intensityThreshold??(L.hard ? .065 : .1);
    for(let bar=0;;){
      const b0=bar*4,tb=tg0+b0*bd;
      if(tb+4*bd>dur-1.5)break;
      if(tb<t0+2){bar++;continue;}

      let intensity=0;
      for(let h=0;h<8;h++)intensity+=Math.max(0,Math.min(1,Number(S(b0+h/2))||0));
      intensity/=8;
      if(intensity<quiet){bar++;continue;}

      const ramp=Math.min(1,Math.max(0,(tb-t0)/(L.ramp||90)));
      const noise=(r()-.5)*(L.hard ? .18 : .3);
      const x=intensity*.42+ramp*.58+(L.diff||0)+(L.hard ? .08 : 0)+noise;
      const g=r()*6|0,d=r()<.5?1:-1;
      const names=this.pool(x);
      const name=this.choose(names,r);
      const pat=PatternGenerator.PAT[name](g,d,r);
      let end=0;
      for(const [beat,gaps] of pat){
        rows.push({t:tb+beat*bd,g:unique(gaps)});
        end=Math.max(end,beat);
      }
      // Reserve enough beats for the whole motif; long motifs intentionally
      // leave a short breath before the next four-beat phrase.
      bar+=Math.max(1,Math.ceil((end+.5)/4));
    }
    return this.repair(rows.filter(row=>row.t<dur-1).sort((a,b)=>a.t-b.t));
  }

  repair(rows){
    let previous=null;
    const turnRate=this.L.turnRate??6.4;
    const stepTime=SIDE/turnRate;
    const reaction=this.L.reactionMargin??.04;
    for(const row of rows){
      row.g=unique((row.g||[]).map(Number).filter(Number.isFinite));
      if(!row.g.length)row.g=previous?[previous.g[0]]:[0];

      if(previous){
        const dt=row.t-previous.t;
        const available=Math.max(0,dt-TH/this.L.speed-reaction);
        const maxSteps=Math.max(0,Math.floor(available/stepTime));
        let bestDistance=9,from=0,to=0;
        for(const a of previous.g)for(const b of row.g){
          const distance=cd(a,b);
          if(distance<bestDistance){bestDistance=distance;from=a;to=b;}
        }
        if(bestDistance>maxSteps){
          const clockwise=norm(to-from);
          const direction=clockwise<=3?1:-1;
          const bridge=norm(from+direction*Math.min(bestDistance,maxSteps));
          row.g=unique([...row.g,bridge]);
        }
      }
      row.w=wmask(row.g);
      previous=row;
    }
    return rows;
  }
}
