// Gaming-style enhanced sounds for kids using Web Audio API
class SoundManager {
  private ctx: AudioContext | null = null;
  private enabled = true;

  constructor() {
    this.enabled = typeof window !== 'undefined' && localStorage.getItem('soundEnabled') !== 'false';
  }

  setEnabled(v: boolean) {
    this.enabled = v;
    localStorage.setItem('soundEnabled', String(v));
  }

  isEnabled() { return this.enabled; }

  private getCtx(): AudioContext | null {
    if (!this.enabled) return null;
    try {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    } catch { return null; }
  }

  private tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.25, delay = 0) {
    const ctx = this.getCtx();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
      gain.gain.setValueAtTime(0, ctx.currentTime + delay);
      gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + delay + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + dur);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + dur + 0.05);
    } catch { /* silent fail */ }
  }

  // Soft bubbly click
  click() {
    this.tone(800, 0.06, 'sine', 0.1);
    this.tone(1000, 0.04, 'sine', 0.06, 0.04);
  }

  // Super happy correct! Mario-style ascending
  correct() {
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((f, i) => this.tone(f, 0.15, 'sine', 0.3, i * 0.08));
  }

  // Sad trombone but soft
  wrong() {
    this.tone(330, 0.2, 'triangle', 0.2);
    this.tone(277, 0.3, 'triangle', 0.18, 0.2);
  }

  // Big rainbow celebration fanfare
  celebrate() {
    const melody = [523, 659, 784, 1047, 1319, 1568, 2093];
    melody.forEach((f, i) => this.tone(f, 0.18, 'sine', 0.38, i * 0.06));
    const harmony = [659, 784, 988, 1319, 1568];
    harmony.forEach((f, i) => this.tone(f, 0.15, 'triangle', 0.15, 0.1 + i * 0.08));
  }

  start() {
    [523, 659, 784].forEach((f, i) => this.tone(f, 0.18, 'sine', 0.25, i * 0.1));
  }

  stop() {
    [784, 659, 523].forEach((f, i) => this.tone(f, 0.18, 'sine', 0.2, i * 0.1));
  }

  flip() {
    this.tone(1200, 0.04, 'sine', 0.15);
    this.tone(900, 0.06, 'sine', 0.12, 0.04);
  }
}

export const sounds = new SoundManager();
