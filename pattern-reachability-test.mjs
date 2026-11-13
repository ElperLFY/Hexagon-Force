import {LEVELS,SIDE,TAU,TH,RP,PL} from './js/config.js';
import {Chart,PatternGenerator} from './js/PatternGenerator.js';

// Test the actual Chart.collision geometry, including the arrow's side hitbox.
// The player may choose either direction at every frame, but cannot exceed the
// real gameplay turn rate. This is a reachability test, not a pattern-name test.
const DT=1/120;
const ANGLE_BINS=180; // 2 degree resolution
const norm=(x,n)=>((x%n)+n)%n;

function simulate(name,direction,level,repeat=3){
  const L={
    ...level,
    speed:level.speed??1,
    turnRate:level.turnRate??6.4,
    reactionMargin:level.reactionMargin??.04
  };
  const bd=60/(level.bpm??116),speed=L.speed;
  const stepBins=Math.floor((L.turnRate*DT)/(TAU/ANGLE_BINS));
  const rng=()=>.5;
  const events=name==='spin'
    ?PatternGenerator.PAT[name](0,direction,repeat)
    :PatternGenerator.PAT[name](0,direction,rng);
  if(!events.length)throw new Error(`Pattern factory ${name} returned no events`);
  const rows=[];
  let endBeat=0,maxDepth=TH;
  const motifId=`${name}-atomic`;
  for(const [beat,gaps,span=0,routeSpan=null] of events){
    const row={
      t:beat*bd,
      g:[...new Set(gaps.map(x=>norm(x,6)))],
      motifId,motifName:name,motifStart:0
    };
    if(span>0)row.th=Math.max(TH,speed*bd*span);
    if(Number.isFinite(routeSpan)&&routeSpan>=0)row.routeDepth=speed*bd*routeSpan;
    maxDepth=Math.max(maxDepth,row.th??TH);
    rows.push(row);
    endBeat=Math.max(endBeat,beat+span);
  }
  rows.sort((a,b)=>a.t-b.t);
  const chart=new Chart(rows,bd,0,level.bpm??116,30,speed)
    .randomized({...L,randomSectionBeats:4},0x1ADDE+name.length+direction+level.id);
  const endTime=endBeat*bd+maxDepth/speed+.15;
  let reachable=new Uint8Array(ANGLE_BINS).fill(1);
  let firstFailure=null,lastFreeCount=ANGLE_BINS;
  for(let t=-.5+DT;t<=endTime+1e-9;t+=DT){
    const free=new Uint8Array(ANGLE_BINS);
    let freeCount=0;
    for(let i=0;i<ANGLE_BINS;i++){
      const phi=i*TAU/ANGLE_BINS;
      if(!chart.collision(t,phi)?.type){free[i]=1;freeCount++;}
    }
    const next=new Uint8Array(ANGLE_BINS);
    let count=0;
    for(let from=0;from<ANGLE_BINS;from++){
      if(!reachable[from])continue;
      for(let delta=-stepBins;delta<=stepBins;delta++){
        const to=norm(from+delta,ANGLE_BINS);
        if(!free[to])continue;
        let clear=true;
        const stride=Math.sign(delta);
        for(let k=1;k<Math.abs(delta);k++){
          if(!free[norm(from+stride*k,ANGLE_BINS)]){clear=false;break;}
        }
        if(clear&&!next[to]){next[to]=1;count++;}
      }
    }
    reachable=next;
    lastFreeCount=freeCount;
    if(!count){
      firstFailure={time:+t.toFixed(4),freeAngles:freeCount};
      break;
    }
  }
  return {ok:!firstFailure,firstFailure,events:events.length,endBeat:+endBeat.toFixed(2),lastFreeCount};
}

const names=Object.keys(PatternGenerator.PAT);
const failures=[];
for(const level of LEVELS){
  for(const name of names){
    for(const direction of [1,-1]){
      const result=simulate(name,direction,level,3);
      if(!result.ok)failures.push({level:level.id,name,direction,...result});
    }
  }
}
if(failures.length){
  console.error('PATTERN REACHABILITY FAILURES');
  for(const failure of failures)console.error(JSON.stringify(failure));
  process.exitCode=1;
}else{
  console.log(`Pattern reachability OK: ${LEVELS.length} levels × ${names.length} factories × 2 directions; ${ANGLE_BINS} angular bins, 120 Hz simulation.`);
}

// Also exercise chained Void chunks, carrying the exact previous Part and
// generator state across chunk seams. Six seeds × three chunks keeps the same
// total sample volume as twelve isolated chunks, but covers real seam behavior.
for(const level of LEVELS){
  const bd=60/(level.bpm??116);
  const speed=level.speed??1;
  const testLevel={...level,turnRate:level.turnRate??6.4,reactionMargin:level.reactionMargin??.04};
  const stepBins=Math.floor((testLevel.turnRate*DT)/(TAU/ANGLE_BINS));
  for(let seed=1;seed<=6;seed++){
    const generator=new PatternGenerator({...testLevel,seed});
    const rows=[];
    let from=60,previous=null;
    for(let chunk=0;chunk<3;chunk++){
      const chunkRows=generator.generateVoid(from,8,bd,0,60,previous);
      if(!chunkRows.length)throw new Error(`Void produced no rows for level ${level.id}, seed ${seed}, chunk ${chunk}`);
      rows.push(...chunkRows);
      previous=chunkRows[chunkRows.length-1];
      from=generator.voidNext;
    }
    const maxDepth=Math.max(TH,...rows.map(row=>row.th??TH));
    const chart=new Chart(rows,bd,0,level.bpm??116,90,speed);
    const duration=(rows.at(-1).t-rows[0].t)+maxDepth/speed+.2;
    let reachable=new Uint8Array(ANGLE_BINS).fill(1);
    for(let t=rows[0].t-.5+DT;t<=rows[0].t+duration;t+=DT){
      const free=new Uint8Array(ANGLE_BINS);
      for(let i=0;i<ANGLE_BINS;i++)if(!chart.collision(t,i*TAU/ANGLE_BINS)?.type)free[i]=1;
      const next=new Uint8Array(ANGLE_BINS);
      for(let fromAngle=0;fromAngle<ANGLE_BINS;fromAngle++)if(reachable[fromAngle]){
        for(let delta=-stepBins;delta<=stepBins;delta++){
          const to=norm(fromAngle+delta,ANGLE_BINS);
          if(!free[to])continue;
          let clear=true;
          for(let k=1;k<Math.abs(delta);k++)if(!free[norm(fromAngle+Math.sign(delta)*k,ANGLE_BINS)]){clear=false;break;}
          if(clear)next[to]=1;
        }
      }
      if(!next.some(Boolean)){
        const active=rows.filter(row=>{
          const depth=row.th??TH;
          const enters=row.t-(PL.tip-RP)/speed;
          const leaves=row.t+(depth+RP-PL.back)/speed;
          return t>=enters-1e-6&&t<=leaves+1e-6;
        }).map(row=>({t:+row.t.toFixed(3),g:row.g,th:+(row.th??TH).toFixed(3),motif:row.motifName,motifId:row.motifId,route:row.route}));
        const priorSectors=[...new Set(Array.from({length:ANGLE_BINS},(_,index)=>reachable[index]?Math.floor(index*TAU/ANGLE_BINS/SIDE):null).filter(value=>value!==null))];
        const recent=rows.filter(row=>row.t>=t-2&&row.t<=t+.5).map(row=>({t:+row.t.toFixed(3),g:row.g,th:+(row.th??TH).toFixed(3)}));
        throw new Error(`Void reachability failed: level ${level.id}, seed ${seed}, t=${t.toFixed(3)}s, active=${JSON.stringify(active)}, priorSectors=${JSON.stringify(priorSectors)}, recent=${JSON.stringify(recent)}`);
      }
      reachable=next;
    }
  }
}
console.log('Void reachability OK: 4 levels × 6 seeds × 3 chained chunks.');
