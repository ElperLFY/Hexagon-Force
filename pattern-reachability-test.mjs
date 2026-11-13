import {LEVELS,SIDE,TAU,TH,RP,PL} from './js/config.js';
import {Chart,PatternGenerator} from './js/PatternGenerator.js';

// Test the actual Chart.collision geometry, including the arrow's side hitbox.
// The player may choose either direction at every frame, but cannot exceed the
// real gameplay turn rate. This is a reachability test, not a pattern-name test.
const DT=1/120;
const ANGLE_BINS=180; // 2 degree resolution
const STEP_BINS=Math.floor((8.5*DT)/(TAU/ANGLE_BINS));
const BD=60/116;
const SPEED=1.4;
const LEVEL={speed:SPEED,turnRate:8.5,reactionMargin:.04};
const norm=(x,n)=>((x%n)+n)%n;

function simulate(name,direction,repeat=3){
  const rng=()=>.5;
  const events=name==='spin'
    ?PatternGenerator.PAT[name](0,direction,repeat)
    :PatternGenerator.PAT[name](0,direction,rng);
  if(!events.length)throw new Error(`Pattern factory ${name} returned no events`);
  const rows=[];
  let endBeat=0,maxDepth=TH;
  for(const [beat,gaps,span=0] of events){
    const row={t:beat*BD,g:[...new Set(gaps.map(x=>norm(x,6)))]};
    if(span>0)row.th=Math.max(TH,SPEED*BD*span);
    maxDepth=Math.max(maxDepth,row.th??TH);
    rows.push(row);
    endBeat=Math.max(endBeat,beat+span);
  }
  rows.sort((a,b)=>a.t-b.t);
  const repaired=new PatternGenerator(LEVEL).repair(rows);
  const chart=new Chart(repaired,BD,0,116,30,SPEED);
  const endTime=endBeat*BD+maxDepth/SPEED+.15;
  let reachable=new Uint8Array(ANGLE_BINS).fill(1);
  let firstFailure=null;
  let lastFreeCount=ANGLE_BINS;
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
      for(let delta=-STEP_BINS;delta<=STEP_BINS;delta++){
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
for(const name of names){
  // spin() needs an explicit repetition count; all other factories ignore it.
  for(const direction of [1,-1]){
    const result=simulate(name,direction,name==='spin'?3:3);
    if(!result.ok)failures.push({name,direction,...result});
  }
}
if(failures.length){
  console.error('PATTERN REACHABILITY FAILURES');
  for(const failure of failures)console.error(JSON.stringify(failure));
  process.exitCode=1;
}else{
  console.log(`Pattern reachability OK: ${names.length} factories × 2 directions; ${ANGLE_BINS} angular bins, 120 Hz simulation.`);
}

// Also exercise actual random Void chunks (the phase in which the reported
// failure occurred), across every shipped level and fixed reproducible seeds.
for(const level of LEVELS){
  const bd=60/(level.bpm??116);
  const testLevel={...level,turnRate:8.5,reactionMargin:.04};
  for(let seed=1;seed<=12;seed++){
    const generator=new PatternGenerator({...testLevel,seed});
    const rows=generator.generateVoid(60,8,bd,0,60,null);
    if(!rows.length)throw new Error(`Void produced no rows for level ${level.id}, seed ${seed}`);
    const maxDepth=Math.max(TH,...rows.map(row=>row.th??TH));
    const chart=new Chart(rows,bd,0,level.bpm??116,30,level.speed);
    const duration=(rows.at(-1).t-rows[0].t)+maxDepth/level.speed+.2;
    let reachable=new Uint8Array(ANGLE_BINS).fill(1);
    for(let t=rows[0].t-.5+DT;t<=rows[0].t+duration;t+=DT){
      const free=new Uint8Array(ANGLE_BINS);
      for(let i=0;i<ANGLE_BINS;i++)if(!chart.collision(t,i*TAU/ANGLE_BINS)?.type)free[i]=1;
      const next=new Uint8Array(ANGLE_BINS);
      for(let from=0;from<ANGLE_BINS;from++)if(reachable[from]){
        for(let delta=-STEP_BINS;delta<=STEP_BINS;delta++){
          const to=norm(from+delta,ANGLE_BINS);
          if(!free[to])continue;
          let clear=true;
          for(let k=1;k<Math.abs(delta);k++)if(!free[norm(from+Math.sign(delta)*k,ANGLE_BINS)]){clear=false;break;}
          if(clear)next[to]=1;
        }
      }
      reachable=next;
      if(!reachable.some(Boolean)){
        const active=rows.filter(row=>{
          const depth=row.th??TH;
          const enters=row.t-(PL.tip-RP)/level.speed;
          const leaves=row.t+(depth+RP-PL.back)/level.speed;
          return t>=enters-1e-6&&t<=leaves+1e-6;
        }).map(row=>({t:+row.t.toFixed(3),g:row.g,th:+(row.th??TH).toFixed(3)}));
        throw new Error(`Void reachability failed: level ${level.id}, seed ${seed}, t=${t.toFixed(3)}s, active=${JSON.stringify(active)}`);
      }
    }
  }
}
console.log('Void reachability OK: 4 levels × 12 deterministic seeds.');
