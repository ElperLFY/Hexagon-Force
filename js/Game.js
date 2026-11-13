import { LEVELS, SONG_DIR, VOID } from './config.js';
import { Chart, PatternGenerator } from './PatternGenerator.js';
import { BeatAnalyzer } from './BeatAnalyzer.js';
import { AudioManager } from './AudioManager.js';
import { Renderer } from './Renderer.js';
import { Input } from './Input.js';
import { VolumeControl } from './VolumeControl.js';
import { SettingsPanel } from './SettingsPanel.js';
import { Visualizer } from './Visualizer.js';

// State flow: gate -> menu -> load -> play -> dead/win.
// The selected level's music continues in the background between runs.
export class Game {
  constructor(canvas) {
    this.state = 'gate';
    this.lv = 0;
    this.phi = 0;
    this.tF = 0;
    this.msg = '';
    this.tk = 0;
    this.charts = {};
    this.baseCharts = {};

    this.best = JSON.parse(localStorage.getItem('hxb') || '{}');
    this.lastScores = JSON.parse(localStorage.getItem('hxl') || '{}');
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

    this.last = performance.now();
    requestAnimationFrame((now) => this.loop(now));
  }

  get level() {
    return LEVELS[this.lv];
  }

  get levels() { return LEVELS; }

  get live() {
    return this.state === 'play' || this.state === 'dead' || this.state === 'win';
  }

  get chart() {
    return this.live ? this.charts[this.lv] : Chart.EMPTY;
  }

  time() {
    if (this.state === 'play') return this.audio.time(this.level);
    if (this.live) return this.tF;
    return performance.now() / 1e3;
  }

  // Play the selected level as background music in the menu or after a win.
  async preview() {
    const level = this.level;
    const requestToken = ++this.tk;

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
    if (!(key in this.mods) || !Number.isFinite(value)) return;

    this.mods[key] = Math.min(2.5, Math.max(0.5, value));
    localStorage.setItem('hxm', JSON.stringify(this.mods));
  }

  // --- User actions ---
  confirm() {
    const state = this.state;

    if (state === 'gate') {
      this.state = 'menu';
      this.audio.unlock().then(() => this.preview());
    } else if (state === 'menu' || state === 'dead' || state === 'win') {
      this.play();
    }
  }

  nav(direction) {
    if (this.state !== 'menu' && this.state !== 'gate') return;
    this.lv = (this.lv + direction + LEVELS.length) % LEVELS.length;
    if (this.state === 'menu') this.preview();
  }

  back() {
    if (this.state === 'load') return;

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
    const elapsed = Math.max(0, time - this.level.offset);
    this.lastScores[this.lv] = elapsed;
    localStorage.setItem('hxl', JSON.stringify(this.lastScores));
    if (!(this.best[this.lv] >= elapsed)) {
      this.best[this.lv] = elapsed;
      localStorage.setItem('hxb', JSON.stringify(this.best));
    }
  }

  complete(time) {
    this.tF = time;
    this.recordResult(time);
    this.audio.stopNoise();
    this.audio.stop();
    this.fx = null;
    this.uiOverlay = null;
    this.state = 'win';
  }

  pointer(x, y) {
    if (this.uiOverlay === 'settings') return;
    if (this.uiOverlay === 'scores') { this.toggleHighScores(); return; }
    const state = this.state;
    if (state === 'gate') {
      if (y > .89 && x > .32 && x < .68) { this.toggleSettings(); return; }
      if (y < .075 && x < .4) { this.toggleHighScores(); return; }
      if (y < .075 && x > .6) { this.quit(); return; }
      if (y > .5 && y < .72 && x < .25) { this.nav(-1); return; }
      if (y > .5 && y < .72 && x > .75) { this.nav(1); return; }
      this.confirm(); return;
    }
    if (state === 'menu') {
      if (y > .89 && x > .72) { this.toggleSettings(); return; }
      if (y < .075 && x < .4) { this.toggleHighScores(); return; }
      if (y < .075 && x > .6) { this.back(); return; }
      if (y > .5 && y < .72 && x < .10) { this.nav(-1); return; }
      if (y > .5 && y < .72 && x > .44 && x < .54) { this.nav(1); return; }
      this.confirm(); return;
    }
    if (state === 'dead' || state === 'win') {
      if (y < .075 && x < .4) this.toggleHighScores();
      else if (y < .075 && x > .6) this.back();
      else this.confirm();
    }
  }

  async play() {
    if (this.state === 'load') return;

    const level = this.level;
    this.tk++;
    if (this.uiOverlay === 'settings') this.settingsPanel.close();
    this.uiOverlay = null;
    this.state = 'load';
    this.msg = '';

    try {
      await this.settingsReady;
      await PatternGenerator.loadCatalog();
      const audioBuffer = await this.audio.load(level);

      // Cache the source chart, then create a fresh variation for each attempt.
      // Beat timestamps remain synchronized with the audio.
      if (!this.baseCharts[this.lv]) {
        this.baseCharts[this.lv] = await this.getChart(level, audioBuffer);
      }

      const seed = (
        level.seed ^
        (Date.now() >>> 0) ^
        (Math.random() * 0x100000000 >>> 0)
      ) >>> 0;

      // Replace the authored chart with generated patterns after VOID.start.
      const run = this.baseCharts[this.lv]
        .randomized(level, seed)
        .endless(level, seed, level.offset + VOID.start);

      this.charts[this.lv] = run;
      this.noiseOn = false;
      this.audio.loadNoise(); // Preload wn01.wav.
      this.audio.play(level, false, run);
      this.phi = 0;
      this.fx = null;
      this.state = 'play';
    } catch (error) {
      this.msg = error.message;
      this.state = 'menu';
    }
  }

  changeVolume(delta) {
    const volume = Math.min(1, Math.max(0, this.audio.vol + delta));
    this.audio.setVolume(volume);
    this.volUI.input.value = volume;
    this.settingsPanel?.syncMusicVolume(volume);
  }

  // Load a precomputed chart when available; otherwise analyze the audio.
  async getChart(level, audioBuffer) {
    // Blu/RGB JSON charts were generated with the old intensity gate and
    // contain full silent bars. Re-analyze hard stages so the continuous
    // hard-stage generator is used; retain the authored charts for other levels.
    if (!level.hard) {
      try {
        const response = await fetch(`${SONG_DIR}${level.id}.json`);
        if (response.ok) return Chart.fromJSON(await response.json(), level);
      } catch (error) {
        // Fall back to analyzing the audio if the chart cannot be loaded.
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 60));
    return new BeatAnalyzer(level).analyze(audioBuffer);
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
    this.audio.duck(0.35);
    this.audio.loopNow(level);

    this.recordResult(time);
  }

  update(deltaTime) {
    if (this.state !== 'play') return;

    const level = this.level;
    const chart = this.chart;
    const time = this.audio.time(level);

    chart.ensure(time);

    if (!this.noiseOn && time >= chart.voidStart) {
      this.noiseOn = true;
      this.audio.startNoise();
    }

    // The arrow tip is lethal. If either flank/base touches a wall first,
    // clamp angular movement at the last free position. Input is deliberately
    // left untouched: the held direction resumes as soon as the wall passes.
    const currentCollision=chart.collision(time,this.phi,this.mods.mapSpeed);
    if(currentCollision?.type==='tip'){
      this.die(time);
      return;
    }

    const direction=this.input.R-this.input.L;
    const angularVelocity=direction*(level.turnRate??8.5)*this.mods.playerSpeed;
    const angularDelta=angularVelocity*deltaTime;
    const substeps=Math.max(1,Math.ceil(Math.abs(angularDelta)/.012));
    let sideBlocked=false;

    for(let step=1;step<=substeps;step++){
      const candidate=this.phi+angularDelta/substeps;
      const collision=chart.collision(time,candidate,this.mods.mapSpeed);
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

    if(time >= (chart.stageEnd ?? chart.dur) - 0.05){
      this.complete(time);
    }
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
      this.lastDraw = now;
    }
    requestAnimationFrame((nextFrameTime) => this.loop(nextFrameTime));
  }
}
