import {LEVELS,SONG_DIR,VOID} from './config.js';
import {Chart} from './PatternGenerator.js';
import {BeatAnalyzer} from './BeatAnalyzer.js';
import {AudioManager} from './AudioManager.js';
import {Renderer} from './Renderer.js';
import {Input} from './Input.js';
import {VolumeControl} from './VolumeControl.js';
import {ModMenu} from './ModMenu.js';
// Macchina a stati: gate -> menu -> load -> play -> dead/win. La musica del livello non si ferma mai.
export class Game{
 constructor(cv){
  this.state='gate';this.lv=0;this.phi=0;this.tF=0;this.msg='';this.tk=0;this.charts={};this.baseCharts={};
  this.best=JSON.parse(localStorage.getItem('hxb')||'{}');this.noiseOn=false;this.mods=this.loadMods();
  this.audio=new AudioManager();this.view=new Renderer(cv);this.input=new Input(this);this.volUI=new VolumeControl(this.audio);this.modMenu=new ModMenu(this);this.fx=null;
  this.last=performance.now();requestAnimationFrame(n=>this.loop(n))}
 get level(){return LEVELS[this.lv]}
 get live(){return this.state==='play'||this.state==='dead'||this.state==='win'}
 get chart(){return this.live?this.charts[this.lv]:Chart.EMPTY}
 time(){return this.state==='play'?this.audio.time(this.level):this.live?this.tF:performance.now()/1e3}
 // --- musica di sottofondo (menu, game over, vittoria): loop del livello selezionato ---
 async preview(){const L=this.level,tk=++this.tk;
  try{await this.audio.load(L);if(tk===this.tk&&(this.state==='menu'||this.state==='win'))this.audio.play(L,true)}
  catch(e){this.msg=e.message+' (serve un server: GitHub Pages o python -m http.server)'}}
 // --- mod menu: moltiplicatori di difficolta' (mapSpeed = velocita' dei muri, playerSpeed = velocita' di rotazione) ---
 loadMods(){const d={mapSpeed:1,playerSpeed:1};
  try{const s=JSON.parse(localStorage.getItem('hxm')||'{}');for(const k in d)if(Number.isFinite(s[k]))d[k]=Math.min(2.5,Math.max(.5,s[k]))}catch(e){}
  return d}
 setMod(k,v){if(!(k in this.mods)||!Number.isFinite(v))return;
  this.mods[k]=Math.min(2.5,Math.max(.5,v));localStorage.setItem('hxm',JSON.stringify(this.mods))}
 // --- azioni ---
 confirm(){const s=this.state;
  if(s==='gate'){this.state='menu';this.audio.unlock().then(()=>this.preview())}
  else if(s==='menu'||s==='dead'||s==='win')this.play()}
 nav(d){if(this.state!=='menu')return;this.lv=(this.lv+d+LEVELS.length)%LEVELS.length;this.preview()}
 back(){if(this.state==='gate'||this.state==='load')return;this.audio.stopNoise();this.state='menu';this.preview()}
 pointer(fx,fy){const s=this.state;
  if(s==='gate')this.confirm();
  else if(s==='menu'&&this.modMenu.open)this.modMenu.setOpen(false); // un tocco fuori chiude il menu mod
  else if(s==='menu')fx<.25?this.nav(-1):fx>.75?this.nav(1):this.confirm();
  else if(s==='dead'||s==='win')fy<.15?this.back():this.confirm()}
 async play(){
  if(this.state==='load')return;const L=this.level;this.tk++;this.state='load';this.msg='';
  try{const buf=await this.audio.load(L);
   // Keep the authored JSON/analysis as the base, then create a fresh
   // playable variation on every attempt. Beat timestamps stay synchronized.
   if(!this.baseCharts[this.lv])this.baseCharts[this.lv]=await this.getChart(L,buf);
   const seed=(L.seed^(Date.now()>>>0)^(Math.random()*0x100000000>>>0))>>>0;
   // Endless run: after VOID.start seconds the authored rows are replaced by generated ones, forever.
   const run=this.baseCharts[this.lv].randomized(L,seed).endless(L,seed,L.offset+VOID.start);
   this.charts[this.lv]=run;this.noiseOn=false;this.audio.loadNoise(); // precarica wn01.wav
   this.modMenu.setOpen(false);
   this.audio.play(L,false,run);this.phi=0;this.fx=null;this.state='play'}
  catch(e){this.msg=e.message;this.state='menu'}}
 changeVolume(d){const v=Math.min(1,Math.max(0,this.audio.vol+d));this.audio.setVolume(v);this.volUI.input.value=v}
 async getChart(L,buf){ // 1) JSON precalcolato  2) analisi dal vivo
  try{const r=await fetch(`${SONG_DIR}${L.id}.json`);if(r.ok)return Chart.fromJSON(await r.json(),L)}catch(e){}
  await new Promise(r=>setTimeout(r,60));return new BeatAnalyzer(L).analyze(buf)}
 async exportChart(){if(this.state!=='menu')return;const L=this.level;
  try{const ch=new BeatAnalyzer(L).analyze(await this.audio.load(L)),a=document.createElement('a');
   a.href=URL.createObjectURL(new Blob([JSON.stringify(ch)],{type:'application/json'}));a.download=L.id+'.json';a.click()}catch(e){this.msg=e.message}}
 die(t){const L=this.level,q=()=>Math.random();this.state='dead';this.tF=t;
  this.fx={t0:performance.now(),tau:0,phi:this.phi,parts:Array.from({length:16},()=>({a:q()*6.283,v:.3+q()*.9,w:(q()-.5)*16,s:.012+q()*.02}))};this.audio.stopNoise();this.audio.duck(.35);this.audio.loopNow(L);
  const ts=t-L.offset;if(!(this.best[this.lv]>=ts)){this.best[this.lv]=ts;localStorage.setItem('hxb',JSON.stringify(this.best))}}
 update(dt){
  if(this.state!=='play')return;const L=this.level,ch=this.chart,t=this.audio.time(L);
  this.phi+=(this.input.R-this.input.L)*(L.turnRate??6.4)*this.mods.playerSpeed*dt;
  ch.ensure(t);
  if(!this.noiseOn&&t>=ch.voidStart){this.noiseOn=true;this.audio.startNoise()} // il rumore parte con l'inversione
  if(ch.hit(t,this.phi,this.mods.mapSpeed))this.die(t);
  else if(t>=ch.dur-.05){this.state='win';this.tF=t;this.preview()}}
 loop(now){const dt=Math.min(.05,(now-this.last)/1e3);this.last=now;if(this.fx)this.fx.tau=(now-this.fx.t0)/1e3;
  this.update(dt);this.modMenu.show(this.state==='menu');this.view.draw(this);requestAnimationFrame(n=>this.loop(n))}
}
