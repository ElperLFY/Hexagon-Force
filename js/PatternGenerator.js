import {TAU,SIDE,K,TH,RP,PL,VOID} from './config.js';

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

// Point-in-convex-polygon test. Collision is intentionally tested against
// the arrow tip only, not the full triangular player body.
function pointInConvexPolygon(point,poly){
  let sign=0;
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length];
    const cross=(b[0]-a[0])*(point[1]-a[1])-(b[1]-a[1])*(point[0]-a[0]);
    if(Math.abs(cross)<1e-10)continue;
    const current=cross>0?1:-1;
    if(sign&&current!==sign)return false;
    sign=current;
  }
  return true;
}

// Separating Axis Theorem for two convex polygons. Touching edges count as contact.
// Used for non-lethal side scrapes; only the pointed vertex is fatal.
function polygonsOverlap(a,b){
  for(const polygon of [a,b]){
    for(let i=0;i<polygon.length;i++){
      const p=polygon[i],q=polygon[(i+1)%polygon.length];
      const axisX=-(q[1]-p[1]),axisY=q[0]-p[0];
      let aMin=Infinity,aMax=-Infinity,bMin=Infinity,bMax=-Infinity;
      for(const v of a){
        const projection=v[0]*axisX+v[1]*axisY;
        aMin=Math.min(aMin,projection);aMax=Math.max(aMax,projection);
      }
      for(const v of b){
        const projection=v[0]*axisX+v[1]*axisY;
        bMin=Math.min(bMin,projection);bMax=Math.max(bMax,projection);
      }
      if(aMax<bMin-1e-9||bMax<aMin-1e-9)return false;
    }
  }
  return true;
}

const PLAYER_HITBOX_SCALE=.70;
function playerPolygon(phi){
  const local=[
    [PL.tip,0],
    [PL.tip-(PL.tip-PL.back)*PLAYER_HITBOX_SCALE,PL.half*PLAYER_HITBOX_SCALE],
    [PL.tip-(PL.tip-PL.back)*PLAYER_HITBOX_SCALE,-PL.half*PLAYER_HITBOX_SCALE]
  ];
  const c=Math.cos(phi),s=Math.sin(phi);
  return local.map(([x,y])=>[x*c-y*s,x*s+y*c]);
}

// Restore at least one reachable opening after a randomized phrase change.
function repairRows(rows,L,seed=null){
  let previous=seed; // seed = last row of the previous chunk, so reachability holds across chunk seams
  const turnRate=L.turnRate??6.4;
  const stepTime=SIDE/turnRate;
  const reaction=L.reactionMargin??.04;
  const speed=L.speed||1;
  for(const row of rows){
    row.g=unique((row.g||[]).map(Number).filter(Number.isFinite));
    if(!row.g.length)row.g=previous?[...previous.g]:[0];
    if(previous){
      const dt=row.t-previous.t;
      const available=Math.max(0,dt-TH/speed-reaction);
      const maxSteps=Math.min(3,Math.max(0,Math.floor(available/stepTime)));
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

  collision(t,phi,mapMul=1){
    // Result: "tip" = fatal point collision; "side" = body/edge contact;
    // null = free. The body uses the same 70% triangle drawn by Renderer.
    const tip=[PL.tip*Math.cos(phi),PL.tip*Math.sin(phi)];
    const body=playerPolygon(phi);
    const speed=(this.speed||1)*mapMul;
    const window=(TH+Math.abs(PL.tip-RP)+.08)/speed+.06;
    let sideContact=false;

    for(const row of this.rows){
      const dt=row.t-t;
      if(dt < -window)continue;
      if(dt > window)break;
      const inner=RP+dt*speed;
      if(inner+TH<=0)continue;

      for(let sector=0;sector<6;sector++){
        if(!row.w[sector])continue;
        const a=sector*SIDE,b=a+SIDE;
        const wall=[P(a,inner),P(b,inner),P(b,inner+TH),P(a,inner+TH)];

        // The tip remains the only lethal point.
        if(pointInConvexPolygon(tip,wall))return 'tip';
        if(polygonsOverlap(body,wall))sideContact=true;
      }
    }
    return sideContact?'side':null;
  }

  // Backwards-compatible fatal-hit query.
  hit(t,phi,mapMul=1){
    return this.collision(t,phi,mapMul)==='tip';
  }

  // Return a per-run variation of the authored chart. Beat timestamps remain
  // untouched; only sector orientation and a small number of gap choices vary.
  randomized(L,seed){
    const r=mul(seed>>>0);
    const sectionBeats=Math.max(4,L.randomSectionBeats??12);
    const laneShiftChance=Math.max(0,Math.min(1,L.randomLaneShiftChance??.12));
    const dropChance=Math.max(0,Math.min(1,L.randomDropChance??.08));
    const addChance=Math.max(0,Math.min(1,L.randomAddChance??.06));
    let section=-1,offset=0,mirror=false;

    const rows=this.rows.map(source=>{
      const beat=(source.t-this.tg0)/this.beatDur;
      const nextSection=Math.floor(beat/sectionBeats);
      if(nextSection!==section){
        section=nextSection;
        offset=r()*6|0;
        mirror=r()<.5;
      }
      let gaps=unique(source.g.map(g=>norm((mirror?-g:g)+offset)));

      // Occasional local lane change makes otherwise repeated motifs less
      // predictable while preserving their opening count.
      if(r()<laneShiftChance){
        const delta=r()<.5?1:-1;
        gaps=unique(gaps.map(g=>norm(g+delta)));
      }

      // Hard levels sometimes close one of several gaps; a few single-gap
      // rows gain a secondary route so the result is varied, not uniformly harsher.
      if(gaps.length>1&&r()<dropChance){
        gaps.splice(r()*gaps.length|0,1);
      }else if(gaps.length===1&&r()<addChance){
        const distance=r()<.65?2:3;
        gaps.push(norm(gaps[0]+(r()<.5?distance:-distance)));
      }
      return{t:source.t,g:gaps};
    });

    const repaired=repairRows(rows,L);
    return new Chart(repaired,this.beatDur,this.tg0,this.bpm,this.dur,L.speed);
  }

  // Endless "void" phase. From `start` (snapped to the next beat, so the flip lands on the music)
  // the authored rows are dropped and replaced by generated ones, produced lazily by ensure().
  endless(L,seed,start){
    const bd=this.beatDur;
    this.stageEnd=this.dur;
    this.voidStart=this.tg0+Math.ceil((start-this.tg0)/bd-1e-6)*bd;
    this.rows=this.rows.filter(r=>r.t<this.voidStart);
    this.voidSide=mul(seed>>>0)()<.5?-1:1; // which side of the screen the darkness comes from
    this.gen=new PatternGenerator({...L,seed});
    this.voidNext=this.voidStart+.1;
    this.voidPrev=this.rows[this.rows.length-1]||null;
    this.dur=Infinity; // never "completed"
    return this;
  }

  // Keep generated rows VOID.ahead seconds in front of the song clock; drop rows long gone.
  ensure(t){
    if(!this.gen)return;
    while(this.voidNext<t+VOID.ahead){
      const rows=this.gen.generateVoid(this.voidNext,VOID.chunkBars,this.beatDur,this.tg0,this.voidStart,this.voidPrev);
      this.voidNext=this.gen.voidNext;
      if(rows.length){this.rows.push(...rows);this.voidPrev=rows[rows.length-1];}
    }
    if(this.rows.length>400){
      const i=this.rows.findIndex(r=>r.t>t-4);
      if(i>150)this.rows.splice(0,i);
    }
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

  repair(rows,seed=null){
    return repairRows(rows,this.L,seed);
  }

  // Endless phase: `bars` four-beat bars from the first bar line at/after `from`, ignoring the music's
  // intensity and getting harder as (time - t0) grows. Returns the new rows (sorted, repaired against
  // `prev`) and leaves the next free bar line in this.voidNext, so chunks can be chained seamlessly.
  generateVoid(from,bars,bd,tg0,t0=from,prev=null){
    const L=this.L,r=this.rng,rows=[];
    if(!(bd>0)||!(bars>0)){this.voidNext=from;return rows;}
    const first=Math.ceil((from-tg0)/(4*bd)-1e-6),stop=tg0+(first+bars)*4*bd;
    for(let bar=first;;){
      const tb=tg0+bar*4*bd;
      if(tb>=stop){this.voidNext=tb;break;}
      const ramp=Math.min(1,Math.max(0,(tb-t0)/(L.voidRamp||150)));
      const x=.62+.3*ramp+(L.diff||0)*.5+(r()-.5)*.2;
      const g=r()*6|0,d=r()<.5?1:-1;
      const name=this.choose(this.pool(x),r);
      let end=0;
      for(const [beat,gaps] of PatternGenerator.PAT[name](g,d,r)){
        rows.push({t:tb+beat*bd,g:unique(gaps)});
        end=Math.max(end,beat);
      }
      bar+=Math.max(1,Math.ceil((end+.5)/4));
    }
    return this.repair(rows.sort((a,b)=>a.t-b.t),prev);
  }}
