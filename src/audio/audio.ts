// Synthesized sound (GAME_DESIGN §16): WebAudio only, no samples to license. Sounds triggered while time
// is slow play lower and longer, and the music (a drone and a beat) runs at the speed of game time,
// clamped to 0.25–1, so standing still sounds frozen too.

export type SfxName =
  | 'shot' | 'shotgun' | 'redShot' | 'punch' | 'whiff' | 'shatter' | 'glass' | 'coin' | 'pickup' | 'throw'
  | 'parry' | 'tell' | 'death' | 'clear' | 'shield' | 'dash' | 'rewind' | 'hover' | 'click' | 'door'
  | 'wave' | 'deflect' | 'break' | 'phase' | 'star' | 'tick' | 'buy' | 'deny' | 'stun';

export class Sound {
  private ctx: AudioContext | null = null;
  private sfx!: GainNode;
  private music!: GainNode;
  private noise!: AudioBuffer;
  private drone: OscillatorNode[] = [];
  private droneFilter!: BiquadFilterNode;
  private beat = 0;
  private bar = 0;
  /** the current time rate for sounds, 0.35..1 */
  rate = 1;
  sfxVol = 0.8;
  musicVol = 0.6;
  voice = true;
  /** music on (levels and menus) */
  playing = false;

  /** Browsers only allow audio after a click or key; call this from one. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
    } catch {
      return;
    }
    const c = this.ctx;
    const master = c.createDynamicsCompressor();
    master.connect(c.destination);
    this.sfx = c.createGain();
    this.sfx.gain.value = this.sfxVol;
    this.sfx.connect(master);
    this.music = c.createGain();
    this.music.gain.value = this.musicVol * 0.5;
    this.music.connect(master);
    this.noise = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = this.noise.getChannelData(0);
    let s = 12345;
    for (let i = 0; i < d.length; i++) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      d[i] = (s / 0x7fffffff) * 2 - 1;
    }
    this.droneFilter = c.createBiquadFilter();
    this.droneFilter.type = 'lowpass';
    this.droneFilter.frequency.value = 260;
    const dg = c.createGain();
    dg.gain.value = 0.18;
    this.droneFilter.connect(dg).connect(this.music);
    for (const f of [55, 55.35, 82.5]) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.connect(this.droneFilter);
      o.start();
      this.drone.push(o);
    }
  }

  setVolumes(sfx: number, music: number) {
    this.sfxVol = sfx;
    this.musicVol = music;
    if (!this.ctx) return;
    this.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.05);
    this.music.gain.setTargetAtTime(music * 0.5, this.ctx.currentTime, 0.05);
  }

  /** Once per frame: the music follows game time. `scale` is the time scale (0 when paused). */
  update(realDt: number, scale: number) {
    const c = this.ctx;
    if (!c) return;
    const r = this.playing ? Math.max(0.25, Math.min(1, scale)) : 0;
    this.rate = Math.max(0.35, Math.min(1, 0.35 + 0.65 * scale));
    const t = c.currentTime;
    this.drone.forEach((o, i) => o.frequency.setTargetAtTime([55, 55.35, 82.5][i] * (0.5 + 0.5 * Math.max(r, 0.25)), t, 0.08));
    this.droneFilter.frequency.setTargetAtTime(120 + 400 * r, t, 0.1);
    if (!this.playing) return;
    // 112 bpm at full speed, in sixteenths
    const before = this.beat;
    this.beat += realDt * r * (112 / 60) * 4;
    if (Math.floor(this.beat) !== Math.floor(before)) this.step(Math.floor(this.beat) % 16, r);
  }

  private step(i: number, r: number) {
    if (i === 0) this.bar++;
    if (i % 4 === 0) this.kick(r);
    if (i % 4 === 2) this.hat(0.05 * r);
    if (i === 6 || i === 14) this.hat(0.03);
    const bass = [55, 0, 0, 55, 0, 0, 65.4, 0, 55, 0, 0, 73.4, 0, 65.4, 0, 49][i];
    if (bass) this.tone('triangle', bass * (0.5 + r * 0.5), bass * (0.5 + r * 0.5), 0.18 / Math.max(r, 0.4), 0.12, this.music);
  }

  private kick(r: number) {
    this.tone('sine', 110 * (0.6 + 0.4 * r), 38, 0.22, 0.5, this.music);
  }

  private hat(vol: number) {
    this.noiseBurst(0.04, vol, 7000, 'highpass', this.music);
  }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, dest?: AudioNode, at = 0) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + at;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest ?? this.sfx);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private noiseBurst(dur: number, vol: number, freq: number, type: BiquadFilterType, dest?: AudioNode, at = 0, q = 1) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + at;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.5 + Math.random();
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(dest ?? this.sfx);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  play(name: SfxName, vol = 1) {
    if (!this.ctx) return;
    const r = this.rate, d = 1 / r;
    switch (name) {
      case 'shot':
        this.noiseBurst(0.08 * d, 0.5 * vol, 1800 * r, 'highpass');
        this.tone('square', 180 * r, 40, 0.09 * d, 0.35 * vol);
        break;
      case 'shotgun':
        this.noiseBurst(0.18 * d, 0.7 * vol, 900 * r, 'lowpass');
        this.tone('square', 120 * r, 30, 0.16 * d, 0.4 * vol);
        break;
      case 'redShot':
        this.noiseBurst(0.07 * d, 0.35 * vol, 1200 * r, 'bandpass');
        this.tone('sawtooth', 240 * r, 60, 0.08 * d, 0.2 * vol);
        break;
      case 'punch':
        this.tone('sine', 140 * r, 40, 0.1 * d, 0.7 * vol);
        this.noiseBurst(0.05 * d, 0.3 * vol, 500, 'lowpass');
        break;
      case 'whiff':
        this.noiseBurst(0.08 * d, 0.12 * vol, 1500 * r, 'bandpass', undefined, 0, 3);
        break;
      case 'shatter': {
        this.noiseBurst(0.28 * d, 0.5 * vol, 4200 * r, 'highpass');
        this.tone('sine', 90 * r, 35, 0.2 * d, 0.5 * vol);
        for (let i = 0; i < 6; i++) this.tone('sine', (2200 + Math.random() * 3000) * r, 1800 * r, (0.25 + Math.random() * 0.35) * d, 0.08 * vol, undefined, i * 0.018 * d);
        break;
      }
      case 'glass':
        this.noiseBurst(0.2 * d, 0.35 * vol, 5000 * r, 'highpass');
        for (let i = 0; i < 4; i++) this.tone('sine', (3000 + Math.random() * 2500) * r, 2500 * r, 0.2 * d, 0.05 * vol, undefined, i * 0.02 * d);
        break;
      case 'coin':
        this.tone('square', 1320, 1320, 0.04, 0.06 * vol);
        this.tone('square', 1980, 1980, 0.07, 0.06 * vol, undefined, 0.045);
        break;
      case 'pickup':
        this.tone('square', 500 * r, 900 * r, 0.05 * d, 0.12 * vol);
        break;
      case 'throw':
        this.noiseBurst(0.14 * d, 0.25 * vol, 900 * r, 'bandpass', undefined, 0, 2);
        break;
      case 'parry':
        this.tone('sine', 2400 * r, 2300 * r, 0.35 * d, 0.2 * vol);
        this.tone('sine', 3600 * r, 3500 * r, 0.3 * d, 0.12 * vol);
        break;
      case 'tell':
        this.tone('triangle', 520 * r, 700 * r, 0.06 * d, 0.07 * vol);
        break;
      case 'death':
        this.tone('sine', 90, 25, 0.9, 0.8 * vol);
        this.noiseBurst(0.6, 0.4 * vol, 3000, 'highpass');
        for (let i = 0; i < 8; i++) this.tone('sine', 1500 + Math.random() * 3000, 1200, 0.5, 0.06 * vol, undefined, i * 0.03);
        break;
      case 'clear':
        [262, 330, 392, 523].forEach((f, i) => this.tone('square', f, f, 0.5, 0.06 * vol, undefined, i * 0.06));
        break;
      case 'shield':
        this.tone('sine', 1200 * r, 300 * r, 0.3 * d, 0.3 * vol);
        this.noiseBurst(0.15 * d, 0.2 * vol, 6000, 'highpass');
        break;
      case 'dash':
        this.tone('sawtooth', 1400, 200, 0.12, 0.12 * vol);
        this.noiseBurst(0.1, 0.15 * vol, 2500, 'bandpass');
        break;
      case 'rewind':
        this.tone('sawtooth', 300, 1200, 0.5, 0.1 * vol);
        this.tone('sawtooth', 310, 1180, 0.5, 0.08 * vol);
        break;
      case 'hover':
        this.tone('sine', 1500, 1500, 0.015, 0.03 * vol);
        break;
      case 'click':
        this.tone('square', 700, 900, 0.035, 0.07 * vol);
        break;
      case 'buy':
        [523, 659, 784].forEach((f, i) => this.tone('square', f, f, 0.12, 0.07 * vol, undefined, i * 0.05));
        break;
      case 'deny':
        this.tone('square', 180, 150, 0.15, 0.08 * vol);
        break;
      case 'door':
        this.tone('sine', 90 * r, 60 * r, 0.15 * d, 0.3 * vol);
        break;
      case 'wave':
        this.tone('sawtooth', 220, 220, 0.25, 0.08 * vol);
        this.tone('sawtooth', 330, 330, 0.3, 0.06 * vol, undefined, 0.12);
        break;
      case 'deflect':
        this.tone('square', 3000 * r, 2600 * r, 0.05 * d, 0.06 * vol);
        break;
      case 'break':
        this.noiseBurst(0.12 * d, 0.3 * vol, 2500 * r, 'bandpass');
        break;
      case 'phase':
        this.tone('sawtooth', 70, 50, 0.8, 0.25 * vol);
        this.noiseBurst(0.6, 0.2 * vol, 300, 'lowpass');
        break;
      case 'star':
        this.tone('square', 660, 990, 0.12, 0.09 * vol);
        this.tone('square', 990, 1320, 0.15, 0.07 * vol, undefined, 0.08);
        break;
      case 'tick':
        this.tone('square', 1400, 1400, 0.02, 0.04 * vol);
        break;
      case 'stun':
        this.tone('triangle', 900 * r, 1300 * r, 0.08 * d, 0.06 * vol);
        break;
    }
  }

  /** "STILL." / "FRAME.": a low formant hit, and the browser's voice if allowed. */
  chant(word: 'STILL' | 'FRAME') {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(word === 'STILL' ? 98 : 87, t);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    const merge = c.createGain();
    for (const f of word === 'STILL' ? [320, 2300] : [700, 1100]) {
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f;
      bp.Q.value = 6;
      o.connect(bp).connect(merge);
    }
    merge.connect(g).connect(this.sfx);
    o.start(t);
    o.stop(t + 0.5);
    this.noiseBurst(0.08, 0.15, word === 'STILL' ? 5000 : 2000, 'highpass');
    if (this.voice && 'speechSynthesis' in window) {
      try {
        const u = new SpeechSynthesisUtterance(word === 'STILL' ? 'Still.' : 'Frame.');
        u.pitch = 0;
        u.rate = 0.75;
        u.volume = Math.min(1, this.sfxVol);
        speechSynthesis.speak(u);
      } catch {
        // no voice: the synth hit is enough
      }
    }
  }
}
