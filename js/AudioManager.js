import {SONG_DIR} from './config.js';
// Carica, decodifica e riproduce le canzoni (WebAudio).
export class AudioManager{
 constructor(){this.ctx=null;this.buf={};this.src=null;this.gain=null;this.startAt=0}
 unlock(){if(!this.ctx)this.ctx=new AudioContext();return this.ctx.resume()}
 async load(L){
  if(!this.buf[L.id]){const url=`${SONG_DIR}${L.id}.mp3`,r=await fetch(url).catch(()=>null);
   if(!r||!r.ok)throw Error(url+' non trovato');
   this.buf[L.id]=await this.ctx.decodeAudioData(await r.arrayBuffer())}
  return this.buf[L.id]}
 play(L,loop){ // parte da L.offset; in loop torna a L.offset
  this.stop();const c=this.ctx,b=this.buf[L.id],s=c.createBufferSource(),g=c.createGain();
  s.buffer=b;s.connect(g).connect(c.destination);
  if(loop){s.loop=true;s.loopStart=L.offset;s.loopEnd=b.duration}
  this.startAt=c.currentTime+.2;s.start(this.startAt,L.offset);this.src=s;this.gain=g}
 loopNow(L){if(this.src){this.src.loop=true;this.src.loopStart=L.offset;this.src.loopEnd=this.buf[L.id].duration}}
 duck(v){if(this.gain)this.gain.gain.setTargetAtTime(v,this.ctx.currentTime,.05)}
 stop(){const s=this.src;if(!s)return;this.gain.gain.setTargetAtTime(0,this.ctx.currentTime,.04);
  setTimeout(()=>{try{s.stop()}catch(e){}},250);this.src=null}
 time(L){return this.ctx.currentTime-this.startAt+L.offset}
}
