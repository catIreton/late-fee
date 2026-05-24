export class SoundEngine {
  private nodes: AudioNode[] = [];

  constructor(private readonly ctx: AudioContext | null) {}

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    freqFrom?: number,
    delaySec = 0,
  ): void {
    if (!this.ctx) return;
    const { ctx } = this;
    const now = ctx.currentTime + delaySec;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqFrom ?? freq, now);
    if (freqFrom !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(freq, now + dur * 0.5);
    }
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.05);
  }

  /** Checkout success — two quick ascending pings */
  ding(): void {
    this.tone(880, 0.12, 'sine', 0.22);
    this.tone(1320, 0.22, 'sine', 0.18, undefined, 0.11);
  }

  /** Miss — descending buzz */
  buzz(): void {
    this.tone(240, 0.3, 'sawtooth', 0.10, 320);
  }

  /** Door chime — ascending bell triad */
  chime(): void {
    this.tone(523, 0.7, 'sine', 0.14);
    this.tone(659, 0.7, 'sine', 0.11, undefined, 0.14);
    this.tone(784, 0.9, 'sine', 0.09, undefined, 0.28);
  }

  /** VHS rewind — short low whir */
  rewind(): void {
    this.tone(120, 0.35, 'sawtooth', 0.07, 70);
  }

  /** Ambient store music — Dm drone + vinyl crackle */
  startMusic(): void {
    if (!this.ctx) return;
    const { ctx } = this;
    const now = ctx.currentTime;

    [73.4, 110.0].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.value = [0.05, 0.035][i];
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      this.nodes.push(osc, gain);
    });

    const sr = ctx.sampleRate;
    const buf = ctx.createBuffer(1, sr * 4, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() < 0.0006
        ? (Math.random() - 0.5) * 0.55
        : (Math.random() - 0.5) * 0.002;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const crackleGain = ctx.createGain();
    crackleGain.gain.value = 0.06;
    src.connect(crackleGain);
    crackleGain.connect(ctx.destination);
    src.start(now);
    this.nodes.push(src, crackleGain);
  }

  stopMusic(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.nodes.forEach(n => {
      try {
        if (n instanceof GainNode) {
          n.gain.setTargetAtTime(0, now, 0.1);
        } else if ('stop' in n) {
          (n as OscillatorNode).stop(now + 0.5);
        }
      } catch { /* already stopped */ }
    });
    const captured = this.nodes;
    this.nodes = [];
    setTimeout(() => captured.forEach(n => { try { n.disconnect(); } catch {} }), 700);
  }
}
