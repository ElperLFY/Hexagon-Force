import fs from 'node:fs';
import {LEVELS,SIDE,TAU,TH,VOID,RP,PL} from './js/config.js';
import {Chart,PatternGenerator} from './js/PatternGenerator.js';

const mask=gaps=>[0,1,2,3,4,5].map(sector=>!gaps.includes(sector));
for(const id of [100,105,110,115]){
  const json=JSON.parse(fs.readFileSync(`./MusicData/${id}.json`,'utf8'));
  const level=LEVELS.find(item=>item.id===id);
  const chart=Chart.fromJSON(json,level).randomized(level,0x123400+id);
  if(!chart.rows.length)throw new Error(`Chart ${id} is empty`);
  if(!chart.rows.every(row=>row.g.length&&row.w.length===6))throw new Error(`Chart ${id} contains invalid rows`);
}
const blocked=new Chart([{t:10,g:[1],w:mask([1])}],.5,0,120,20,1);
const open=new Chart([{t:10,g:[0],w:mask([0])}],.5,0,120,20,1);
if(!blocked.hit(10,SIDE/2)||open.hit(10,SIDE/2))throw new Error('Tip hitbox test failed');
const edgeContact=new Chart([{t:10,g:[0],w:mask([0])}],.5,0,120,20,1);
// At 59 degrees the tip remains inside open sector 0 while the arrow's flank
// grazes wall sector 1 just after the wall crosses the player's radial position.
if(edgeContact.collision(10.01,SIDE-Math.PI/180)?.type!=='side')throw new Error('Side scrape should be non-lethal contact');
if(edgeContact.hit(10.01,SIDE-Math.PI/180))throw new Error('Side scrape must not kill the player');

// Optional Part depth must be shared by the collision geometry.
const thinPart=new Chart([{t:10,g:[1],w:mask([1])}],.5,0,120,20,1);
const deepPart=new Chart([{t:10,g:[1],w:mask([1]),th:.4}],.5,0,120,20,1);
if(thinPart.hit(10.2,SIDE/2))throw new Error('Legacy TH should not reach the player yet');
if(!deepPart.hit(10.2,SIDE/2))throw new Error('Custom Part depth must extend the collision wall');
if(!deepPart.hit(10.35,SIDE/2))throw new Error('Thick Part must remain collidable until its outer edge clears the Pointer');
if(deepPart.collision(10.5,SIDE/2)!==null)throw new Error('A wall hidden behind the player hitbox must not create a phantom collision');
if(deepPart.collision(10.54,SIDE/2)!==null)throw new Error('A wall fully inside the hub must not create a phantom collision');

// Spin family: 2/3/4 variants repeat the same three-position 1-2-3 motif.
for(const [name,repetitions] of [['spin2',2],['spin3',3],['spin4',4]]){
  const events=PatternGenerator.PAT[name](0,1);
  if(events.length!==repetitions*3)throw new Error(`${name} repetition count mismatch`);
  for(let i=0;i<events.length;i++){
    const expected=[0,1,3][i%3];
    if(((events[i][1][0]%6)+6)%6!==expected)throw new Error(`${name} must repeat the 1-2-3 sector sequence`);
  }
}

// Ladder: one composite Part for two continuous opposing rails, then
// eight evenly spaced mirrored rung-pairs. Same-time rails must not be fed
// to reachability repair as two sequential rows.
for(let start=0;start<6;start++)for(const direction of [-1,1]){
  const ladder=PatternGenerator.PAT.ladder(start,direction);
  if(ladder.length!==9)throw new Error('Ladder must contain one composite rail row and eight rungs');
  const rails=ladder[0];
  const railOpenings=rails[1].map(value=>((value%6)+6)%6);
  const railWalls=[0,1,2,3,4,5].filter(sector=>!railOpenings.includes(sector));
  if(rails[0]!==0||railOpenings.length!==4||rails[2]!==6.22||rails[3]!==0)throw new Error('Ladder rail Part must be one continuous opposing pair');
  if(railWalls.length!==2||((railWalls[0]-railWalls[1]+6)%6)!==3)throw new Error('Ladder rails must occupy opposite sectors');
  if(ladder.slice(1).some((event,index)=>event[1].length!==4||event[2]!==.22||Math.abs(event[0]-(.75+index*.75))>1e-9))throw new Error('Ladder rungs must preserve the two rail sectors and use identical spacing and thickness');
  for(let i=1;i<ladder.length;i++){
    const openings=ladder[i][1].map(value=>((value%6)+6)%6);
    if(openings.length!==4||!railWalls.every(sector=>openings.includes(sector)))throw new Error('Each Ladder rung must leave both persistent rail sectors open in its own row');
    const combinedOpen=railOpenings.filter(sector=>openings.includes(sector) &&
      !railWalls.includes(sector));
    const rungOpen=railOpenings.length===4
      ?ladder[0][1].map(value=>((value%6)+6)%6).filter(sector=>openings.includes(sector)&&
        !railWalls.includes(sector))
      :[];
    const sharedOpen=ladder[0][1].map(value=>((value%6)+6)%6)
      .filter(sector=>openings.includes(sector)&&!railWalls.includes(sector));
    if(sharedOpen.length!==2||((sharedOpen[0]-sharedOpen[1]+6)%6)!==3)throw new Error('The overlapping rail and rung rows must retain two opposite playable openings');
  }
  const ladderRows=ladder.map(([beat,gaps,span,routeSpan])=>({
    t:beat*.5,g:[...new Set(gaps.map(value=>((value%6)+6)%6))],
    w:mask(gaps),...(span>0?{th:span*.5}:{}),
    ...(routeSpan!=null?{routeDepth:routeSpan*.5}:{})
  }));
  if(ladderRows[0].routeDepth!==0)throw new Error('Persistent Ladder rails must not consume the rung-to-rung route-change window');
}
// A multi-beat Ladder is one atomic pattern. Random-section boundaries
// must not re-mirror its later Parts independently (RGB's section is only 4 beats).
const ladderEvents=PatternGenerator.PAT.ladder(0,1);
const ladderDuration=6.22*(60/140);
const ladderChart=new Chart(ladderEvents.map(([beat,gaps,span,routeSpan])=>({
  t:beat*(60/140),g:[...new Set(gaps.map(value=>((value%6)+6)%6))],
  w:mask(gaps),motifId:'ladder-atomic-test',motifName:'ladder',
  motifStart:0,motifEnd:ladderDuration,
  ...(span>0?{th:1.3*span*(60/140)}:{}),
  ...(routeSpan!=null?{routeDepth:routeSpan*(60/140)}:{})
})),60/140,0,140,30,1.3);
const ladderRandomized=ladderChart.randomized({...LEVELS.find(level=>level.id===115),offset:0,randomSectionBeats:4},0xB1A1);
const transformedRows=ladderRandomized.rows;
const matchesSingleTransform=[...Array(6).keys()].some(offset=>
  [false,true].some(mirror=>ladderEvents.every(([beat,gaps],index)=>{
    const expected=gaps.map(value=>((mirror?-value:value)+offset+600)%6).sort((a,b)=>a-b);
    const actual=transformedRows[index].g.slice().sort((a,b)=>a-b);
    return expected.length===actual.length&&expected.every((value,i)=>value===actual[i]);
  }))
);
if(!matchesSingleTransform)throw new Error('Ladder Parts were not kept under one atomic mirror/rotation transform');
const transformedRailWalls=[0,1,2,3,4,5].filter(sector=>!transformedRows[0].g.includes(sector));
if(transformedRailWalls.length!==2||((transformedRailWalls[0]-transformedRailWalls[1]+6)%6)!==3)throw new Error('Atomic randomization must preserve two continuous opposing rails');
for(const row of transformedRows.slice(1)){
  if(!transformedRailWalls.every(sector=>row.g.includes(sector)))throw new Error('A Ladder rung row must leave both long rail sectors open so the rails remain continuous');
  const rungWalls=[0,1,2,3,4,5].filter(sector=>!row.g.includes(sector));
  if(rungWalls.length!==2)throw new Error('Each Ladder rung must draw exactly one mirrored wall pair');
  if(transformedRailWalls.some(sector=>rungWalls.includes(sector)))throw new Error('A rung must not interrupt either persistent rail');
}
const expectedRailDepth=1.3*(60/140)*6.22;
if(Math.abs(transformedRows[0].th-expectedRailDepth)>1e-8)throw new Error('Ladder rail wall must keep its complete multi-beat radial depth');

// A Ladder must transition into an authored multi-opening exit preset, never
// straight into a single-opening C-shaped family such as Stair/Whirlpool.
const transitionProbe=new PatternGenerator({...LEVELS.find(level=>level.id===110),seed:0xA771});
transitionProbe.pool=()=>['ladder','solo','stair','solo2','dwhirl'];
const receivedPools=[];
let transitionPick=0;
const forcedTransitionNames=['ladder','solo2','dwhirl','solo'];
transitionProbe.choose=(names)=>{
  receivedPools.push([...names]);
  return forcedTransitionNames[Math.min(transitionPick++,forcedTransitionNames.length-1)];
};
const transitionRows=transitionProbe.generate(()=>1,60/140,0,35);
if(receivedPools.length<4)throw new Error('Pattern generator did not schedule two post-Ladder exit patterns');
for(const pool of receivedPools.slice(1,3)){
  if(pool.some(name=>!PatternGenerator.POST_LADDER.includes(name)))throw new Error('Post-Ladder selector included a pattern outside the safe exit preset');
  if(pool.includes('solo')||pool.includes('stair')||pool.includes('whirl')||pool.includes('rain'))throw new Error('A single-opening C or capped Rain pattern may not occur in the two-pattern Ladder exit preset');
}
if(!receivedPools[3].includes('solo')||!receivedPools[3].includes('stair'))throw new Error('Normal pattern pool should resume after the two-pattern exit preset');
const ladderStart=transitionRows.find(row=>row.motifName==='ladder')?.motifStart;
const ladderEnd=transitionRows.find(row=>row.motifName==='ladder')?.motifEnd;
const exitStart=transitionRows.find(row=>row.motifName==='solo2')?.motifStart;
if(!(Number.isFinite(ladderStart)&&Number.isFinite(ladderEnd)&&exitStart>=ladderEnd))throw new Error('Post-Ladder exit overlaps the Ladder phrase');

// Motif grouping metadata must survive export/import so later randomization
// cannot split a phrase at a section boundary.
const roundTrip=Chart.fromJSON(ladderChart.toJSON(),LEVELS.find(level=>level.id===115));
if(roundTrip.rows.some(row=>row.motifId!=='ladder-atomic-test'||row.motifName!=='ladder'))throw new Error('Atomic pattern metadata did not survive chart serialization');

// Time-expanded reachability audit. Treat every wall as active for the exact
// interval during which its radial span crosses the pointer radius. The pointer
// can rotate at the game's real maximum turn rate; an 8.5-degree body clearance
// is reserved beside every blocked sector. This catches patterns that have
// individually valid rows but no continuous path through their combined walls.
function hasPlayablePath(rows,speed,turnRate=8.5,dt=1/60){
  const bins=720,margin=8.5*Math.PI/180,offset=PL.tip-RP;
  const depth=row=>row.th??TH;
  const start=Math.min(...rows.map(row=>row.t-offset/speed))-dt;
  const end=Math.max(...rows.map(row=>row.t+(depth(row)-offset)/speed))+dt;
  const steps=Math.floor(turnRate*dt*bins/TAU+1e-9);
  const sectors=new Uint8Array(bins),local=new Float64Array(bins);
  for(let i=0;i<bins;i++){
    const angle=i*TAU/bins;
    sectors[i]=Math.floor(angle/SIDE);
    local[i]=angle-sectors[i]*SIDE;
  }
  let reachable=new Uint8Array(bins).fill(1);
  const expanded=new Uint8Array(bins),next=new Uint8Array(bins);
  const prefix=new Int32Array(bins+1);
  for(let time=start;time<=end+dt*.25;time+=dt){
    const blocked=new Uint8Array(6);
    for(const row of rows){
      const d=depth(row);
      const enters=row.t-offset/speed,leaves=row.t+(d-offset)/speed;
      if(time<enters-1e-9||time>leaves+1e-9)continue;
      for(let sector=0;sector<6;sector++)if(!row.g.includes(sector))blocked[sector]=1;
    }
    prefix[0]=0;
    for(let i=0;i<bins;i++)prefix[i+1]=prefix[i]+reachable[i];
    let any=false;
    for(let i=0;i<bins;i++){
      const lo=i-steps,hi=i+steps;
      let count;
      if(lo<0)count=prefix[hi+1]+prefix[bins]-prefix[bins+lo];
      else if(hi>=bins)count=prefix[bins]-prefix[lo]+prefix[hi-bins+1];
      else count=prefix[hi+1]-prefix[lo];
      const sector=sectors[i],left=blocked[(sector+5)%6],right=blocked[(sector+1)%6];
      const safe=!blocked[sector]&&!(left&&local[i]<margin)&&!(right&&SIDE-local[i]<margin);
      next[i]=safe&&count>0?1:0;
      if(next[i])any=true;
    }
    if(!any){
      const closed=Array.from(blocked).map((value,index)=>value?index:null).filter(value=>value!==null);
      return {ok:false,time,closed};
    }
    reachable.set(next);
  }
  return {ok:true};
}

// The full Ladder + two-motif exit + first normal C transition must remain
// continuously traversable as a single time-expanded sequence.
const ladderExitAudit=hasPlayablePath(transitionRows,LEVELS.find(level=>level.id===110).speed);
if(!ladderExitAudit.ok)throw new Error(`Ladder exit preset is unplayable at t=${ladderExitAudit.time.toFixed(3)}s`);

// Review every pattern in every stage, in both movement directions, after the
// same deterministic orientation/randomization and reachability repair used in runs.
for(const id of [100,105,110,115]){
  const level=LEVELS.find(item=>item.id===id);
  for(const name of Object.keys(PatternGenerator.PAT)){
    for(const direction of [-1,1]){
      const events=PatternGenerator.PAT[name](0,direction,()=>.37);
      const rows=events.map(([beat,gaps,span=0])=>({
        t:beat*(60/level.bpm),
        g:[...new Set(gaps.map(value=>((value%6)+6)%6))],
        w:mask(gaps),
        ...(span>0?{th:Math.max(TH,level.speed*level.beatDur*span)}:{})
      }));
      const chart=new Chart(rows,60/level.bpm,0,level.bpm,60,level.speed)
        .randomized({...level,offset:0},0x51A7+id+direction);
      const result=hasPlayablePath(chart.rows,level.speed);
      if(!result.ok)throw new Error(
        `Unplayable pattern ${name} in stage ${id}, direction ${direction}, t=${result.time.toFixed(3)}, blocked=${result.closed.join(',')}`
      );
    }
  }
}

// Audit actual Void sequences too, including pattern-to-pattern transitions.
for(const id of [100,105,110,115]){
  const level=LEVELS.find(item=>item.id===id);
  for(const seed of [0xA11CE,0xBADC0DE]){
    const generator=new PatternGenerator({...level,seed});
    const rows=generator.generateVoid(0,32,60/level.bpm,0,0,null);
    const result=hasPlayablePath(rows,level.speed,8.5,.05);
    if(!result.ok)throw new Error(
      `Unplayable generated Void sequence in stage ${id}, seed ${seed}, t=${result.time.toFixed(3)}, blocked=${result.closed.join(',')}`
    );
  }
}

// Blu/RGB must continue generating through zero-intensity music bars.
for(const id of [110,115]){
  const level=LEVELS.find(item=>item.id===id);
  const continuous=new PatternGenerator({...level,seed:1200+id}).generate(()=>0,.5,0,100);
  if(continuous.length<20)throw new Error(`Stage ${id} leaves silent pattern gaps on quiet audio`);
  const maxGap=Math.max(...continuous.slice(1).map((row,index)=>row.t-continuous[index].t));
  if(maxGap>1.05)throw new Error(`Stage ${id} generator leaves a ${maxGap.toFixed(2)}s interruption on quiet audio`);
}

// The Void chooser alternates multi-lane motifs with other families, so it
// cannot degenerate into an indefinitely repeated single-opening C sequence.
for(const id of [100,105,110,115]){
  const level=LEVELS.find(item=>item.id===id);
  const generator=new PatternGenerator({...level,seed:0xD00D+id});
  let seed=0xA55A+id;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const choices=Array.from({length:18},()=>generator.chooseVoid(random));
  const multi=name=>['solo2','solo3','bat','dwhirl','stair1','rain','doubleC'].includes(name);
  let previousPattern=null,previousMulti=null,exitRemaining=0;
  for(const name of choices){
    const forcedExit=previousPattern==='ladder'||previousPattern==='zig'||exitRemaining>0;
    if(forcedExit){
      if(!PatternGenerator.POST_LADDER.includes(name))throw new Error(`Void post-Ladder preset failed in stage ${id}`);
      if(previousPattern==='ladder'||previousPattern==='zig')exitRemaining=1;
      else exitRemaining=Math.max(0,exitRemaining-1);
    }else if(previousMulti!==null&&multi(name)===previousMulti){
      throw new Error(`Void pattern variety failed in stage ${id}`);
    }
    if(name==='ladder'||name==='zig')exitRemaining=2;
    previousPattern=name;
    previousMulti=multi(name);
  }
  if(new Set(choices).size<6)throw new Error(`Void pool lacks diversity in stage ${id}`);
}

const g=new PatternGenerator({...LEVELS[3],seed:90210,speed:1.7,turnRate:7.4});
const voidRows=[];
let chunkStart=60.1,previousVoidRow=null;
for(let chunk=0;chunk<3;chunk++){
  const chunkRows=g.generateVoid(chunkStart,8,60/116,0,60.1,previousVoidRow);
  if(!chunkRows.length)throw new Error('Void generation returned an empty chunk');
  if(previousVoidRow){
    const previousClear=previousVoidRow.t+(previousVoidRow.th??TH)/1.7;
    const seamGap=chunkRows[0].t-previousClear;
    if(seamGap<-.01||seamGap>.55*(60/116))throw new Error(`Void chunk seam contains an interruption (${seamGap.toFixed(3)}s)`);
  }
  voidRows.push(...chunkRows);
  previousVoidRow=chunkRows[chunkRows.length-1];
  chunkStart=g.voidNext;
}
if(voidRows.length<80||!voidRows.every((row,index)=>index===0||row.t>=voidRows[index-1].t))throw new Error('Void generation test failed');
if(voidRows[0].g.length<2)throw new Error('Hypermode must not start with a single-opening C Part');

// Endless run: authored rows are cut at the void start, generation continues for minutes, stays sorted,
// stays bounded in memory and every row (chunk seams included) is reachable from the previous one.
for(const id of [100,105,110,115]){
  const level=LEVELS.find(item=>item.id===id);
  const json=JSON.parse(fs.readFileSync(`./MusicData/${id}.json`,'utf8'));
  const run=Chart.fromJSON(json,level).randomized(level,4242+id).endless(level,4242+id,level.offset+VOID.start);
  if(!(run.voidStart>=level.offset+VOID.start&&run.voidStart<level.offset+VOID.start+run.beatDur+1e-6))throw new Error(`Void start of ${id} is not snapped to the beat after ${VOID.start}s`);
  if(run.voidSide!==1&&run.voidSide!==-1)throw new Error('Void side must be -1 or 1');
  if(run.dur!==Infinity)throw new Error('Endless chart must never finish');
  const all=[];let kept=0;
  for(let t=level.offset;t<level.offset+600;t+=.5){ // 10 minutes of play, one frame every half second
    run.ensure(t);
    if(run.rows.length>1200)throw new Error(`Chart ${id} grows without bound`);
    for(const row of run.rows)if(!all.some(r=>r.t===row.t))all.push(row);
  }
  all.sort((a,b)=>a.t-b.t);
  const speed=level.speed||1,stepTime=SIDE/(level.turnRate??6.4),reaction=level.reactionMargin??.04;
  const dist=(a,b)=>{const m=((a-b)%6+6)%6;return Math.min(m,6-m)};
  all.forEach((row,i)=>{
    if(row.t<run.voidStart)kept++;
    if(!row.g.length||row.w.length!==6)throw new Error(`Chart ${id}: invalid void row at ${row.t}`);
    if(i===0)return;
    const prev=all[i-1],steps=Math.min(3,Math.max(0,Math.floor(Math.max(0,row.t-prev.t-TH/speed-reaction)/stepTime)));
    if(Math.min(...prev.g.flatMap(a=>row.g.map(b=>dist(a,b))))>steps)throw new Error(
      `Chart ${id}: row at ${row.t.toFixed(2)}s is unreachable; prev=${JSON.stringify({t:prev.t,g:prev.g,route:prev.route,routeDepth:prev.routeDepth,th:prev.th})}; row=${JSON.stringify({t:row.t,g:row.g,route:row.route,routeDepth:row.routeDepth,th:row.th})}; dt=${(row.t-prev.t).toFixed(3)}; steps=${steps}`
    );
  });
  if(!kept)throw new Error(`Chart ${id}: authored rows before the void are gone`);
  if(all.every(r=>r.t<run.voidStart+60))throw new Error(`Chart ${id}: void generated nothing`);
  // ModMenu map speed only changes how fast a wall travels, never when it reaches the arrow: the hit timing stays on the beat.
  const probe=new Chart([{t:10,g:[1],w:mask([1])}],.5,0,120,20,1);
  if(!probe.hit(10,SIDE/2,1)||!probe.hit(10,SIDE/2,2.5))throw new Error('Map speed must not change the wall-at-tip timing');
}
console.log('HEXBEAT VOID smoke test: OK');
