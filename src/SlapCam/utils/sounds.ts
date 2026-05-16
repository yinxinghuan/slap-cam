let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (ctx) return ctx;
  try {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

export function resumeAudio() {
  const c = getCtx();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}

/** Cartoon slap: noise burst + descending sine boing. Pitch rises with combo for chain energy. */
export function playSlap(combo: number) {
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;

  // 1) Noise burst (the "thwack")
  const dur = 0.09;
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / data.length;
    data[i] = (Math.random() * 2 - 1) * (1 - t) * (1 - t);
  }
  const noise = c.createBufferSource();
  noise.buffer = buf;
  const noiseGain = c.createGain();
  noiseGain.gain.setValueAtTime(0.45, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + dur);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1800;
  noise.connect(lp).connect(noiseGain).connect(c.destination);
  noise.start(now);

  // 2) Boing tone: pitch rises with combo
  const basePitch = 220 + Math.min(combo, 12) * 35;
  const osc = c.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(basePitch * 1.6, now);
  osc.frequency.exponentialRampToValueAtTime(basePitch * 0.5, now + 0.18);
  const oscGain = c.createGain();
  oscGain.gain.setValueAtTime(0.22, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  osc.connect(oscGain).connect(c.destination);
  osc.start(now);
  osc.stop(now + 0.22);
}

/** Edge bounce: short percussive thump */
export function playBounce() {
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(120, now);
  osc.frequency.exponentialRampToValueAtTime(40, now + 0.08);
  const g = c.createGain();
  g.gain.setValueAtTime(0.12, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
  osc.connect(g).connect(c.destination);
  osc.start(now);
  osc.stop(now + 0.12);
}

/** Game over fanfare */
export function playEnd() {
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C E G C
  notes.forEach((f, i) => {
    const osc = c.createOscillator();
    osc.type = 'square';
    osc.frequency.value = f;
    const g = c.createGain();
    const t0 = now + i * 0.09;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + 0.2);
  });
}

/** Countdown blip */
export function playBlip(high = false) {
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;
  const osc = c.createOscillator();
  osc.type = 'square';
  osc.frequency.value = high ? 880 : 440;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.15, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  osc.connect(g).connect(c.destination);
  osc.start(now);
  osc.stop(now + 0.14);
}

// ────────────────────────────────────────────────────────────────────────────
// CIRCUS OOMPA BGM
// 4-bar loop in C major, 110 BPM. I-IV-I-V7 chord progression.
// Tuba oom-pah bass + accordion melody + military snare + tambourine + cymbal crash.
// Pre-rendered to AudioBuffer then looped.
// ────────────────────────────────────────────────────────────────────────────

const BPM = 110;
const BARS = 4;
const TOTAL_BEATS = BARS * 4;

function beatT(beat: number): number { return beat * 60 / BPM; }

const N: Record<string, number> = {
  C2: 65.41, D2: 73.42, E2: 82.41, F2: 87.31, G2: 98, A2: 110, B2: 123.47,
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196, A3: 220, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392, A4: 440, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880, B5: 987.77,
  C6: 1046.5,
};

/** Tuba note — fat brassy low bass with attack puff */
function playTuba(ctx: BaseAudioContext, dest: AudioNode, t: number, freq: number, dur: number) {
  // Main body: sawtooth (brassy) with low-pass to tame harshness
  const saw = ctx.createOscillator();
  saw.type = 'sawtooth'; saw.frequency.value = freq;
  const sub = ctx.createOscillator();
  sub.type = 'sine'; sub.frequency.value = freq;  // sine reinforcement at fundamental
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.6, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.35, t + 0.08);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  const lpf = ctx.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.setValueAtTime(450, t);
  lpf.frequency.exponentialRampToValueAtTime(280, t + dur);
  saw.connect(g); sub.connect(g);
  g.connect(lpf).connect(dest);
  saw.start(t); sub.start(t);
  saw.stop(t + dur + 0.02); sub.stop(t + dur + 0.02);
  // Attack puff (breath transient)
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.03), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.18, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
  const npf = ctx.createBiquadFilter();
  npf.type = 'bandpass'; npf.frequency.value = 600; npf.Q.value = 1;
  noise.connect(npf).connect(ng).connect(dest);
  noise.start(t);
}

/** Accordion note — reedy sustained with subtle vibrato */
function playAccordion(ctx: BaseAudioContext, dest: AudioNode, t: number, freq: number, dur: number) {
  // Two slightly detuned saws + square for reedy thickness
  const oscs = [
    { type: 'sawtooth', detune: 0 },
    { type: 'sawtooth', detune: 8 },
    { type: 'square',   detune: -6 },
  ];
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.16, t + 0.025);
  g.gain.linearRampToValueAtTime(0.13, t + dur - 0.08);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  // Vibrato LFO modulates pitch
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 5.5;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = freq * 0.008;  // ±0.8% pitch
  lfo.connect(lfoGain);
  lfo.start(t); lfo.stop(t + dur + 0.05);
  for (const o of oscs) {
    const osc = ctx.createOscillator();
    osc.type = o.type as OscillatorType;
    osc.frequency.value = freq;
    osc.detune.value = o.detune;
    lfoGain.connect(osc.frequency);
    osc.connect(g);
    osc.start(t); osc.stop(t + dur + 0.05);
  }
  const lpf = ctx.createBiquadFilter();
  lpf.type = 'lowpass'; lpf.frequency.value = 2800;
  g.connect(lpf).connect(dest);
}

/** Military snare — tight crisp snap */
function playMilSnare(ctx: BaseAudioContext, dest: AudioNode, t: number) {
  const dur = 0.08;
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  const hpf = ctx.createBiquadFilter();
  hpf.type = 'highpass'; hpf.frequency.value = 2000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.35, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  noise.connect(hpf).connect(g).connect(dest);
  noise.start(t);
}

/** Tambourine shake — short jingle */
function playTambourine(ctx: BaseAudioContext, dest: AudioNode, t: number, accent: boolean) {
  const dur = 0.04;
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  const hpf = ctx.createBiquadFilter();
  hpf.type = 'highpass'; hpf.frequency.value = 8000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(accent ? 0.14 : 0.07, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  noise.connect(hpf).connect(g).connect(dest);
  noise.start(t);
}

/** Cymbal crash — long noise tail */
function playCymbal(ctx: BaseAudioContext, dest: AudioNode, t: number) {
  const dur = 0.7;
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  const hpf = ctx.createBiquadFilter();
  hpf.type = 'highpass'; hpf.frequency.value = 4500;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.22, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  noise.connect(hpf).connect(g).connect(dest);
  noise.start(t);
}

async function renderBgmBuffer(): Promise<AudioBuffer> {
  const sr = 44100;
  const total = beatT(TOTAL_BEATS); // exact loop length, no tail (so loop seams cleanly)
  const offline = new OfflineAudioContext(2, Math.ceil(sr * total), sr);
  const master = offline.createGain();
  master.gain.value = 0.9;
  master.connect(offline.destination);

  // ── Tuba oom-pah bass ──
  // Pattern: root - 5th - root - 5th on every beat (4 hits per bar)
  // Chord progression: C → F → C → G7
  const tubaPattern: Array<[number, string]> = [
    // Bar 1 (C): root C2, 5th G2
    [0, 'C2'], [1, 'G2'], [2, 'C2'], [3, 'G2'],
    // Bar 2 (F): root F2, 5th C3
    [4, 'F2'], [5, 'C3'], [6, 'F2'], [7, 'C3'],
    // Bar 3 (C)
    [8, 'C2'], [9, 'G2'], [10, 'C2'], [11, 'G2'],
    // Bar 4 (G7): root G2, b7 F3, 5th D3
    [12, 'G2'], [13, 'D3'], [14, 'G2'], [15, 'F3'],
  ];
  for (const [beat, note] of tubaPattern) {
    playTuba(offline, master, beatT(beat), N[note]!, 0.38);
  }

  // ── Accordion melody ──
  // Classic circus-y rising/falling phrases over each chord.
  // Eighth notes (8 per bar = 32 total).
  const melody: Array<[number, string, number]> = [
    // Bar 1 (C major): C-E-G-E rising-falling
    [0,    'E5', 0.45], [0.5,  'G5', 0.45], [1,    'C6', 0.4 ], [1.5,  'G5', 0.4 ],
    [2,    'E5', 0.45], [2.5,  'C5', 0.45], [3,    'E5', 0.4 ], [3.5,  'G5', 0.4 ],
    // Bar 2 (F): F-A-C with trill
    [4,    'F5', 0.45], [4.5,  'A5', 0.45], [5,    'C6', 0.4 ], [5.5,  'A5', 0.4 ],
    [6,    'F5', 0.45], [6.5,  'A5', 0.45], [7,    'F5', 0.4 ], [7.5,  'C5', 0.4 ],
    // Bar 3 (C): high run
    [8,    'G5', 0.45], [8.5,  'C6', 0.45], [9,    'E6_OR_G5', 0.4 ], [9.5,  'C6', 0.4 ],
    [10,   'G5', 0.45], [10.5, 'E5', 0.45], [11,   'C5', 0.4 ], [11.5, 'E5', 0.4 ],
    // Bar 4 (G7): trill into resolution
    [12,   'D5', 0.45], [12.5, 'F5', 0.45], [13,   'G5', 0.4 ], [13.5, 'F5', 0.4 ],
    [14,   'D5', 0.45], [14.5, 'B4', 0.45], [15,   'D5', 0.5 ], [15.5, 'F5', 0.5 ],
  ];
  for (const [beat, note, dur] of melody) {
    // Special case for high note above scale dict
    let freq = N[note];
    if (note === 'E6_OR_G5') freq = N.G5;  // safe fallback
    if (!freq) continue;
    playAccordion(offline, master, beatT(beat), freq, dur);
  }

  // ── Snare on beats 2 and 4 ──
  for (let bar = 0; bar < BARS; bar++) {
    const b = bar * 4;
    playMilSnare(offline, master, beatT(b + 1));
    playMilSnare(offline, master, beatT(b + 3));
  }

  // ── Tambourine on every 8th (accent on downbeats) ──
  for (let bar = 0; bar < BARS; bar++) {
    const b = bar * 4;
    for (let i = 0; i < 8; i++) {
      playTambourine(offline, master, beatT(b + i * 0.5), i === 0 || i === 4);
    }
  }

  // ── Cymbal crash on bar 1 (start of loop) for that "showtime" entrance ──
  playCymbal(offline, master, beatT(0));

  return offline.startRendering();
}

// ── BGM playback state ───────────────────────────────────────────────────────

let bgmBuffer: AudioBuffer | null = null;
let bgmSource: AudioBufferSourceNode | null = null;
let bgmGain: GainNode | null = null;
let bgmRendering: Promise<void> | null = null;
const BGM_VOLUME = 0.45;

async function ensureBgmBuffer(): Promise<void> {
  if (bgmBuffer) return;
  if (bgmRendering) return bgmRendering;
  bgmRendering = renderBgmBuffer()
    .then(buf => { bgmBuffer = buf; })
    .catch(() => {})
    .finally(() => { bgmRendering = null; });
  return bgmRendering;
}

/** Pre-warm the BGM buffer (call early so playback starts instantly later). */
export function preloadBgm() { ensureBgmBuffer(); }

export async function startBgm() {
  const c = getCtx();
  if (!c) return;
  await ensureBgmBuffer();
  if (!bgmBuffer) return;
  stopBgm(true);
  bgmSource = c.createBufferSource();
  bgmSource.buffer = bgmBuffer;
  bgmSource.loop = true;
  bgmGain = c.createGain();
  bgmGain.gain.value = 0.0001;
  bgmGain.gain.exponentialRampToValueAtTime(BGM_VOLUME, c.currentTime + 0.35);
  bgmSource.connect(bgmGain).connect(c.destination);
  bgmSource.start();
}

export function stopBgm(immediate = false) {
  const c = getCtx();
  if (!c || !bgmSource || !bgmGain) return;
  const now = c.currentTime;
  if (immediate) {
    try { bgmSource.stop(now); } catch {}
  } else {
    bgmGain.gain.cancelScheduledValues(now);
    bgmGain.gain.setValueAtTime(bgmGain.gain.value, now);
    bgmGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    try { bgmSource.stop(now + 0.5); } catch {}
  }
  bgmSource = null;
  bgmGain = null;
}

/** Briefly duck BGM (e.g. on big slap) for snappier SFX */
export function duckBgm(amount = 0.55, recoverMs = 140) {
  const c = getCtx();
  if (!c || !bgmGain) return;
  const now = c.currentTime;
  bgmGain.gain.cancelScheduledValues(now);
  bgmGain.gain.setValueAtTime(BGM_VOLUME * (1 - amount), now);
  bgmGain.gain.exponentialRampToValueAtTime(BGM_VOLUME, now + recoverMs / 1000);
}
