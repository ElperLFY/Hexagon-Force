import {Chart,PatternGenerator} from './PatternGenerator.js';
// Analizza l'audio: onset (colpi), BPM e fase dei battiti -> Chart.
export class BeatAnalyzer{
 constructor(L){this.L=L}
 analyze(buf){
  const {o,fps}=this.onsets(buf),f0=Math.floor(this.L.offset*fps),g=this.tempo(o,fps,f0);
  const bd=60/g.bpm,tg0=(f0+g.ph)/fps;
  const S=b=>{const p=Math.round(f0+g.ph+b*g.per);let m=0;for(let i=p-2;i<=p+2;i++)m=Math.max(m,o[i]||0);return m};
  const rows=new PatternGenerator(this.L).generate(S,bd,tg0,buf.duration);
  return new Chart(rows,bd,tg0,g.bpm,buf.duration,this.L.speed)}
 onsets(buf){
  const sr=buf.sampleRate,x=buf.getChannelData(0),hop=512,fps=sr/hop,n=Math.floor(x.length/hop),env=new Float32Array(n);let lp=0;
  for(let i=0;i<n;i++){let lo=0,hi=0;for(let j=i*hop,e=j+hop;j<e;j++){lp+=(x[j]-lp)*.02;lo+=lp*lp;const d=x[j]-(x[j-1]||0);hi+=d*d}
   env[i]=Math.log1p(60*Math.sqrt(lo/hop))+.7*Math.log1p(60*Math.sqrt(hi/hop))}
  const o=new Float32Array(n);
  for(let i=8;i<n;i++){let m=0;for(let k=1;k<=8;k++)m+=env[i-k];o[i]=Math.max(0,env[i]-m/8)}
  const q=o.slice().sort()[Math.floor(n*.97)]||1;for(let i=0;i<n;i++)o[i]=Math.min(1,o[i]/q);
  return{o,fps}}
 tempo(o,fps,f0){
  let best={s:-1};const n=o.length;
  for(let bpm=70;bpm<=190;bpm+=.25){const per=60/bpm*fps;
   for(let ph=0;ph<per;ph++){let s=0,c=0;for(let p=f0+ph;p<n-1;p+=per){const i=p|0,fr=p-i;s+=o[i]*(1-fr)+o[i+1]*fr;c++}
    s=s/c*Math.exp(-.5*Math.pow(Math.log2(bpm/120)/.7,2));if(s>best.s)best={s,bpm,per,ph}}}
  return best}
}
