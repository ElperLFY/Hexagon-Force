import { LEVELS, SONG_DIR, VOID } from './config.js';
import { Chart } from './PatternGenerator.js';
import { BeatAnalyzer } from './BeatAnalyzer.js';
import { AudioManager } from './AudioManager.js';
import { Renderer } from './Renderer.js';
import { Input } from './Input.js';
import { VolumeControl } from './VolumeControl.js';
import { ModMenu } from './ModMenu.js';
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
    this.noiseOn = false;
    this.mods = this.loadMods();

    this.audio = new AudioManager();
    this.view = new Renderer(canvas);
    this.input = new Input(this);
    this.volUI = new VolumeControl(this.audio);
    this.modMenu = new ModMenu(this);
    this.vis = new Visualizer(this.audio);
    this.fx = null;

    this.last = performance.now();
    requestAnimationFrame((now) => this.loop(now));
  }

  get level() {
    return LEVELS[this.lv];
  }

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
    if (this.state !== 'menu') return;

    this.lv = (this.lv + direction + LEVELS.length) % LEVELS.length;
    this.preview();
  }

  back() {
    if (this.state === 'gate' || this.state === 'load') return;

    this.audio.stopNoise();
    this.state = 'menu';
    this.preview();
  }

  pointer(x, y) {
    const state = this.state;

    if (state === 'gate') {
      this.confirm();
    } else if (state === 'menu' && this.modMenu.open) {
      // A tap outside the mod menu closes it.
      this.modMenu.setOpen(false);
    } else if (state === 'menu') {
      if (x < 0.25) this.nav(-1);
      else if (x > 0.75) this.nav(1);
      else this.confirm();
    } else if (state === 'dead' || state === 'win') {
      if (y < 0.15) this.back();
      else this.confirm();
    }
  }

  async play() {
    if (this.state === 'load') return;

    const level = this.level;
    this.tk++;
    this.state = 'load';
    this.msg = '';

    try {
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
      this.modMenu.setOpen(false);
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
  }

  // Load a precomputed chart when available; otherwise analyze the audio.
  async getChart(level, audioBuffer) {
    try {
      const response = await fetch(`${SONG_DIR}${level.id}.json`);
      if (response.ok) {
        return Chart.fromJSON(await response.json(), level);
      }
    } catch (error) {
      // Fall back to analyzing the audio if the chart cannot be loaded.
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

    const survivalTime = time - level.offset;
    if (!(this.best[this.lv] >= survivalTime)) {
      this.best[this.lv] = survivalTime;
      localStorage.setItem('hxb', JSON.stringify(this.best));
    }
  }

  update(deltaTime) {
    if (this.state !== 'play') return;

    const level = this.level;
    const chart = this.chart;
    const time = this.audio.time(level);

    this.phi +=
      (this.input.R - this.input.L) *
      (level.turnRate ?? 10) *
      this.mods.playerSpeed *
      deltaTime;

    chart.ensure(time);

    if (!this.noiseOn && time >= chart.voidStart) {
      this.noiseOn = true;
      this.audio.startNoise();
    }

    if (chart.hit(time, this.phi, this.mods.mapSpeed)) {
      this.die(time);
    } else if (time >= chart.dur - 0.05) {
      this.state = 'win';
      this.tF = time;
      this.preview();
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
    this.modMenu.show(this.state === 'menu');
    this.view.draw(this);
    requestAnimationFrame((nextFrameTime) => this.loop(nextFrameTime));
  }
}
