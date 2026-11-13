import {VIS} from './config.js';
// Music visualizer: turns the live audio spectrum into a few smooth 0..1 levels (bass, mid, high, all).
// Renderer reads them to pulse the hub and the camera. Tune everything in config.js (VIS).
export class Visualizer{
  constructor(audio){
    this.audio=audio;this.bins=null;
    const st=()=>({peak:VIS.minPeak,slow:0,dPeak:VIS.minPeak*.3});
    this.st={bass:st(),mid:st(),high:st()};
    this.level={bass:0,mid:0,high:0,all:0};
  }
  // Level of one band, 0..1 (0 when the visualizer is off or unknown band).
  get(name){return VIS.enabled?(this.level[name]||0):0}
  update(dt){
    const an=this.audio.an,lv=this.level;
    if(!VIS.enabled||!an||!this.audio.ctx){for(const k in lv)lv[k]=0;return}
    if(!this.bins||this.bins.length!==an.frequencyBinCount)this.bins=new Uint8Array(an.frequencyBinCount);
    an.getByteFrequencyData(this.bins);
    const hz=this.audio.ctx.sampleRate/an.fftSize,n=this.bins.length;
    for(const name in VIS.bands){
      const [lo,hi]=VIS.bands[name],a=Math.max(1,Math.floor(lo/hz)),b=Math.min(n-1,Math.max(a,Math.ceil(hi/hz)));
      let sum=0;for(let i=a;i<=b;i++)sum+=this.bins[i];
      const raw=sum/(b-a+1)/255;
      const s=this.st[name],decay=VIS.agc>0?Math.exp(-dt/VIS.agc):0;
      // sustained level, normalised by a loudness reference that jumps up with loud hits and slowly relaxes
      s.peak=Math.max(VIS.minPeak,raw,s.peak*decay);
      const level=raw/s.peak;
      // hits: how far this frame is above the recent average (so a constant bassline does not keep it pegged)
      s.slow+=(raw-s.slow)*(1-Math.exp(-dt/Math.max(1e-3,VIS.baseline)));
      const d=Math.max(0,raw-s.slow);
      s.dPeak=Math.max(VIS.minPeak*.3,d,s.dPeak*decay);
      let v=level+(d/s.dPeak-level)*VIS.punch;
      v=Math.max(0,(v-VIS.floor)/(1-VIS.floor));
      const target=Math.min(1,Math.pow(v,VIS.gamma)*VIS.gain);
      const tau=target>lv[name]?VIS.attack:VIS.release;
      lv[name]+=(target-lv[name])*(1-Math.exp(-dt/Math.max(1e-3,tau)));
    }
    lv.all=Math.min(1,(lv.bass*VIS.mix.bass+lv.mid*VIS.mix.mid+lv.high*VIS.mix.high)/((VIS.mix.bass+VIS.mix.mid+VIS.mix.high)||1));
  }
}
