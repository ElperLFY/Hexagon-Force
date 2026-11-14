import { SONG_DIR, VOID } from './config.js';
import { Chart, PatternGenerator } from './PatternGenerator.js';
import { BeatAnalyzer } from './BeatAnalyzer.js';
import { AudioManager } from './AudioManager.js';
import { Renderer } from './Renderer.js';
import { Input } from './Input.js';
import { VolumeControl } from './VolumeControl.js';
import { SettingsPanel } from './SettingsPanel.js';
import { Visualizer } from './Visualizer.js';

// State flow: gate -> menu -> load -> play -> dead.
// A stage clears at its goal time, but gameplay and Endless continue until death.
export class Game {
  constructor(canvas,pathRegistry) {
    this.state = 'gate';
    this.paths = pathRegistry?.paths ?? [];
    if(!this.paths.length)throw new Error('No playable Path definitions were loaded');
    this.progress = this.loadProgress();
    const savedPathIndex=this.paths.findIndex(path=>path.id===this.progress.activePathId&&this.isPathUnlocked(path));
    const defaultIndex=this.paths.findIndex(path=>path.id===pathRegistry.defaultPathId);
    this.pathIndex=savedPathIndex>=0?savedPathIndex:Math.max(0,defaultIndex);
    this.lv=this.firstAvailableLevelIndex();
    this.phi = 0;
    this.tF = 0;
    this.msg = '';
    this.tk = 0;
    this.charts = {};
    this.baseCharts = {};

    this.best = JSON.parse(localStorage.getItem('hxb') || '{}');
    this.lastScores = JSON.parse(localStorage.getItem('hxl') || '{}');
    this.migrateLegacyScores();
    this.uiOverlay = null;
    this.noiseOn = false;
    this.mods = this.loadMods();

    this.audio = new AudioManager();
    this.view = new Renderer(canvas);
    this.input = new Input(this);
    this.frameRateCap = 60;
    this.lastDraw = 0;
    this.volUI = new VolumeControl(this.audio, value => this.settingsPanel?.syncMusicVolume(value));
    this.settingsPanel = new SettingsPanel(this);
    this.settingsReady = this.settingsPanel.ready.catch(error => {
      console.warn('[HEXBEAT] Settings panel unavailable:', error);
      this.msg = 'SETTINGS UNAVAILABLE: ' + error.message;
      return null;
    });
    this.settingsPanel.ready = this.settingsReady;
    this.vis = new Visualizer(this.audio);
    this.fx = null;

    this.persistProgress();
    this.last = performance.now();
    requestAnimationFrame((now) => this.loop(now));
  }

  get activePath(){return this.paths[this.pathIndex]??this.paths[0];}

  get level() {
    // Keep a valid palette for menu rendering when an unlocked Path has no authored levels yet.
    return this.activePath?.levels?.[this.lv]??this.paths.find(path=>path.levels.length)?.levels[0]??null;
  }

  get modsLocked(){
    return this.activePath?.id==='path-of-pain';
  }

  get levels() { return this.activePath?.levels??[]; }

  get allLevels() { return this.paths.flatMap(path=>path.levels); }

  get live() {
    return this.state === 'play' || this.state === 'dead' || this.state === 'win';
  }

  levelKey(level=this.level,path=this.activePath){
    return path&&level?`${path.id}:${level.id}`:'';
  }

  recordKey(level=this.level,path=this.activePath){return this.levelKey(level,path);}

  get chart() {
    return this.live ? (this.charts[this.levelKey()]??Chart.EMPTY) : Chart.EMPTY;
  }

  loadProgress(){
    const fallback={version:1,completedLevels:[],announcements:{},activePathId:'path-of-joy'};
    try{
      const saved=JSON.parse(localStorage.getItem('hxp')||'{}');
      return {
        ...fallback,...saved,
        completedLevels:Array.isArray(saved.completedLevels)?saved.completedLevels:[],
        announcements:saved.announcements&&typeof saved.announcements==='object'?saved.announcements:{}
      };
    }catch(error){return fallback;}
  }

  persistProgress(){
    this.progress.activePathId=this.activePath?.id??this.progress.activePathId;
    try{localStorage.setItem('hxp',JSON.stringify(this.progress));}
    catch(error){console.warn('[HEXBEAT] Path progress could not be saved:',error);}
  }

  hasCompletedLevel(level,path=this.activePath){
    return Boolean(level&&this.progress.completedLevels.includes(this.levelKey(level,path)));
  }

  isLevelCompleted(index,path=this.activePath){
    const level=path?.levels?.[index];
    return this.hasCompletedLevel(level,path);
  }

  isPathCompleted(pathOrId){
    const path=typeof pathOrId==='string'?this.paths.find(item=>item.id===pathOrId):pathOrId;
    return Boolean(path&&path.levels.length&&path.levels.every(level=>this.hasCompletedLevel(level,path)));
  }

  isPathUnlocked(pathOrId){
    const path=typeof pathOrId==='string'?this.paths.find(item=>item.id===pathOrId):pathOrId;
    if(!path)return false;
    const rule=path.unlock??{type:'always'};
    if(rule.type==='always')return true;
    if(rule.type==='complete-path')return this.isPathCompleted(rule.pathId);
    return false;
  }

  isLevelUnlocked(index,path=this.activePath){
    if(index===0)return true;
    return index>0&&index<path.levels.length&&this.hasCompletedLevel(path.levels[index-1],path);
  }

  firstAvailableLevelIndex(path=this.activePath){
    if(!path?.levels?.length)return 0;
    for(let index=0;index<path.levels.length;index++){
      if(this.isLevelUnlocked(index,path)&&!this.isLevelCompleted(index,path))return index;
    }
    return Math.max(0,path.levels.length-1);
  }

  unlockedLevelCount(path=this.activePath){
    let count=0;
    while(count<path.levels.length&&this.isLevelUnlocked(count,path))count++;
    return count;
  }

  migrateLegacyScores(){
    const joy=this.paths.find(path=>path.id==='path-of-joy');
    if(!joy)return;
    let changed=false;
    joy.levels.forEach((level,index)=>{
      const key=this.levelKey(level,joy),legacyKey=String(index);
      if(!Object.prototype.hasOwnProperty.call(this.best,key)&&Number.isFinite(this.best[legacyKey])){
        this.best[key]=this.best[legacyKey];changed=true;
      }
      if(!Object.prototype.hasOwnProperty.call(this.lastScores,key)&&Number.isFinite(this.lastScores[legacyKey])){
        this.lastScores[key]=this.lastScores[legacyKey];changed=true;
      }
    });
    if(changed){
      localStorage.setItem('hxb',JSON.stringify(this.best));
      localStorage.setItem('hxl',JSON.stringify(this.lastScores));
    }
  }

  selectLevel(index,allowLocked=false){
    if(index<0||index>=this.levels.length)return false;
    const unlocked=this.isLevelUnlocked(index);
    if(!unlocked&&!allowLocked){
      this.msg='LOCKED';
      this.audio.playSound('menuselect');
      return false;
    }
    this.lv=index;
    this.msg=unlocked?'':'LOCKED';
    this.audio.playSound('menuselect');
    this.persistProgress();
    if(this.state==='menu'){
      if(unlocked)this.preview();
      else{
        this.tk++;
        this.audio.stop();
      }
    }
    return true;
  }

  selectPath(pathOrId){
    const path=typeof pathOrId==='string'
      ?this.paths.find(item=>item.id===pathOrId)
      :this.paths[pathOrId];
    if(!path)return false;
    if(!this.isPathUnlocked(path)){
      this.msg='PATH LOCKED — CLEAR PATH OF JOY FIRST';
      this.audio.playSound('menuselect');
      return false;
    }
    this.tk++; // invalidate any preview that may still be loading for the previous Path
    this.pathIndex=this.paths.indexOf(path);
    this.lv=this.firstAvailableLevelIndex(path);
    this.msg=path.levels.length?'':'NEW LEVELS COMING SOON';
    this.audio.playSound('menuselect');
    this.persistProgress();
    this.settingsPanel?.applyModifiers();
    this.settingsPanel?.syncRows();
    if(this.state==='menu'){
      if(path.levels.length)this.preview();
      else this.audio.stop();
    }
    return true;
  }

  navPath(direction){
    if(this.state!=='menu')return;
    const count=this.paths.length;
    for(let step=1;step<=count;step++){
      const index=(this.pathIndex+direction*step+count*2)%count;
      if(this.isPathUnlocked(this.paths[index])){
        this.selectPath(index);
        return;
      }
    }
  }

  time() {
    if (this.state === 'play'&&this.level) return this.audio.time(this.level);
    if (this.live) return this.tF;
    return performance.now() / 1e3;
  }

  // Play the selected level as background music in the menu or after a win.
  async preview() {
    const level = this.activePath?.levels?.[this.lv];
    const requestToken = ++this.tk;
    if(!level){this.audio.stop();return;}

    try {
      await this.audio.load(level);

      // Ignore stale loads if the user has changed state or selected another level.
      if (
        requestToken === this.tk &&
        (this.state === 'menu' || this.state === 'win')
      ) {
        this.audio.play(level, true);
      }
    } catch (error) {
      this.msg = `${error.message} (serve the game from a server, such as GitHub Pages or python -m http.server)`;
    }
  }

  // mapSpeed controls wall speed; playerSpeed controls the player's rotation speed.
  loadMods() {
    const defaults = { mapSpeed: 1, playerSpeed: 1 };

    try {
      const savedMods = JSON.parse(localStorage.getItem('hxm') || '{}');
      for (const key in defaults) {
        if (Number.isFinite(savedMods[key])) {
          defaults[key] = Math.min(2.5, Math.max(0.5, savedMods[key]));
        }
      }
    } catch (error) {
      // Ignore invalid saved settings and use the defaults.
    }

    return defaults;
  }

  setMod(key, value) {
    if(this.modsLocked||!(key in this.mods)||!Number.isFinite(value))return;
    this.mods[key]=Math.min(2.5,Math.max(.5,value));
    localStorage.setItem('hxm',JSON.stringify(this.mods));
  }

  // --- User actions ---
  confirm() {
    const state=this.state;
    this.audio.playSound('menuchoose');

    if(state==='gate'){
      this.state='menu';
      this.audio.unlock().then(()=>{
        void this.audio.preloadCues();
        this.preview();
      });
      return;
    }
    if(state==='menu'){
      this.play();
      return;
    }
    if(state==='dead'){
      if(!this.hasCompletedLevel(this.level)){
        this.play();
        return;
      }
      const next=this.lv+1;
      if(next<this.levels.length){
        this.selectLevel(next);
        this.play();
        return;
      }
      const nextPath=this.paths.find(path=>
        path.unlock?.type==='complete-path'&&
        path.unlock.pathId===this.activePath.id&&
        this.isPathUnlocked(path)
      );
      this.state='menu';
      if(nextPath)this.selectPath(nextPath.id);
      else this.preview();
    }
  }

  nav(direction) {
    if(this.state!=='menu'&&this.state!=='gate')return;
    if(!this.levels.length){
      this.msg='NEW LEVELS COMING SOON';
      return;
    }

    const next=this.lv+Math.sign(direction);
    if(next>=0&&next<this.levels.length){
      this.selectLevel(next,true);
      return;
    }
    if(direction>0&&next>=this.levels.length&&this.activePath.id==='path-of-joy'){
      const pain=this.paths.find(path=>path.id==='path-of-pain');
      if(pain&&this.isPathUnlocked(pain)){
        this.selectPath(pain.id);
      }else{
        this.msg="PATH OF PAIN ISN'T UNLOCKED YET";
        this.audio.playSound('menuselect');
      }
      return;
    }
    this.msg=direction>0?'NO MORE LEVELS IN THIS PATH':'';
  }

  back() {
    if (this.state === 'load') return;
    this.audio.cancelSequences();

    if (this.uiOverlay === 'settings') {
      this.settingsPanel.close();
      return;
    }
    this.uiOverlay = null;
    this.audio.stopNoise();

    // During a run, Escape abandons the attempt and returns to stage select.
    // Reset input as well, so a held movement key cannot leak into the menu.
    if (this.state === 'play') {
      this.audio.stop();
      this.input.L = 0;
      this.input.R = 0;
      this.playerOmega = 0;
      this.noiseOn = false;
      this.fx = null;
      this.state = 'menu';
      this.preview();
      return;
    }

    if (this.state === 'menu') {
      this.audio.stop();
      this.state = 'gate';
      return;
    }
    if (this.state === 'dead' || this.state === 'win') {
      this.state = 'menu';
      this.preview();
    }
  }

  quit() {
    try { window.close(); } catch (error) {}
    if (!window.closed) this.msg = 'CLOSE THIS BROWSER TAB TO QUIT';
  }

  toggleHighScores() {
    if (this.state === 'load' || this.state === 'play') return;
    if (this.uiOverlay === 'settings') this.settingsPanel.close();
    this.uiOverlay = this.uiOverlay === 'scores' ? null : 'scores';
  }

  toggleSettings() {
    if (this.state === 'load' || this.state === 'play') return;
    if (this.uiOverlay === 'scores') this.uiOverlay = null;
    this.settingsPanel.toggle();
  }

  recordResult(time) {
    const level=this.level,key=this.recordKey(level);
    const elapsed=Math.max(0,time-level.offset);
    this.lastScores[key]=elapsed;
    localStorage.setItem('hxl',JSON.stringify(this.lastScores));

    const isNewBest=!(this.best[key]>=elapsed);
    if(isNewBest){
      this.best[key]=elapsed;
      localStorage.setItem('hxb',JSON.stringify(this.best));
      this.audio.playAnnouncement('wonderful');
    }
    return isNewBest;
  }

  checkMilestoneCues(time) {
    const level=this.level,key=this.recordKey(level);
    const elapsed=Math.max(0,time-level.offset);
    const announced=this.progress.announcements[key]??[];
    let changed=false;
    if(elapsed>=30&&!announced.includes('awesome')){
      announced.push('awesome');
      this.audio.playAnnouncement('awesome');
      changed=true;
    }
    if(elapsed>=60&&!announced.includes('excellent')){
      announced.push('excellent');
      this.audio.playAnnouncement('excellent');
      changed=true;
    }
    if(changed){
      this.progress.announcements[key]=announced;
      this.persistProgress();
    }
  }

  completeStage(time){
    const level=this.activePath?.levels?.[this.lv];
    if(!level||Math.max(0,time-level.offset)<(level.goalSeconds??60))return false;
    const key=this.recordKey(level);
    if(!this.progress.completedLevels.includes(key)){
      this.progress.completedLevels.push(key);
      this.persistProgress();
    }
    return true;
  }

  pointer(x,y) {
    if(this.uiOverlay==='settings')return;
    if(this.uiOverlay==='scores'){this.toggleHighScores();return;}
    const state=this.state;
    if(state==='gate'){
      if(y>.89&&x>.32&&x<.68){this.toggleSettings();return;}
      if(y<.075&&x<.4){this.toggleHighScores();return;}
      if(y<.075&&x>.6){this.quit();return;}
      if(y>.5&&y<.72&&x<.25){this.nav(-1);return;}
      if(y>.5&&y<.72&&x>.75){this.nav(1);return;}
      this.confirm();return;
    }
    if(state==='menu'){
      if(y>.89&&x>.72){this.toggleSettings();return;}
      if(y<.075&&x<.4){this.toggleHighScores();return;}
      if(y<.075&&x>.6){this.back();return;}
      if(y>.5&&y<.72&&x<.10){this.nav(-1);return;}
      if(y>.5&&y<.72&&x>.44&&x<.54){this.nav(1);return;}
      if(y>.5&&y<.72){this.confirm();return;}
      this.confirm();return;
    }
    if(state==='dead'||state==='win'){
      if(y<.075&&x<.4)this.toggleHighScores();
      else if(y<.075&&x>.6)this.back();
      else this.confirm();
    }
  }

  async play() {
    if(this.state==='load')return;
    const level=this.activePath?.levels?.[this.lv];
    if(!level){this.msg='THIS PATH HAS NO LEVELS YET';return;}
    if(!this.isLevelUnlocked(this.lv)){this.msg='LOCKED';return;}

    const cacheKey=this.levelKey(level);
    this.tk++;
    this.audio.cancelSequences();
    if(this.uiOverlay==='settings')this.settingsPanel.close();
    this.uiOverlay=null;
    this.state='load';
    this.msg='';

    try{
      await this.settingsReady;
      await PatternGenerator.loadCatalog();
      const audioBuffer=await this.audio.load(level);

      const seed=(level.seed^(Date.now()>>>0)^(Math.random()*0x100000000>>>0))>>>0;
      // Reuse the decoded soundtrack, but build a fresh beat-sensitive motif sequence per attempt.
      const baseChart=await this.getChart(level,audioBuffer,seed);
      this.baseCharts[cacheKey]=baseChart;
      const run=baseChart
        .randomized(level,seed)
        .endless(level,seed,level.offset+VOID.start);

      this.charts[cacheKey]=run;
      this.noiseOn=false;
      this.audio.loadNoise();
      this.audio.play(level,false,run);
      this.phi=0;
      this.fx=null;
      this.state='play';
      this.audio.playTogether([['sounds','start'],['sounds','begin']]);
    }catch(error){
      this.msg=error.message;
      this.state='menu';
    }
  }

  changeVolume(delta) {
    const volume = Math.min(1, Math.max(0, this.audio.vol + delta));
    this.audio.setVolume(volume);
    this.volUI.input.value = volume;
    this.settingsPanel?.syncMusicVolume(volume);
  }

  // Beat-sensitive paths are generated from the actual soundtrack. Authored
  // JSON charts remain available as an explicit per-level option.
  async getChart(level,audioBuffer,seed=level.seed) {
    if(level.chartMode==='authored'){
      try{
        const response=await fetch(`${SONG_DIR}${level.id}.json`);
        if(response.ok)return Chart.fromJSON(await response.json(),level);
      }catch(error){
        console.warn('[HEXBEAT] Authored chart unavailable; analyzing audio instead:',error);
      }
    }
    await new Promise(resolve=>setTimeout(resolve,40));
    return new BeatAnalyzer({...level,seed}).analyze(audioBuffer);
  }

  async exportChart() {
    if (this.state !== 'menu') return;

    const level = this.level;

    try {
      const audioBuffer = await this.audio.load(level);
      const chart = new BeatAnalyzer(level).analyze(audioBuffer);
      const file = new Blob([JSON.stringify(chart)], { type: 'application/json' });
      const link = document.createElement('a');

      link.href = URL.createObjectURL(file);
      link.download = `${level.id}.json`;
      link.click();
    } catch (error) {
      this.msg = error.message;
    }
  }

  die(time) {
    const level = this.level;
    const random = () => Math.random();

    this.state = 'dead';
    this.tF = time;
    this.fx = {
      t0: performance.now(),
      tau: 0,
      phi: this.phi,
      parts: Array.from({ length: 16 }, () => ({
        a: random() * 6.283,
        v: 0.3 + random() * 0.9,
        w: (random() - 0.5) * 16,
        s: 0.012 + random() * 0.02,
      })),
    };

    this.audio.stopNoise();
    this.audio.playSequence([['sounds', 'die'], ['sounds', 'gameover']]);
    this.audio.duck(0.35);
    this.audio.loopNow(level);

    this.recordResult(time);
  }

  update(deltaTime) {
    if(this.state!=='play')return;

    const level=this.level;
    const chart=this.chart;
    const time=this.audio.time(level);
    this.checkMilestoneCues(time);

    // The level is cleared at its goal time, but gameplay and Endless Void continue.
    // The result screen reports "STAGE COMPLETED" only after the player eventually dies.
    if(Math.max(0,time-level.offset)>=(level.goalSeconds??60))this.completeStage(time);

    chart.ensure(time);

    if (!this.noiseOn && time >= chart.voidStart) {
      this.noiseOn = true;
      this.audio.startNoise();
    }

    // The arrow tip is lethal. If either flank/base touches a wall first,
    // clamp angular movement at the last free position. Input is deliberately
    // left untouched: the held direction resumes as soon as the wall passes.
    const mapSpeed=this.modsLocked?1:this.mods.mapSpeed;
    const playerSpeed=this.modsLocked?1:this.mods.playerSpeed;
    const currentCollision=chart.collision(time,this.phi,mapSpeed);
    if(currentCollision?.type==='tip'){
      this.die(time);
      return;
    }

    const direction=this.input.R-this.input.L;
    const angularVelocity=direction*(level.turnRate??8.5)*playerSpeed;
    const angularDelta=angularVelocity*deltaTime;
    const substeps=Math.max(1,Math.ceil(Math.abs(angularDelta)/.012));
    let sideBlocked=false;

    for(let step=1;step<=substeps;step++){
      const candidate=this.phi+angularDelta/substeps;
      const collision=chart.collision(time,candidate,mapSpeed);
      if(collision?.type==='tip'){
        // If the flank was already touching this exact wall at the start of the
        // frame, pushing farther into it is a blocked turn. A different wall
        // still kills on tip contact.
        const sameWall=currentCollision?.type==='side' &&
          currentCollision.row===collision.row &&
          currentCollision.sector===collision.sector;
        if(sameWall){
          sideBlocked=true;
          break;
        }
        this.die(time);
        return;
      }
      if(collision?.type==='side'){
        sideBlocked=true;
        break;
      }
      this.phi=candidate;
    }

    this.playerOmega=sideBlocked?0:angularVelocity;

  }

  loop(now) {
    const deltaTime = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;

    if (this.fx) {
      this.fx.tau = (now - this.fx.t0) / 1000;
    }

    this.update(deltaTime);
    this.vis.update(deltaTime);
    const frameCap = Math.max(1, Number(this.frameRateCap) || 60);
    const frameInterval = 1000 / frameCap;
    if (now - this.lastDraw >= frameInterval - 0.25) {
      this.view.draw(this);
      if(this.settingsPanel?.isOpen)this.settingsPanel.updateTheme();
      this.lastDraw = now;
    }
    requestAnimationFrame((nextFrameTime) => this.loop(nextFrameTime));
  }
}
