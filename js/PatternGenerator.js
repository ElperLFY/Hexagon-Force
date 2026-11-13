import {TAU,SIDE,K,TH,RP,HUB,PL,VOID} from './config.js';

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
  let previous=seed;
  const turnRate=L.turnRate??6.4;
  const stepTime=SIDE/turnRate;
  const reaction=L.reactionMargin??.04;
  const speed=L.speed||1;

  // Process complete motifs as atomic phrases. If a phrase needs a different
  // starting lane, rotate every Part together instead of opening/closing an
  // individual row. This is essential for multi-beat structures such as Ladder.
  for(let index=0;index<rows.length;){
    const first=rows[index];
    first.g=unique((first.g||[]).map(Number).filter(Number.isFinite));
    if(!first.g.length)first.g=previous?[...previous.g]:[0];

    let last=index+1;
    if(first.motifId!=null){
      while(last<rows.length&&rows[last].motifId===first.motifId)last++;
    }

    if(first.motifId!=null){
      if(previous){
        const from=previous.route!=null&&previous.g.includes(previous.route)
          ?previous.route:previous.g[0];
        // The motif has rotational symmetry in Z6. Find one global rotation
        // that makes the current lane an opening in its first Part.
        let shift=0,best=Infinity;
        for(let candidate=0;candidate<6;candidate++){
          const distance=Math.min(...first.g.map(g=>cd(from,norm(g+candidate))));
          if(distance<best){best=distance;shift=candidate;}
          if(distance===0)break;
        }
        if(shift){
          for(let j=index;j<last;j++){
            rows[j].g=unique((rows[j].g||[]).map(g=>norm(g+shift)));
          }
        }
      }

      for(let j=index;j<last;j++){
        const row=rows[j];
        row.g=unique((row.g||[]).map(Number).filter(Number.isFinite));
        if(!row.g.length)row.g=previous?[...previous.g]:[0];
        if(previous){
          const dt=row.t-previous.t;
          const previousDepth=previous.routeDepth??previous.th??TH;
          const available=Math.max(0,dt-previousDepth/speed-reaction);
          const maxSteps=Math.min(3,Math.max(0,Math.floor(available/stepTime)));
          const from=previous.route!=null&&previous.g.includes(previous.route)
            ?previous.route:previous.g[0];
          let bestDistance=9,to=from;
          for(const candidate of row.g){
            const distance=cd(from,candidate);
            if(distance<bestDistance){bestDistance=distance;to=candidate;}
          }
          // Keep the authored silhouette intact. If this route cannot be
          // traversed, the kinematic audit must reject the motif; do not hide
          // the defect by silently removing one of its structural walls.
          row.route=to;
          row.routeReachable=bestDistance<=maxSteps;
        }else{
          row.route=row.g[0];
          row.routeReachable=true;
        }
        row.w=wmask(row.g);
        previous=row;
      }
      index=last;
      continue;
    }

    // Legacy, ungrouped chart rows keep the conservative bridge-opening repair.
    if(previous){
      const dt=first.t-previous.t;
      const previousDepth=previous.routeDepth??previous.th??TH;
      const available=Math.max(0,dt-previousDepth/speed-reaction);
      const maxSteps=Math.min(3,Math.max(0,Math.floor(available/stepTime)));
      const from=previous.route!=null&&previous.g.includes(previous.route)
        ?previous.route:previous.g[0];
      let bestDistance=9,to=from;
      for(const candidate of first.g){
        const distance=cd(from,candidate);
        if(distance<bestDistance){bestDistance=distance;to=candidate;}
      }
      if(bestDistance>maxSteps){
        const clockwise=norm(to-from);
        const direction=clockwise<=3?1:-1;
        const bridge=norm(from+direction*Math.min(bestDistance,maxSteps));
        first.g=unique([...first.g,bridge]);
        first.route=bridge;
      }else{
        first.route=to;
      }
    }else{
      first.route=first.g[0];
    }
    first.w=wmask(first.g);
    previous=first;
    index++;
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
    const maxDepth=this.rows.reduce((max,row)=>Math.max(max,row.th??TH),TH);
    const window=(maxDepth+Math.abs(PL.tip-RP)+.08)/speed+.06;
    let sideContact=null;

    for(const row of this.rows){
      const dt=row.t-t;
      if(dt < -window)continue;
      if(dt > window)break;
      const inner=RP+dt*speed;
      const depth=row.th??TH;
      const outer=inner+depth;

      // Never pass a negative radius to P(): it mirrors the wall by 180 degrees,
      // creating phantom collisions and geometry that appears to emerge from the hub.
      if(outer<=HUB)continue;
      const clippedInner=Math.max(inner,HUB);
      if(outer<=clippedInner)continue;

      for(let sector=0;sector<6;sector++){
        if(!row.w[sector])continue;
        const a=sector*SIDE,b=a+SIDE;
        const wall=[P(a,clippedInner),P(b,clippedInner),P(b,outer),P(a,outer)];

        // The tip remains the only lethal point. Include the exact wall identity
        // so a side scrape cannot shield the player from a different wall.
        if(pointInConvexPolygon(tip,wall))return {type:'tip',row,sector};
        if(!sideContact&&polygonsOverlap(body,wall)){
          sideContact={type:'side',row,sector};
        }
      }
    }
    return sideContact;
  }

  // Backwards-compatible fatal-hit query.
  hit(t,phi,mapMul=1){
    return this.collision(t,phi,mapMul)?.type==='tip';
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
    const motifTransforms=new Map();

    const rows=this.rows.map(source=>{
      const beat=(source.t-this.tg0)/this.beatDur;
      let transform;
      const atomic=source.motifId!=null;

      if(atomic){
        // A complete multi-Part pattern is one visual phrase. Never let a
        // random-section boundary mirror/rotate its later rows independently.
        transform=motifTransforms.get(source.motifId);
        if(!transform){
          transform={offset:r()*6|0,mirror:r()<.5};
          motifTransforms.set(source.motifId,transform);
        }
      }else{
        const nextSection=Math.floor(beat/sectionBeats);
        if(nextSection!==section){
          section=nextSection;
          offset=r()*6|0;
          mirror=r()<.5;
        }
        transform={offset,mirror};
      }

      let gaps=unique(source.g.map(g=>norm((transform.mirror?-g:g)+transform.offset)));

      // Legacy / ungrouped chart rows can still receive local variation.
      // Atomic generated motifs retain their full authored silhouette.
      if(!atomic&&source.th==null&&r()<laneShiftChance){
        const delta=r()<.5?1:-1;
        gaps=unique(gaps.map(g=>norm(g+delta)));
      }

      if(!atomic&&source.th==null&&gaps.length>1&&r()<dropChance){
        gaps.splice(r()*gaps.length|0,1);
      }else if(!atomic&&source.th==null&&gaps.length===1&&r()<addChance){
        const distance=r()<.65?2:3;
        gaps.push(norm(gaps[0]+(r()<.5?distance:-distance)));
      }
      return{...source,g:gaps,w:wmask(gaps)};
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
    this.voidNext=this.voidStart;
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
      rows:this.rows.map(r=>{
        const extended=r.th!=null||r.routeDepth!=null||r.motifId!=null;
        if(!extended)return[+r.t.toFixed(4),...r.g];
        return{
          t:+r.t.toFixed(4),g:[...r.g],
          ...(r.th==null?{}:{th:+r.th.toFixed(6)}),
          ...(r.routeDepth==null?{}:{rd:+r.routeDepth.toFixed(6)}),
          ...(r.motifId==null?{}:{mid:r.motifId,mn:r.motifName,ms:r.motifStart,me:r.motifEnd})
        };
      })
    };
  }

  static fromJSON(j,L){
    if(!j||!Array.isArray(j.rows))throw new Error('Chart JSON non valido');
    const rows=j.rows.map(item=>{
      let t,g,th,rd,mid,mn,ms,me;
      if(Array.isArray(item)){
        [t,...g]=item;
      }else if(item&&typeof item==='object'){
        ({t,g,th,rd,mid,mn,ms,me}=item);
      }else{
        throw new Error('Riga chart non valida');
      }
      if(!Number.isFinite(t)||!Array.isArray(g)||!g.length)throw new Error('Riga chart non valida');
      const gaps=unique(g.map(Number).filter(Number.isFinite));
      if(!gaps.length)throw new Error('Riga chart senza aperture');
      const row={t,g:gaps,w:wmask(gaps)};
      if(Number.isFinite(th)&&th>0)row.th=th;
      if(Number.isFinite(rd)&&rd>=0)row.routeDepth=rd;
      if(mid!=null)row.motifId=String(mid);
      if(typeof mn==='string')row.motifName=mn;
      if(Number.isFinite(ms))row.motifStart=ms;
      if(Number.isFinite(me))row.motifEnd=me;
      return row;
    }).sort((a,b)=>a.t-b.t);
    return new Chart(rows,j.beatDur,j.tg0,j.bpm,j.dur,L.speed);
  }
}
Chart.EMPTY=new Chart();

// Pattern catalog inspired by the named movement families documented for
// Super Hexagon. Each entry is [beatOffset, openSectors].
export class PatternGenerator{
  // A Ladder is a complete phrase, not a bag of independent rows. The next
  // phrase is restricted to multi-opening patterns with a safe first Part.
  static POST_LADDER=Object.freeze(['solo2','solo3','bat','dwhirl','stair1','rain']);

  static PAT={
    solo:g=>[[0,[g]]],
    solo2:g=>[[0,[g,g+3]]],
    solo3:g=>[[0,[g,g+2,g+4]]],

    wall:(g,d,r)=>[[0,[g],.4],[2,[g+(r()*3|0)-1],.4]],

    // Ladder is authored as one persistent pair of opposing rails plus
    // eight mirrored cross-rungs. The two rails are one composite Part: keeping
    // them in separate same-time rows made route repair alter one rail only.
    // Rungs alternate between opposite sector pairs, leaving two opposite
    // openings that shift by one sector at regular 0.75-beat intervals.
    // Event tuple: [beatOffset, openSectors, wallSpanBeats, routeDepthBeats?].
    ladder:(g,d)=>{
      const sectors=[0,1,2,3,4,5];
      const rails=[norm(g),norm(g+3)];
      const firstOpen=d>0
        ?[norm(g+2),norm(g+5)]
        :[norm(g+1),norm(g+4)];
      const secondOpen=d>0
        ?[norm(g+1),norm(g+4)]
        :[norm(g+2),norm(g+5)];
      const events=[
        [
          0,
          [...firstOpen,...secondOpen],
          6.22,
          0
        ]
      ];
      for(let i=0;i<8;i++){
        const openings=i%2===0?firstOpen:secondOpen;
        events.push([
          .75+i*.75,
          [...rails,...openings],
          .22
        ]);
      }
      return events;
    },
    zig:(g,d)=>PatternGenerator.PAT.ladder(g,d),

    // One-way stair and three-hole alternating C shapes.
    stair:(g,d)=>[0,1,2,3].map(i=>[i,[g+i*d],.42]),
    alt3:g=>[0,1,2,3].map(i=>[i,[g+i%2,g+i%2+2,g+i%2+4],.42]),

    // Bat: two opposed openings drift together around the hexagon.
    bat:(g,d)=>[0,1,2,3].map(i=>[i,[g+(i%2)*d,g+3+(i%2)*d],.42]),
    pairs:(g,d)=>PatternGenerator.PAT.bat(g,d),

    burst:(g,d)=>[[0,[g],.32],[.5,[g],.32],[1,[g],.32],[1.5,[g],.32],[3,[g+2*d],.42]],

    // Three C-shaped Parts. The openings alternate across the arena; the
    // three-sector M jump needs enough time to cross the full diameter.
    // One beat was not enough at the slower turn-rate stages once wall depth
    // and reaction margin were deducted, so use a 2.5-beat interval.
    tripleC:g=>[[0,[g],.42],[2.5,[g+3],.42],[5,[g],.42]],

    // A continuous spiral lane. Double Whirlpool keeps a second, opposite lane.
    whirl:(g,d)=>[0,1,2,3,4,5].map(i=>[i,[g+i*d],.58]),
    dwhirl:(g,d)=>[0,1,2,3,4,5].map(i=>[i,[g+i*d,g+3+i*d],.58]),

    // Multi-C: consecutive single openings moving in one direction.
    multiC:(g,d)=>[0,1,2,3,4].map(i=>[i,[g+i*d],.58]),

    // Stair 1: two opposite openings, both advancing by one sector.
    stair1:(g,d)=>[0,1,2,3,4].map(i=>[i,[g+i*d,g+3+i*d],.42]),

    // Stair 2 follows the RRLLL cumulative sector offsets.
    stair2:(g,d)=>[0,1,2,3,4,5].map((b,i)=>[b,[g+[0,1,2,1,0,-1][i]*d],.42]),

    // 3-2-1 is an M-shaped route: move 3, then 2, then 1 unit.
    t321:(g,d)=>[[0,[g],.38],[2,[g+3],.38],[4,[g+3+2*d],.38],[5,[g+3+3*d],.38]],

    // Rain: alternating triple openings followed by a single-hole cap.
    rain:g=>[0,1,2,3].map(i=>[i,[g+i%2,g+i%2+2,g+i%2+4],.42])
      .concat([[4.5,[g+3],.42]]),

    // User reference: 2/3/4-Spin share the same 1-2-3 movement motif.
    // The number in the name is the number of times that motif is repeated.
    spin:(g,d,repeats)=>Array.from({length:repeats*3},(_,i)=>[
      i*2,[g+[0,1,3][i%3]*d],.58
    ]),
    spin2:(g,d)=>PatternGenerator.PAT.spin(g,d,2),
    spin3:(g,d)=>PatternGenerator.PAT.spin(g,d,3),
    spin4:(g,d)=>PatternGenerator.PAT.spin(g,d,4),

    // Two adjacent C-shaped gaps, staggered as a compact double-C figure.
    doubleC:(g,d)=>[0,1,2,3].map(i=>[i,[g+i*d,g+1+i*d],.42])
  };

  constructor(L){this.L=L;this.rng=mul(L.seed);this.lastVoidPattern=null;this.lastVoidMulti=false;this.lastVoidOpenings=null;this.postVoidLadderRemaining=0;}

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

  poolAfter(names){
    const safe=names.filter(name=>PatternGenerator.POST_LADDER.includes(name));
    return safe.length?safe:PatternGenerator.POST_LADDER.filter(name=>typeof PatternGenerator.PAT[name]==='function');
  }

  generate(S,bd,tg0,dur){
    const L=this.L,r=this.rng,rows=[],t0=L.offset;
    if(!(bd>0)||!(dur>0))return rows;
    const quiet=L.intensityThreshold??(L.hard ? .065 : .1);
    let beatCursor=Math.max(0,Math.ceil((t0+2-tg0)/(4*bd)-1e-6)*4);
    let previousPattern=null;
    let postLadderRemaining=0;
    for(;;){
      const b0=beatCursor,tb=tg0+b0*bd;
      if(tb+4*bd>dur-1.5)break;

      let intensity=0;
      for(let h=0;h<8;h++)intensity+=Math.max(0,Math.min(1,Number(S(b0+h/2))||0));
      intensity/=8;

      // Blu/RGB must not leave empty bars when the music becomes quiet.
      // On hard stages intensity affects pattern weighting only; generation continues.
      if(intensity<quiet&&!L.hard){
        beatCursor+=4;
        continue;
      }

      const ramp=Math.min(1,Math.max(0,(tb-t0)/(L.ramp||90)));
      const noise=(r()-.5)*(L.hard ? .18 : .3);
      const rawX=intensity*.42+ramp*.58+(L.diff||0)+(L.hard ? .08 : 0)+noise;
      const x=L.hard?Math.max(.55,rawX):rawX;
      const g=r()*6|0,d=r()<.5?1:-1;
      const names=this.pool(x);
      const enteringPostLadder=previousPattern==='ladder'||previousPattern==='zig';
      const inPostLadder=enteringPostLadder||postLadderRemaining>0;
      const candidates=inPostLadder?this.poolAfter(names):names;
      const name=this.choose(candidates,r);
      const pat=PatternGenerator.PAT[name](g,d,r);
      if(name==='ladder'||name==='zig'){
        postLadderRemaining=2;
      }else if(enteringPostLadder){
        postLadderRemaining=1;
      }else if(postLadderRemaining>0){
        postLadderRemaining--;
      }
      const motifId=`${name}@${tb.toFixed(6)}`;
      const motifDuration=Math.max(...pat.map(([beat,,spanBeats=0])=>
        beat+(spanBeats>0?spanBeats:TH/((L.speed||1)*bd))
      ));
      let end=0;
      for(const [beat,gaps,spanBeats=0,routeSpanBeats=null] of pat){
        const effectiveSpan=spanBeats>0?spanBeats:TH/((L.speed||1)*bd);
        const row={
          t:tb+beat*bd,g:unique(gaps),
          motifId,motifName:name,motifStart:tb,motifEnd:tb+motifDuration*bd
        };
        if(spanBeats>0)row.th=Math.max(TH,(L.speed||1)*bd*spanBeats);
        if(Number.isFinite(routeSpanBeats)&&routeSpanBeats>=0){
          row.routeDepth=(L.speed||1)*bd*routeSpanBeats;
        }
        rows.push(row);
        end=Math.max(end,beat+effectiveSpan);
      }
      previousPattern=name;

      if(L.hard){
        // Continue after the final wall thickness clears, with only a short
        // clearance gap. Do not impose a full-beat pause on single-Part motifs.
        beatCursor+=Math.max(.1,end+(L.patternGapBeats??.42));
      }else{
        beatCursor+=Math.max(4,Math.ceil((end+.5)/4)*4);
      }
    }
    return this.repair(rows.filter(row=>row.t<dur-1).sort((a,b)=>a.t-b.t));
  }
  repair(rows,seed=null){
    return repairRows(rows,this.L,seed);
  }

  // Void deliberately uses a dedicated pattern pool in every stage. A multi-lane
  // Part is guaranteed at least every other motif, preventing endless single-C runs.
  voidPool(){
    return [
      'solo2','solo3','ladder','stair','bat','tripleC','whirl','dwhirl',
      'multiC','stair1','stair2','spin2','spin3','spin4','t321','rain','doubleC'
    ];
  }

  chooseVoid(r){
    const multi=['solo2','solo3','bat','dwhirl','stair1','rain','doubleC'];
    let names=this.voidPool();
    const enteringPostLadder=this.lastVoidPattern==='ladder'||this.lastVoidPattern==='zig';
    const inPostLadder=enteringPostLadder||this.postVoidLadderRemaining>0;
    if(inPostLadder){
      names=names.filter(name=>PatternGenerator.POST_LADDER.includes(name));
    }else if(this.lastVoidMulti===false){
      names=names.filter(name=>multi.includes(name));
    }else if(this.lastVoidMulti===true){
      names=names.filter(name=>!multi.includes(name));
    }
    if(names.length>1&&this.lastVoidPattern)names=names.filter(name=>name!==this.lastVoidPattern);
    if(!names.length)names=this.voidPool();

    const weights={
      solo2:1.0,solo3:.75,ladder:1.3,stair:.9,bat:1.4,tripleC:.65,
      whirl:1.0,dwhirl:1.9,multiC:.9,stair1:1.45,stair2:1.1,
      spin2:.85,spin3:1.0,spin4:1.05,t321:1.0,rain:1.25,doubleC:1.1
    };
    const total=names.reduce((sum,name)=>sum+(weights[name]??1),0);
    let value=r()*total,chosen=names[names.length-1];
    for(const name of names){
      value-=weights[name]??1;
      if(value<=0){chosen=name;break;}
    }
    this.lastVoidPattern=chosen;
    this.lastVoidMulti=multi.includes(chosen);
    if(chosen==='ladder'||chosen==='zig'){
      this.postVoidLadderRemaining=2;
    }else if(enteringPostLadder){
      this.postVoidLadderRemaining=1;
    }else if(this.postVoidLadderRemaining>0){
      this.postVoidLadderRemaining--;
    }
    return chosen;
  }

  // Continuous Void stream. Chunks begin at the exact time returned by the previous
  // chunk; motifs are separated only by the short authored clearance gap.
  generateVoid(from,bars,bd,tg0,t0=from,prev=null){
    const L=this.L,r=this.rng,rows=[];
    if(!(bd>0)||!(bars>0)){this.voidNext=from;return rows;}
    const stop=from+bars*4*bd;
    let tb=from,guard=0;
    while(tb<stop&&guard++<512){
      const ramp=Math.min(1,Math.max(0,(tb-t0)/(L.voidRamp||150)));
      const d=r()<.5?1:-1;
      const name=this.chooseVoid(r);
      let g=r()*6|0;

      // Orient the next motif so its first Part retains at least one opening
      // from the previous motif's final Part. This avoids an abrupt lane jump
      // at a motif seam that row-local repair cannot detect.
      if(this.lastVoidOpenings?.length){
        let best=-1,candidates=[];
        for(let candidate=0;candidate<6;candidate++){
          const first=PatternGenerator.PAT[name](candidate,d,()=>.5)[0]?.[1]??[];
          const score=first.filter(sector=>this.lastVoidOpenings.includes(norm(sector))).length;
          if(score>best){best=score;candidates=[candidate];}
          else if(score===best)candidates.push(candidate);
        }
        if(best>0)g=candidates[r()*candidates.length|0];
      }

      const pat=PatternGenerator.PAT[name](g,d,r);
      const motifId=`${name}@${tb.toFixed(6)}`;
      const defaultSpan=TH/((L.speed||1)*bd);
      const motifDuration=Math.max(...pat.map(([beat,,spanBeats=0])=>
        beat+(spanBeats>0?spanBeats:defaultSpan)
      ));
      let end=0;
      for(const [beat,gaps,spanBeats=0,routeSpanBeats=null] of pat){
        const row={
          t:tb+beat*bd,g:unique(gaps),
          motifId,motifName:name,motifStart:tb,motifEnd:tb+motifDuration*bd
        };
        if(spanBeats>0)row.th=Math.max(TH,(L.speed||1)*bd*spanBeats);
        if(Number.isFinite(routeSpanBeats)&&routeSpanBeats>=0){
          row.routeDepth=(L.speed||1)*bd*routeSpanBeats;
        }
        rows.push(row);
        end=Math.max(end,beat+(spanBeats>0?spanBeats:defaultSpan));
      }
      this.lastVoidOpenings=unique(pat[pat.length-1]?.[1]??[]);
      tb+=(end+(L.voidGapBeats??.32))*bd;
    }
    this.voidNext=tb;
    const repaired=this.repair(rows.sort((a,b)=>a.t-b.t),prev);
    if(repaired.length)this.lastVoidOpenings=[...repaired[repaired.length-1].g];
    return repaired;
  }}
