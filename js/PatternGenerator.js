import {TAU,SIDE,K,TH,PART_DEPTH_SCALE,RP,HUB,PL,VOID} from './config.js';

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
  const baseThickness=L.wallThickness??TH;

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
          const previousDepth=previous.routeDepth??previous.th??baseThickness;
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
      const previousDepth=previous.routeDepth??previous.th??baseThickness;
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
  constructor(rows=[],beatDur=.5,tg0=0,bpm=0,dur=0,speed=1,wallThickness=TH){
    Object.assign(this,{rows,beatDur,tg0,bpm,dur,speed,wallThickness});
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
    const maxDepth=this.rows.reduce((max,row)=>Math.max(max,row.th??this.wallThickness),this.wallThickness);
    const window=(maxDepth+Math.abs(PL.tip-RP)+.08)/speed+.06;
    let sideContact=null;

    for(const row of this.rows){
      const dt=row.t-t;
      if(dt < -window)continue;
      if(dt > window)break;
      const inner=RP+dt*speed;
      const depth=row.th??this.wallThickness;
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
    return new Chart(repaired,this.beatDur,this.tg0,this.bpm,this.dur,L.speed,L.wallThickness??this.wallThickness);
  }

  // Endless "void" phase. From `start` (snapped to the next beat, so the flip lands on the music)
  // the authored rows are dropped and replaced by generated ones, produced lazily by ensure().
  endless(L,seed,start){
    const bd=this.beatDur;
    this.stageEnd=null; // Stage completion is a milestone; Endless remains active until death
    this.voidStart=this.tg0+Math.ceil((start-this.tg0)/bd-1e-6)*bd;
    this.rows=this.rows.filter(r=>r.t<this.voidStart);
    this.voidSide=mul(seed>>>0)()<.5?-1:1; // which side of the screen the darkness comes from
    this.gen=new PatternGenerator({...L,seed});
    this.voidNext=this.voidStart;
    this.voidPrev=this.rows[this.rows.length-1]||null;
    this.dur=Infinity; // Endless has no terminal duration
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
    const{beatDur,tg0,bpm,dur,speed,wallThickness}=this;
    return{
      v:1,beatDur,tg0,bpm,dur,speed,wallThickness,
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
    return new Chart(rows,j.beatDur,j.tg0,j.bpm,j.dur,L.speed,L.wallThickness??j.wallThickness??TH);
  }
}
Chart.EMPTY=new Chart();

// Pattern catalog inspired by the named movement families documented for
// Super Hexagon. Each entry is [beatOffset, openSectors].
export class PatternGenerator{
  static catalog=null;
  static definitions=null;
  static loading=null;
  static PAT={};
  static POST_LADDER=Object.freeze([]);
  static POST_LADDER_FINAL=Object.freeze([]);
  static POST_BAT=Object.freeze([]);

  // Load the human-editable pattern catalog once. The runtime only compiles
  // beat/sector data into the existing factory interface used by the game.
  static async loadCatalog(){
    if(this.catalog)return this.catalog;
    if(this.loading)return this.loading;
    this.loading=(async()=>{
      const base=new URL('./SubData/PatternGenerator/',import.meta.url);
      const readText=async url=>{
        // The browser reads the same files over HTTP; Node-based tests read them
        // from disk so the catalog remains testable without a local web server.
        if(typeof process==='object'&&process.versions?.node){
          const {readFile}=await import('node:fs/promises');
          return readFile(url,'utf8');
        }
        const response=await fetch(url);
        if(!response.ok)throw new Error('Pattern JSON could not be loaded: '+response.status);
        return response.text();
      };
      const catalog=JSON.parse(await readText(new URL('catalog.json',base)));
      if(catalog.schemaVersion!==1||!Array.isArray(catalog.patterns)||!catalog.definitionFiles){
        throw new Error('Pattern catalog has an unsupported or incomplete schema');
      }

      const entries=await Promise.all(catalog.patterns.map(async id=>{
        const file=catalog.definitionFiles[id];
        if(typeof file!=='string')throw new Error('Missing JSON file mapping for pattern: '+id);
        const definition=JSON.parse(await readText(new URL(file,base)));
        if(definition.id!==id)throw new Error('Pattern id mismatch in '+file);
        if(!definition.aliasOf&&!Array.isArray(definition.parts))throw new Error('Pattern has no Parts: '+id);
        return [id,definition];
      }));
      const definitions=Object.fromEntries(entries);
      const compiled={};
      const normSector=value=>((value%6)+6)%6;
      const randomInt=(random,min,max)=>min+Math.floor(random()*(max-min+1));

      const compile=id=>{
        if(compiled[id])return compiled[id];
        const definition=definitions[id];
        if(!definition)throw new Error('Unknown pattern definition: '+id);
        if(definition.aliasOf){
          const target=compile(definition.aliasOf);
          const factory=(g=0,d=1,r=()=>.5)=>target(g,d,r,definition.repeatCount);
          compiled[id]=factory;
          return factory;
        }

        const directionMode=definition.directionMode??'fixed';
        const direction=value=>value<0?-1:1;
        const randomOffset=(part,random)=>{
          if(!Array.isArray(part.randomSectorOffset))return 0;
          const [min,max]=part.randomSectorOffset;
          return randomInt(random,min,max);
        };
        const openOffsets=(part,d)=>{
          if(part.openOffsetsByDirection){
            return part.openOffsetsByDirection[d<0?'counterClockwise':'clockwise'];
          }
          return part.openOffsets??[];
        };
        const makeEvent=(part,g,d,random,beat=part.beat)=>{
          const sign=direction(d);
          const multiplier=directionMode==='relative'?sign:1;
          const shift=randomOffset(part,random);
          const offsets=openOffsets(part,d);
          const gaps=offsets.map(offset=>normSector(normSector(g)+offset*multiplier+shift));
          const event=[beat,gaps];
          if(part.wallSpanBeats!=null||part.routeSpanBeats!=null){
            event.push(part.wallSpanBeats??0);
          }
          if(part.routeSpanBeats!=null)event.push(part.routeSpanBeats);
          return event;
        };

        if(definition.repeatTemplate){
          const factory=(g=0,d=1,random=()=>.5,repeatOverride=1)=>{
            let repeats=repeatOverride;
            if(typeof random==='number'){repeats=random;random=()=>.5;}
            repeats=Math.max(1,Math.min(12,Math.floor(Number(repeats)||1)));
            const cycleBeats=definition.repeatTemplate.cycleBeats;
            const events=[];
            for(let cycle=0;cycle<repeats;cycle++){
              for(const part of definition.parts){
                events.push(makeEvent(part,g,d,random,part.beat+cycle*cycleBeats));
              }
            }
            return events;
          };
          compiled[id]=factory;
          return factory;
        }

        const factory=(g=0,d=1,random=()=>.5)=>{
          return definition.parts.map(part=>makeEvent(part,g,d,random));
        };
        compiled[id]=factory;
        return factory;
      };

      for(const id of catalog.patterns)compile(id);
      this.definitions=definitions;
      this.PAT=Object.freeze(compiled);
      this.POST_LADDER=Object.freeze([...catalog.transitions.afterLadder.allowed]);
      this.POST_LADDER_FINAL=Object.freeze([...catalog.transitions.afterLadder.finalAllowed]);
      this.POST_BAT=Object.freeze([...catalog.transitions.afterBat.allowed]);
      this.catalog=catalog;
      return catalog;
    })();
    try{return await this.loading;}
    catch(error){this.loading=null;throw error;}
  }

  constructor(L){this.L=L;this.rng=mul(L.seed);this.lastVoidPattern=null;this.lastVoidMulti=false;this.lastVoidOpenings=null;this.postVoidLadderRemaining=0;this.postVoidBatRemaining=0;this.recentPatterns=[];}

  pool(x){
    const L=this.L,catalog=PatternGenerator.catalog;
    if(!catalog)throw new Error('PatternGenerator.loadCatalog() must finish before generating patterns');
    const band=catalog.poolBands.find(item=>x<item.maxX)??catalog.poolBands[catalog.poolBands.length-1];
    const names=[...band.patterns];
    if(L.hard){
      for(const rule of catalog.hardAdditions){
        if(x>=rule.minX)names.push(...rule.patterns);
      }
    }
    const extraMinX=L.extraMinX??(L.hard?.5:1.1);
    if(x>=extraMinX&&Array.isArray(L.extra))names.push(...L.extra);
    return [...new Set(names)].filter(name=>typeof PatternGenerator.PAT[name]==='function');
  }

  choose(names,r,feel=null){
    const levelWeights=this.L.patternWeights||{};
    const definitions=PatternGenerator.definitions??{};
    const recent=this.recentPatterns.slice(-2);
    const fresh=names.filter(name=>!recent.includes(name));
    const candidates=fresh.length?fresh:names;
    const multiLane=['solo2','solo3','alt3','bat','dwhirl','ladder','rain','doubleC','pairs'];
    const rhythmic=['whirl','dwhirl','spin2','spin3','spin4','multiC','t321','zig'];
    const dense=['ladder','burst','rain','stair1','stair2','wall'];
    const weight=name=>{
      let value=Math.max(.1,Number(levelWeights[name]??definitions[name]?.weight??1));
      if(feel){
        if(feel.syncopation>.28&&rhythmic.includes(name))value*=1.45;
        if(feel.density>.52&&multiLane.includes(name))value*=1.25;
        if(feel.variation>.18&&(rhythmic.includes(name)||multiLane.includes(name)))value*=1.2;
        if(feel.peak>.78&&dense.includes(name))value*=1.28;
        if(feel.density<.24&&['solo','stair','spin'].includes(name))value*=1.12;
      }
      return value;
    };
    const total=candidates.reduce((sum,name)=>sum+weight(name),0);
    let value=r()*total,chosen=candidates[candidates.length-1];
    for(const name of candidates){value-=weight(name);if(value<=0){chosen=name;break;}}
    this.recentPatterns.push(chosen);
    if(this.recentPatterns.length>4)this.recentPatterns.shift();
    return chosen;
  }

  poolAfter(_names,preset=PatternGenerator.POST_LADDER){
    // Exit motifs are injected even when the stage's regular difficulty pool
    // would not normally contain them.
    return preset.filter(name=>typeof PatternGenerator.PAT[name]==='function');
  }

  generate(S,bd,tg0,dur){
    const L=this.L,r=this.rng,rows=[],t0=L.offset;
    if(!(bd>0)||!(dur>0))return rows;
    const quiet=L.intensityThreshold??(L.hard ? .065 : .1);
    let beatCursor=Math.max(0,Math.ceil((t0+2-tg0)/(4*bd)-1e-6)*4);
    let previousPattern=null;
    let postLadderRemaining=0;
    let postBatRemaining=0;
    for(;;){
      const b0=beatCursor;
      if(tg0+b0*bd+4*bd>dur-1.5)break;

      const samples=Array.from({length:8},(_,index)=>
        Math.max(0,Math.min(1,Number(S(b0+index/2))||0))
      );
      const intensity=samples.reduce((sum,value)=>sum+value,0)/samples.length;
      const peak=Math.max(...samples);
      const mean=intensity;
      const variance=samples.reduce((sum,value)=>sum+(value-mean)**2,0)/samples.length;
      const variation=Math.sqrt(variance);
      const onBeat=samples[0]+samples[2]+samples[4]+samples[6];
      const offBeat=samples[1]+samples[3]+samples[5]+samples[7];
      const syncopation=offBeat/(onBeat+offBeat+1e-6);
      const density=samples.filter(value=>value>Math.max(.12,peak*.58)).length/samples.length;
      const peakIndex=samples.indexOf(peak);
      const feel={intensity,peak,variation,syncopation,density,peakIndex};

      // Authored legacy charts can still skip silence; Path levels marked
      // continuousPatterns keep generating, but use quiet beats to choose simpler motifs.
      if(intensity<quiet&&!L.hard&&!L.continuousPatterns){
        beatCursor+=4;
        continue;
      }

      const ramp=Math.min(1,Math.max(0,(tg0+b0*bd-t0)/(L.ramp||90)));
      const noise=(r()-.5)*(L.hard ? .14 : .18);
      const rawX=intensity*.23+peak*.10+variation*.2+syncopation*.15+density*.1+ramp*.22+(L.diff||0)+(L.hard ? .08 : 0)+noise;
      const x=Math.max(0,Math.min(1,L.hard?Math.max(.5,rawX):rawX));
      // Strong off-beat accents move the motif start by an eighth-note pair;
      // the wall events themselves remain locked to the detected beat grid.
      const swingShift=syncopation>.57||(peakIndex%2===1&&peak>.48)?0.5:0;
      const patternBeat=b0+swingShift;
      const tb=tg0+patternBeat*bd;
      const g=r()*6|0,d=r()<.5?1:-1;
      const names=this.pool(x);
      const enteringPostLadder=previousPattern==='ladder'||previousPattern==='zig';
      const inPostLadder=enteringPostLadder||postLadderRemaining>0;
      const enteringPostBat=previousPattern==='bat'||previousPattern==='pairs';
      const inPostBat=enteringPostBat||postBatRemaining>0;
      const ladderExitPreset=postLadderRemaining===1
        ?PatternGenerator.POST_LADDER_FINAL:PatternGenerator.POST_LADDER;
      const candidates=inPostLadder
        ?this.poolAfter(names,ladderExitPreset)
        :inPostBat
          ?this.poolAfter(names,PatternGenerator.POST_BAT)
          :names;
      const name=this.choose(candidates,r,feel);
      const pat=PatternGenerator.PAT[name](g,d,r);
      if(name==='ladder'||name==='zig'){
        postLadderRemaining=4;
      }else if(enteringPostLadder){
        postLadderRemaining=3;
      }else if(postLadderRemaining>0){
        postLadderRemaining--;
      }
      if(name==='bat'||name==='pairs'){
        postBatRemaining=2;
      }else if(enteringPostBat){
        postBatRemaining=1;
      }else if(postBatRemaining>0){
        postBatRemaining--;
      }
      const motifId=`${name}@${tb.toFixed(6)}`;
      const baseThickness=L.wallThickness??TH;
      const defaultSpan=baseThickness/((L.speed||1)*bd);
      const partSpan=(spanBeats,routeSpanBeats=null)=>spanBeats>0
        ?spanBeats*(routeSpanBeats===0?1:PART_DEPTH_SCALE)
        :defaultSpan;
      const motifDuration=Math.max(...pat.map(([beat,,spanBeats=0,routeSpanBeats=null])=>
        beat+partSpan(spanBeats,routeSpanBeats)
      ));
      let end=0;
      for(const [beat,gaps,spanBeats=0,routeSpanBeats=null] of pat){
        const effectiveSpan=partSpan(spanBeats,routeSpanBeats);
        const row={
          t:tb+beat*bd,g:unique(gaps),
          motifId,motifName:name,motifStart:tb,motifEnd:tb+motifDuration*bd
        };
        if(spanBeats>0)row.th=Math.max(baseThickness,(L.speed||1)*bd*effectiveSpan);
        if(Number.isFinite(routeSpanBeats)&&routeSpanBeats>=0){
          row.routeDepth=(L.speed||1)*bd*routeSpanBeats;
        }
        rows.push(row);
        end=Math.max(end,beat+effectiveSpan);
      }
      previousPattern=name;
      if(L.hard||L.continuousPatterns){
        beatCursor=patternBeat+Math.max(.1,end+(L.patternGapBeats??.62));
      }else{
        beatCursor=patternBeat+Math.max(4,Math.ceil((end+.5)/4)*4);
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
    return [...(PatternGenerator.catalog?.voidPool??[])];
  }

  chooseVoid(r){
    const multi=PatternGenerator.catalog?.voidMultiLanePatterns??[];
    let names=this.voidPool();
    const enteringPostLadder=this.lastVoidPattern==='ladder'||this.lastVoidPattern==='zig';
    const inPostLadder=enteringPostLadder||this.postVoidLadderRemaining>0;
    const enteringPostBat=this.lastVoidPattern==='bat'||this.lastVoidPattern==='pairs';
    const inPostBat=enteringPostBat||this.postVoidBatRemaining>0;
    if(inPostLadder){
      const ladderExitPreset=this.postVoidLadderRemaining===1
        ?PatternGenerator.POST_LADDER_FINAL:PatternGenerator.POST_LADDER;
      names=names.filter(name=>ladderExitPreset.includes(name));
    }else if(inPostBat){
      names=names.filter(name=>PatternGenerator.POST_BAT.includes(name));
    }else if(this.lastVoidMulti===false){
      names=names.filter(name=>multi.includes(name));
    }else if(this.lastVoidMulti===true){
      names=names.filter(name=>!multi.includes(name));
    }
    if(names.length>1&&this.lastVoidPattern)names=names.filter(name=>name!==this.lastVoidPattern);
    if(!names.length)names=this.voidPool();

    const definitions=PatternGenerator.definitions??{};
    const weight=name=>Number(definitions[name]?.voidWeight??1);
    const total=names.reduce((sum,name)=>sum+weight(name),0);
    let value=r()*total,chosen=names[names.length-1];
    for(const name of names){
      value-=weight(name);
      if(value<=0){chosen=name;break;}
    }
    this.lastVoidPattern=chosen;
    this.lastVoidMulti=multi.includes(chosen);
    if(chosen==='ladder'||chosen==='zig'){
      this.postVoidLadderRemaining=4;
    }else if(enteringPostLadder){
      this.postVoidLadderRemaining=3;
    }else if(this.postVoidLadderRemaining>0){
      this.postVoidLadderRemaining--;
    }
    if(chosen==='bat'||chosen==='pairs'){
      this.postVoidBatRemaining=2;
    }else if(enteringPostBat){
      this.postVoidBatRemaining=1;
    }else if(this.postVoidBatRemaining>0){
      this.postVoidBatRemaining--;
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
        const preferred=this.lastVoidOpenings[0];
        let best=-1,candidates=[];
        for(let candidate=0;candidate<6;candidate++){
          const first=PatternGenerator.PAT[name](candidate,d,()=>.5)[0]?.[1]??[];
          const normalized=first.map(norm);
          // Prefer the first opening carried forward from the previous Part.
          // A random tie-break could select a second, visually equivalent gap
          // that the Pointer never reached before the next wall arrived.
          const score=
            (normalized.includes(preferred)?100:0)+
            normalized.filter(sector=>this.lastVoidOpenings.includes(norm(sector))).length;
          if(score>best){best=score;candidates=[candidate];}
          else if(score===best)candidates.push(candidate);
        }
        if(best>0)g=candidates[0];
      }

      const pat=PatternGenerator.PAT[name](g,d,r);
      const motifId=`${name}@${tb.toFixed(6)}`;
      const defaultSpan=(L.wallThickness??TH)/((L.speed||1)*bd);
      const partSpan=(spanBeats,routeSpanBeats=null)=>spanBeats>0
        ?spanBeats*(routeSpanBeats===0?1:PART_DEPTH_SCALE)
        :defaultSpan;
      const motifDuration=Math.max(...pat.map(([beat,,spanBeats=0,routeSpanBeats=null])=>
        beat+partSpan(spanBeats,routeSpanBeats)
      ));
      let end=0;
      for(const [beat,gaps,spanBeats=0,routeSpanBeats=null] of pat){
        const effectiveSpan=partSpan(spanBeats,routeSpanBeats);
        const row={
          t:tb+beat*bd,g:unique(gaps),
          motifId,motifName:name,motifStart:tb,motifEnd:tb+motifDuration*bd
        };
        if(spanBeats>0)row.th=Math.max(L.wallThickness??TH,(L.speed||1)*bd*effectiveSpan);
        if(Number.isFinite(routeSpanBeats)&&routeSpanBeats>=0){
          row.routeDepth=(L.speed||1)*bd*routeSpanBeats;
        }
        rows.push(row);
        end=Math.max(end,beat+effectiveSpan);
      }
      this.lastVoidOpenings=unique(pat[pat.length-1]?.[1]??[]);
      tb+=(end+(L.voidGapBeats??.32))*bd;
    }
    this.voidNext=tb;
    const repaired=this.repair(rows.sort((a,b)=>a.t-b.t),prev);
    if(repaired.length)this.lastVoidOpenings=[...repaired[repaired.length-1].g];
    return repaired;
  }}
