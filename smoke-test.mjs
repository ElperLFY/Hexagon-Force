import fs from 'node:fs';
import {LEVELS,SIDE,TH,VOID} from './js/config.js';
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
if(edgeContact.collision(10.01,SIDE-Math.PI/180)!=='side')throw new Error('Side scrape should be non-lethal contact');
if(edgeContact.hit(10.01,SIDE-Math.PI/180))throw new Error('Side scrape must not kill the player');
const g=new PatternGenerator({...LEVELS[3],seed:90210,speed:1.7,turnRate:7.4});
const voidRows=g.generateVoid(60.1,48,60/116,0);
if(voidRows.length<80||!voidRows.every((row,index)=>index===0||row.t>=voidRows[index-1].t))throw new Error('Void generation test failed');

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
    if(Math.min(...prev.g.flatMap(a=>row.g.map(b=>dist(a,b))))>steps)throw new Error(`Chart ${id}: row at ${row.t.toFixed(2)}s is unreachable`);
  });
  if(!kept)throw new Error(`Chart ${id}: authored rows before the void are gone`);
  if(all.every(r=>r.t<run.voidStart+60))throw new Error(`Chart ${id}: void generated nothing`);
  // ModMenu map speed only changes how fast a wall travels, never when it reaches the arrow: the hit timing stays on the beat.
  const probe=new Chart([{t:10,g:[1],w:mask([1])}],.5,0,120,20,1);
  if(!probe.hit(10,SIDE/2,1)||!probe.hit(10,SIDE/2,2.5))throw new Error('Map speed must not change the wall-at-tip timing');
}
console.log('HEXBEAT VOID smoke test: OK');
