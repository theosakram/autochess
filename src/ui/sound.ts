// Sound effects, synthesized with Web Audio: no files to load. The context starts on the first pointer press
// (browsers keep audio locked until the player interacts), and every call is a no-op where there's no audio at all
// (tests, old browsers).

const VOLUME = 0.5;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;

function audio(): { ctx: AudioContext; out: GainNode; noise: AudioBuffer } | null {
  if (!ctx) {
    if (typeof AudioContext === 'undefined') return null;
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = VOLUME;
    master.connect(ctx.destination);
    // One second of white noise, reused by every scrape.
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state !== 'running') return null;
  return { ctx, out: master!, noise: noise! };
}

if (typeof window !== 'undefined') {
  const unlock = () => {
    if (typeof AudioContext === 'undefined') return;
    if (!ctx) audio();
    void ctx?.resume();
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}

// ---------- blade "shing"

// A blade's ring is noise, not a note: hiss pushed through a few very narrow, high bands at uneven spacings, so it
// shimmers like steel without a pitch you could hum (pure tones read as a bell or a keyboard).
const STEEL = [3900, 5600, 7700, 10300, 13100];

let lastShing = -Infinity;
let shingStep = 0;

// A blade whipping past: a click of contact, a bright "sh" sweeping up, then a short steely "ing". Back-to-back shings
// (a dash chain) brighten a touch, shing-shing-SHING. `ghost` adds a darker echo trailing behind (Lance's Phantom).
export function shing(ghost = false): void {
  const a = audio();
  if (!a) return;
  const now = a.ctx.currentTime;
  if (now - lastShing < 0.04) return; // a fast-forwarded burst: one is enough
  shingStep = now - lastShing < 0.6 ? Math.min(shingStep + 1, 3) : 0;
  lastShing = now;

  const bright = 2 ** (shingStep / 12) * (1 + (Math.random() - 0.5) * 0.04);
  blade(a, now, bright, 1);
  if (ghost) blade(a, now + 0.08, bright * 0.88, 0.4);
}

type Audio = NonNullable<ReturnType<typeof audio>>;

// Noise from a random spot in the buffer, through `filters` in series, shaped by an envelope; returns the gain to shape.
function hiss(a: Audio, t: number, length: number, into: AudioNode, ...filters: BiquadFilterNode[]): GainNode {
  const src = a.ctx.createBufferSource();
  src.buffer = a.noise;
  const g = a.ctx.createGain();
  g.gain.value = 0;
  let node: AudioNode = src;
  for (const f of filters) node = node.connect(f);
  node.connect(g).connect(into);
  src.start(t, Math.random() * (1 - length));
  src.stop(t + length);
  return g;
}

function filter(a: Audio, type: BiquadFilterType, freq: number, q = 1): BiquadFilterNode {
  const f = a.ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}

function blade(a: Audio, t: number, bright: number, level: number): void {
  const bus = a.ctx.createGain();
  bus.gain.value = level;
  bus.connect(a.out);

  // Contact: a tiny tick of high noise.
  const click = hiss(a, t, 0.02, bus, filter(a, 'highpass', 4000));
  click.gain.setValueAtTime(0.5, t);
  click.gain.exponentialRampToValueAtTime(0.001, t + 0.012);

  // "sh": bright hiss, its band racing upward as the edge slides.
  const band = filter(a, 'bandpass', 3000 * bright, 1.2);
  band.frequency.exponentialRampToValueAtTime(11000 * bright, t + 0.1);
  const sh = hiss(a, t, 0.2, bus, filter(a, 'highpass', 2500), band);
  sh.gain.setValueAtTime(0.0001, t);
  sh.gain.exponentialRampToValueAtTime(0.4, t + 0.03);
  sh.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

  // "ing": the same hiss rung through narrow steel bands, each gliding up a hair; the highest fade first.
  const ringAt = t + 0.035;
  STEEL.forEach((freq, i) => {
    const f = freq * bright;
    const res = filter(a, 'bandpass', f * 0.97, 70);
    res.frequency.exponentialRampToValueAtTime(f, ringAt + 0.06);
    const decay = 0.32 - i * 0.04;
    const g = hiss(a, ringAt, decay + 0.02, bus, res);
    g.gain.setValueAtTime(0.0001, ringAt);
    g.gain.exponentialRampToValueAtTime(2.2 / (1 + i * 0.25), ringAt + 0.01); // narrow bands pass little: boost
    g.gain.exponentialRampToValueAtTime(0.0005, ringAt + decay);
  });
}

// ---------- Odette's Starfall Aegis

// A bell-like note: a sine and a quieter inharmonic partial (bells ring at about 2.76x), struck and dying away.
function bell(a: Audio, t: number, freq: number, decay: number, level: number, into: AudioNode): void {
  for (const [ratio, share] of [[1, 1], [2.76, 0.3]] as const) {
    const o = a.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq * ratio;
    const g = a.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level * share, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay / ratio);
    o.connect(g).connect(into);
    o.start(t);
    o.stop(t + decay + 0.05);
  }
}

// Every enemy is struck at once, and its stars land within a beat of each other: one sound per wave is plenty.
const STAR_GAP = 0.2; // seconds
let lastWhoosh = -Infinity;
let lastStrike = -Infinity;

// The cast: a celesta run rising up a major chord, an airy shimmer swelling behind it.
export function starChime(): void {
  const a = audio();
  if (!a) return;
  const now = a.ctx.currentTime;
  const bus = a.ctx.createGain();
  bus.gain.value = 0.5;
  bus.connect(a.out);
  [1046.5, 1318.5, 1568, 2093, 2637].forEach((f, i) => bell(a, now + i * 0.075, f, 1.1, 0.22, bus));
  const air = hiss(a, now, 0.9, bus, filter(a, 'highpass', 6000));
  air.gain.setValueAtTime(0.0001, now);
  air.gain.exponentialRampToValueAtTime(0.08, now + 0.35);
  air.gain.exponentialRampToValueAtTime(0.0005, now + 0.85);
}

// A wave of stars dropping: a soft whistle gliding down.
export function starWhoosh(): void {
  const a = audio();
  if (!a) return;
  const now = a.ctx.currentTime;
  if (now - lastWhoosh < STAR_GAP) return;
  lastWhoosh = now;
  const o = a.ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(2600 * (1 + (Math.random() - 0.5) * 0.06), now);
  o.frequency.exponentialRampToValueAtTime(800, now + 0.28);
  const g = a.ctx.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.05, now + 0.06);
  g.gain.exponentialRampToValueAtTime(0.0005, now + 0.3);
  o.connect(g).connect(a.out);
  o.start(now);
  o.stop(now + 0.32);
}

// ...and landing: a bright tink with a speck of sparkle.
export function starStrike(): void {
  const a = audio();
  if (!a) return;
  const now = a.ctx.currentTime;
  if (now - lastStrike < STAR_GAP) return;
  lastStrike = now;
  const bus = a.ctx.createGain();
  bus.gain.value = 0.6;
  bus.connect(a.out);
  bell(a, now, 1760 * (1 + (Math.random() - 0.5) * 0.08), 0.4, 0.2, bus);
  const spark = hiss(a, now, 0.08, bus, filter(a, 'highpass', 7000));
  spark.gain.setValueAtTime(0.12, now);
  spark.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
}
