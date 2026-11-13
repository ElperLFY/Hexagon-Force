import {SONG_DIR,VOID,VIS} from './config.js';
// Carica, decodifica e riproduce le canzoni (WebAudio).
export class AudioManager{
 constructor(){this.vol=parseFloat(localStorage.getItem('hxv')??'.5');this.master=null;this.ctx=null;this.buf={};this.src=null;this.gain=null;this.startAt=0;this.noiseBuf=null;this.noiseMissing=false;this.noise=null;this.an=null}
 unlock(){if(!this.ctx){this.ctx=new AudioContext();this.master=this.ctx.createGain();this.master.gain.value=this.vol*this.vol;this.master.connect(this.ctx.destination);
   // Analyser for the visualizer: it listens to the music only (before the volume slider, never to the noise).
   this.an=this.ctx.createAnalyser();this.an.fftSize=VIS.fft;this.an.smoothingTimeConstant=VIS.smoothing}return this.ctx.resume()}
 setVolume(v){this.vol=v;localStorage.setItem('hxv',v);if(this.master)this.master.gain.setTargetAtTime(v*v,this.ctx.currentTime,.02)}
 async load(L){
  if(!this.buf[L.id]){const url=`${SONG_DIR}${L.id}.mp3`,r=await fetch(url).catch(()=>null);
   if(!r||!r.ok)throw Error(url+' non trovato');
   this.buf[L.id]=await this.ctx.decodeAudioData(await r.arrayBuffer())}
  return this.buf[L.id]}
 play(L,loop,ch){ // parte da L.offset; in loop torna a L.offset
  this.stopNoise();this.stop();const c=this.ctx,b=this.buf[L.id],s=c.createBufferSource(),g=c.createGain();
  s.buffer=b;s.connect(g).connect(this.master);if(this.an)g.connect(this.an);
  if(loop){s.loop=true;s.loopStart=L.offset;s.loopEnd=b.duration}
  else if(ch){ // endless run: loop on a whole number of beats, so the beat grid never drifts when the song wraps
   const bd=ch.beatDur,a=ch.tg0+Math.ceil((L.offset-ch.tg0)/bd)*bd,n=Math.floor((b.duration-.05-a)/bd);
   if(n>=8){s.loop=true;s.loopStart=a;s.loopEnd=a+n*bd}}
  this.startAt=c.currentTime+.2;s.start(this.startAt,L.offset);this.src=s;this.gain=g}
 loopNow(L){if(this.src){this.src.loop=true;this.src.loopStart=L.offset;this.src.loopEnd=this.buf[L.id].duration}}
 // --- noise of the endless phase (MusicData/wn01.wav), looped from the flip until you die ---
 async loadNoise(){
  if(this.noiseBuf||this.noiseMissing)return this.noiseBuf;
  try{const url=SONG_DIR+VOID.noise.file,r=await fetch(url);
   if(!r.ok)throw Error(url+' non trovato');
   this.noiseBuf=await this.ctx.decodeAudioData(await r.arrayBuffer())}
  catch(e){this.noiseMissing=true;console.warn('[HEXBEAT] noise disabled:',e.message)}
  return this.noiseBuf}
 startNoise(){
  if(!this.noiseBuf||this.noise)return;const c=this.ctx,s=c.createBufferSource(),g=c.createGain(),n=VOID.noise;
  s.buffer=this.noiseBuf;s.loop=true;g.gain.setValueAtTime(0,c.currentTime);g.gain.linearRampToValueAtTime(n.gain,c.currentTime+n.fade);
  s.connect(g).connect(this.master);s.start();this.noise={s,g}}
 stopNoise(){
  const n=this.noise;if(!n)return;this.noise=null;
  n.g.gain.cancelScheduledValues(this.ctx.currentTime);n.g.gain.setTargetAtTime(0,this.ctx.currentTime,.05);
  setTimeout(()=>{try{n.s.stop()}catch(e){}},400)}
 duck(v){if(this.gain)this.gain.gain.setTargetAtTime(v,this.ctx.currentTime,.05)}
 stop(){const s=this.src;if(!s)return;this.gain.gain.setTargetAtTime(0,this.ctx.currentTime,.04);
  setTimeout(()=>{try{s.stop()}catch(e){}},250);this.src=null}
 time(L){return this.ctx.currentTime-this.startAt+L.offset}
}
