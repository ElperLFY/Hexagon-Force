import {
  SONG_DIR, MUSIC_CUE_DIR, SOUND_CUE_DIR, MUSIC_CUES, SOUND_CUES, VOID, VIS
} from './config.js';

// Level music and optional one-shot voice/UI cues use separate paths.
// The level soundtrack analyser intentionally listens to the level music only.
export class AudioManager {
  constructor() {
    this.vol = parseFloat(localStorage.getItem('hxv') ?? '.5');
    this.master = null;
    this.ctx = null;
    this.buf = {};
    this.src = null;
    this.gain = null;
    this.startAt = 0;
    this.noiseBuf = null;
    this.noiseMissing = false;
    this.noise = null;
    this.an = null;

    this.effects = null;
    this.cueBuffers = new Map();
    this.cueLoads = new Map();
    this.cueWarnings = new Set();
    this.sequenceToken = 0;
  }

  unlock() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.vol * this.vol;
      this.master.connect(this.ctx.destination);

      // Effects share the master volume for now, but never feed the music analyser.
      this.effects = this.ctx.createGain();
      this.effects.gain.value = 1;
      this.effects.connect(this.master);

      this.an = this.ctx.createAnalyser();
      this.an.fftSize = VIS.fft;
      this.an.smoothingTimeConstant = VIS.smoothing;
    }
    return this.ctx.resume();
  }

  setVolume(v) {
    this.vol = v;
    localStorage.setItem('hxv', v);
    if (this.master) this.master.gain.setTargetAtTime(v * v, this.ctx.currentTime, .02);
  }

  async load(L) {
    if (!this.buf[L.id]) {
      const url = `${SONG_DIR}${L.id}.mp3`;
      const response = await fetch(url).catch(() => null);
      if (!response || !response.ok) throw Error(url + ' non trovato');
      this.buf[L.id] = await this.ctx.decodeAudioData(await response.arrayBuffer());
    }
    return this.buf[L.id];
  }

  play(L, loop, ch) {
    // Start level music at L.offset; endless runs loop on a whole beat number.
    this.stopNoise();
    this.stop();
    const c = this.ctx;
    const buffer = this.buf[L.id];
    const source = c.createBufferSource();
    const gain = c.createGain();

    source.buffer = buffer;
    source.connect(gain).connect(this.master);
    if (this.an) gain.connect(this.an);

    if (loop) {
      source.loop = true;
      source.loopStart = L.offset;
      source.loopEnd = buffer.duration;
    } else if (ch) {
      const beatDuration = ch.beatDur;
      const firstBeat = ch.tg0 + Math.ceil((L.offset - ch.tg0) / beatDuration) * beatDuration;
      const beatCount = Math.floor((buffer.duration - .05 - firstBeat) / beatDuration);
      if (beatCount >= 8) {
        source.loop = true;
        source.loopStart = firstBeat;
        source.loopEnd = firstBeat + beatCount * beatDuration;
      }
    }

    this.startAt = c.currentTime + .2;
    source.start(this.startAt, L.offset);
    this.src = source;
    this.gain = gain;
  }

  loopNow(L) {
    if (this.src) {
      this.src.loop = true;
      this.src.loopStart = L.offset;
      this.src.loopEnd = this.buf[L.id].duration;
    }
  }

  async loadCue(folder, name) {
    const isMusicCue = folder === 'music';
    const allowed = isMusicCue ? MUSIC_CUES : folder === 'sounds' ? SOUND_CUES : [];
    const directory = isMusicCue ? MUSIC_CUE_DIR : folder === 'sounds' ? SOUND_CUE_DIR : null;
    if (!directory || !allowed.includes(name)) {
      throw new Error(`Unknown audio cue: ${folder}/${name}`);
    }

    const key = `${folder}/${name}`;
    if (this.cueBuffers.has(key)) return this.cueBuffers.get(key);
    if (this.cueLoads.has(key)) return this.cueLoads.get(key);

    const pending = (async () => {
      const url = `${directory}${name}.ogg`;
      try {
        if (!this.ctx) await this.unlock();
        const response = await fetch(url);
        if (!response.ok) throw new Error(`${url} (HTTP ${response.status})`);
        const buffer = await this.ctx.decodeAudioData(await response.arrayBuffer());
        this.cueBuffers.set(key, buffer);
        return buffer;
      } catch (error) {
        // Cue files are optional during development; a missing OGG must never block a run.
        this.cueBuffers.set(key, null);
        if (!this.cueWarnings.has(key)) {
          console.warn('[HEXBEAT] Optional audio cue unavailable:', url, error.message);
          this.cueWarnings.add(key);
        }
        return null;
      } finally {
        this.cueLoads.delete(key);
      }
    })();

    this.cueLoads.set(key, pending);
    return pending;
  }

  async preloadCues() {
    if (!this.ctx) return;
    const entries = [
      ...MUSIC_CUES.map(name => ['music', name]),
      ...SOUND_CUES.map(name => ['sounds', name])
    ];
    await Promise.all(entries.map(([folder, name]) => this.loadCue(folder, name)));
  }

  playCue(folder, name, { onEnded = null, sequenceToken = null } = {}) {
    this.loadCue(folder, name).then(buffer => {
      if (sequenceToken !== null && sequenceToken !== this.sequenceToken) return;
      if (!buffer) {
        onEnded?.();
        return;
      }
      if (!this.ctx || !this.effects) return;

      const source = this.ctx.createBufferSource();
      const gain = this.ctx.createGain();
      source.buffer = buffer;
      gain.gain.value = 1;
      source.connect(gain).connect(this.effects);
      source.onended = () => {
        if (sequenceToken === null || sequenceToken === this.sequenceToken) onEnded?.();
      };
      source.start();
    }).catch(error => {
      console.warn('[HEXBEAT] Audio cue failed:', error);
      onEnded?.();
    });
  }

  playMusicCue(name) {
    this.playCue('music', name);
  }

  playSound(name) {
    this.playCue('sounds', name);
  }

  // Start a group of one-shot clips on the exact same AudioContext time.
  // This is used for the paired "start" + spoken "begin" cue.
  playTogether(entries) {
    Promise.all(entries.map(([folder, name]) => this.loadCue(folder, name)))
      .then(buffers => {
        if (!this.ctx || !this.effects) return;
        const startAt = this.ctx.currentTime;
        for (const buffer of buffers) {
          if (!buffer) continue;
          const source = this.ctx.createBufferSource();
          const gain = this.ctx.createGain();
          source.buffer = buffer;
          gain.gain.value = 1;
          source.connect(gain).connect(this.effects);
          source.start(startAt);
        }
      })
      .catch(error => console.warn('[HEXBEAT] Paired audio cues failed:', error));
  }

  playSequence(entries) {
    const token = ++this.sequenceToken;
    const playNext = index => {
      if (token !== this.sequenceToken || index >= entries.length) return;
      const [folder, name] = entries[index];
      this.playCue(folder, name, {
        sequenceToken: token,
        onEnded: () => playNext(index + 1)
      });
    };
    playNext(0);
  }

  cancelSequences() {
    this.sequenceToken++;
  }

  // Noise of the Endless Void phase, looped from the flip until death.
  async loadNoise() {
    if (this.noiseBuf || this.noiseMissing) return this.noiseBuf;
    try {
      const url = SONG_DIR + VOID.noise.file;
      const response = await fetch(url);
      if (!response.ok) throw Error(url + ' non trovato');
      this.noiseBuf = await this.ctx.decodeAudioData(await response.arrayBuffer());
    } catch (error) {
      this.noiseMissing = true;
      console.warn('[HEXBEAT] noise disabled:', error.message);
    }
    return this.noiseBuf;
  }

  startNoise() {
    if (!this.noiseBuf || this.noise) return;
    const c = this.ctx;
    const source = c.createBufferSource();
    const gain = c.createGain();
    const noise = VOID.noise;

    source.buffer = this.noiseBuf;
    source.loop = true;
    gain.gain.setValueAtTime(0, c.currentTime);
    gain.gain.linearRampToValueAtTime(noise.gain, c.currentTime + noise.fade);
    source.connect(gain).connect(this.master);
    source.start();
    this.noise = { source, gain };
  }

  stopNoise() {
    const noise = this.noise;
    if (!noise) return;
    this.noise = null;
    noise.gain.gain.cancelScheduledValues(this.ctx.currentTime);
    noise.gain.gain.setTargetAtTime(0, this.ctx.currentTime, .05);
    setTimeout(() => {
      try { noise.source.stop(); } catch (error) {}
    }, 400);
  }

  duck(value) {
    if (this.gain) this.gain.gain.setTargetAtTime(value, this.ctx.currentTime, .05);
  }

  stop() {
    const source = this.src;
    if (!source) return;
    this.gain.gain.setTargetAtTime(0, this.ctx.currentTime, .04);
    setTimeout(() => {
      try { source.stop(); } catch (error) {}
    }, 250);
    this.src = null;
  }

  time(L) {
    return this.ctx.currentTime - this.startAt + L.offset;
  }
}
