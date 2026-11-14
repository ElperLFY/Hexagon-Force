import {Chart,PatternGenerator} from './PatternGenerator.js';

// Detect the beat grid only inside the segment played by this stage.
// A 60-second Path stage should not scan several minutes of unused soundtrack.
export class BeatAnalyzer{
  constructor(level){this.level=level;}

  analyze(buffer){
    const startSeconds=Math.max(0,this.level.offset||0);
    const requestedDuration=Number.isFinite(this.level.goalSeconds)
      ?this.level.goalSeconds:Math.max(0,buffer.duration-startSeconds);
    const duration=Math.min(requestedDuration,Math.max(0,buffer.duration-startSeconds));
    const {onsets,fps}=this.analyzeOnsets(buffer,startSeconds,duration);
    const tempo=this.detectTempo(onsets,fps,0);
    const beatDuration=60/tempo.bpm;
    const beatOrigin=startSeconds+tempo.phase/fps;

    const sampleBeat=beat=>{
      const frame=Math.round(tempo.phase+beat*tempo.framesPerBeat);
      let peak=0;
      for(let index=frame-2;index<=frame+2;index++)peak=Math.max(peak,onsets[index]||0);
      return peak;
    };

    const chartEnd=startSeconds+duration;
    const rows=new PatternGenerator(this.level).generate(sampleBeat,beatDuration,beatOrigin,chartEnd);
    return new Chart(rows,beatDuration,beatOrigin,tempo.bpm,chartEnd,this.level.speed,this.level.wallThickness);
  }

  analyzeOnsets(buffer,startSeconds=0,durationSeconds=buffer.duration){
    const sampleRate=buffer.sampleRate;
    const allSamples=buffer.getChannelData(0);
    const startSample=Math.min(allSamples.length,Math.floor(startSeconds*sampleRate));
    const endSample=Math.min(allSamples.length,Math.ceil((startSeconds+durationSeconds)*sampleRate));
    const samples=allSamples.subarray(startSample,endSample);
    const hop=512;
    const fps=sampleRate/hop;
    const frameCount=Math.floor(samples.length/hop);
    const envelope=new Float32Array(frameCount);
    let lowPass=0;

    for(let frame=0;frame<frameCount;frame++){
      let lowEnergy=0,transientEnergy=0;
      const start=frame*hop;
      for(let index=start;index<start+hop;index++){
        lowPass+=(samples[index]-lowPass)*.02;
        lowEnergy+=lowPass*lowPass;
        const transient=samples[index]-(samples[index-1]||0);
        transientEnergy+=transient*transient;
      }
      envelope[frame]=Math.log1p(60*Math.sqrt(lowEnergy/hop))+
        .7*Math.log1p(60*Math.sqrt(transientEnergy/hop));
    }

    const onsets=new Float32Array(frameCount);
    for(let frame=8;frame<frameCount;frame++){
      let previous=0;
      for(let lag=1;lag<=8;lag++)previous+=envelope[frame-lag];
      onsets[frame]=Math.max(0,envelope[frame]-previous/8);
    }

    const sorted=onsets.slice().sort();
    const normalizer=sorted[Math.floor(frameCount*.97)]||1;
    for(let frame=0;frame<frameCount;frame++)onsets[frame]=Math.min(1,onsets[frame]/normalizer);
    return {onsets,fps};
  }

  detectTempo(onsets,fps,frameZero){
    let best={score:-1};
    const frameCount=onsets.length;
    for(let bpm=70;bpm<=190;bpm+=.25){
      const framesPerBeat=60/bpm*fps;
      for(let phase=0;phase<framesPerBeat;phase++){
        let score=0,count=0;
        for(let position=frameZero+phase;position<frameCount-1;position+=framesPerBeat){
          const index=position|0;
          const fraction=position-index;
          score+=onsets[index]*(1-fraction)+onsets[index+1]*fraction;
          count++;
        }
        score=(score/count)*Math.exp(-.5*Math.pow(Math.log2(bpm/120)/.7,2));
        if(score>best.score)best={score,bpm,framesPerBeat,phase};
      }
    }
    return best;
  }
}
