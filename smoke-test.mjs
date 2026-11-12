import fs from 'node:fs';
import {LEVELS,SIDE} from './js/config.js';
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
const g=new PatternGenerator({...LEVELS[3],seed:90210,speed:1.7,turnRate:7.4});
const voidRows=g.generateVoid(60.1,48,60/116,0);
if(voidRows.length<80||!voidRows.every((row,index)=>index===0||row.t>=voidRows[index-1].t))throw new Error('Void generation test failed');
console.log('HEXBEAT VOID smoke test: OK');
