// Port do `Sound` do app legado (Web Audio, sem arquivos). Mantém a chave de mute original.
const KEY = 'urbaniza+_sound_muted';

type ToneOpts = { duration?: number; type?: OscillatorType; gain?: number; delay?: number; glideTo?: number | null };
export type SoundName = 'success' | 'error' | 'send' | 'notify' | 'click' | 'toggle';

let ctx: AudioContext | null = null;
let muted: boolean | null = null;
const listeners = new Set<() => void>();

function readMuted(): boolean {
  if (muted === null) {
    try { muted = localStorage.getItem(KEY) === '1'; } catch { muted = false; }
  }
  return muted;
}

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      ctx = Ctor ? new Ctor() : null;
    } catch { ctx = null; }
  }
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function tone(freq: number, opts: ToneOpts = {}) {
  const { duration = 0.12, type = 'sine', gain = 0.08, delay = 0, glideTo = null } = opts;
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + duration);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.014);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.03);
}

const EVENTS: Record<SoundName, () => void> = {
  success: () => { tone(659, { duration: 0.1, gain: 0.07 }); tone(880, { duration: 0.16, gain: 0.07, delay: 0.09 }); },
  error: () => { tone(330, { duration: 0.17, gain: 0.08, glideTo: 210 }); },
  send: () => { tone(520, { duration: 0.09, gain: 0.06, glideTo: 780 }); },
  notify: () => { tone(740, { duration: 0.1, gain: 0.05 }); tone(988, { duration: 0.13, gain: 0.045, delay: 0.075 }); },
  click: () => { tone(600, { duration: 0.045, gain: 0.045 }); },
  toggle: () => { tone(480, { duration: 0.08, gain: 0.06 }); },
};

export const Sound = {
  play(name: SoundName) {
    if (readMuted()) return;
    try { EVENTS[name](); } catch { /* sem áudio: segue sem som */ }
  },
  isMuted: readMuted,
  toggle() {
    muted = !readMuted();
    try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch { /* storage bloqueado */ }
    listeners.forEach((l) => l());
    if (!muted) this.play('toggle');
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => { listeners.delete(l); };
  },
};
