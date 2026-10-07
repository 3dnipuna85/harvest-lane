/**
 * All the game's audio, synthesized with WebAudio (no files to download or license): sound effects and a
 * gentle looping farm tune. Music and effects each have an on/off switch, remembered per browser.
 * Browsers only allow sound after the player has tapped once.
 */
const KEY = 'harvest-lane-audio';
type Prefs = { music: boolean; sfx: boolean };
function loadPrefs(): Prefs {
  try { const p = JSON.parse(localStorage.getItem(KEY) || '{}'); return { music: p.music !== false, sfx: p.sfx !== false }; } catch { return { music: true, sfx: true }; }
}
export const prefs = loadPrefs();
function savePrefs() { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* storage blocked */ } }

let ac: AudioContext | null = null, sfxBus: GainNode, musicBus: GainNode;
let unlocked = false;

function ctx() {
  if (!ac) {
    ac = new AudioContext();
    sfxBus = ac.createGain(); sfxBus.gain.value = prefs.sfx ? 1 : 0; sfxBus.connect(ac.destination);
    musicBus = ac.createGain(); musicBus.gain.value = 0; musicBus.connect(ac.destination);
  }
  return ac;
}

addEventListener('pointerdown', () => {
  unlocked = true;
  try { ctx().resume(); if (prefs.music) startMusic(); } catch { /* no audio */ }
}, { once: true });

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'square', vol = 0.06, bus = sfxBus, slide = 0) {
  const a = ac!, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, start);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), start + dur);
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(vol, start + Math.min(0.02, dur / 4));
  g.gain.exponentialRampToValueAtTime(0.0008, start + dur);
  o.connect(g).connect(bus);
  o.start(start); o.stop(start + dur + 0.02);
}

let noiseBuf: AudioBuffer | null = null;
function noise(start: number, dur: number, vol = 0.05, freq = 1800, bus = sfxBus) {
  const a = ac!;
  if (!noiseBuf) {
    noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  s.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
  g.gain.setValueAtTime(vol, start); g.gain.exponentialRampToValueAtTime(0.0008, start + dur);
  s.connect(f).connect(g).connect(bus);
  s.start(start, Math.random() * 0.5); s.stop(start + dur);
}

/** Run a sound effect if audio is allowed and switched on. */
function fx(play: (t: number) => void) {
  if (!unlocked || !prefs.sfx) return;
  try { play(ctx().currentTime); } catch { /* no audio */ }
}

/** Two friendly beeps, or one long angry blast. */
export const honk = (angry = false) => fx(t => {
  if (angry) { tone(220, t, 0.7, 'square', 0.05); tone(233, t, 0.7, 'sawtooth', 0.03); }
  else { tone(392, t, 0.16); tone(392, t + 0.24, 0.2); tone(494, t, 0.16, 'triangle', 0.03); tone(494, t + 0.24, 0.2, 'triangle', 0.03); }
});
/** A short coin jingle for a loaded truck. */
export const chaChing = () => fx(t => [988, 1319, 1568].forEach((f, i) => tone(f, t + i * 0.07, 0.18, 'triangle', 0.05)));
export const sfxPlant = () => fx(t => { noise(t, 0.12, 0.05, 700); tone(330, t + 0.02, 0.12, 'sine', 0.05, sfxBus, 1.5); });
export const sfxHarvest = () => fx(t => { tone(520, t, 0.1, 'sine', 0.07, sfxBus, 1.8); tone(880, t + 0.06, 0.12, 'triangle', 0.03); });
export const sfxCoin = () => fx(t => { tone(1319, t, 0.08, 'triangle', 0.04); tone(1760, t + 0.05, 0.12, 'triangle', 0.035); });
export const sfxBell = () => fx(t => { tone(1047, t, 0.5, 'sine', 0.05); tone(2093, t, 0.3, 'sine', 0.015); });
export const sfxCluck = () => fx(t => { tone(700, t, 0.07, 'square', 0.03, sfxBus, 0.6); tone(820, t + 0.09, 0.09, 'square', 0.03, sfxBus, 0.55); });
export const sfxSplash = () => fx(t => { noise(t, 0.35, 0.08, 1200); noise(t + 0.05, 0.25, 0.04, 3000); });
export const sfxCatch = () => fx(t => [659, 784, 988, 1319].forEach((f, i) => tone(f, t + i * 0.06, 0.16, 'triangle', 0.045)));
export const sfxBuzz = () => fx(t => { tone(150, t, 0.18, 'sawtooth', 0.04); tone(140, t + 0.12, 0.2, 'sawtooth', 0.04); });
export const sfxThud = () => fx(t => { tone(120, t, 0.3, 'sine', 0.09, sfxBus, 0.5); noise(t, 0.2, 0.05, 400); });
export const sfxGem = () => fx(t => [1568, 2093, 2637, 3136].forEach((f, i) => tone(f, t + i * 0.05, 0.25, 'sine', 0.03)));
export const sfxTap = () => fx(t => tone(880, t, 0.04, 'sine', 0.025, sfxBus, 1.3));
export const sfxLevelUp = () => fx(t => {
  [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.11, 0.22, 'square', 0.035));
  [1047, 1319, 1568].forEach(f => tone(f, t + 0.5, 0.7, 'triangle', 0.03));
});
export const sfxChop = () => fx(t => { noise(t, 0.12, 0.09, 900); tone(180, t, 0.12, 'square', 0.04, sfxBus, 0.6); });
export const sfxClink = () => fx(t => { tone(1800, t, 0.12, 'square', 0.03, sfxBus, 0.8); noise(t, 0.08, 0.06, 4000); });
export const sfxTimber = () => fx(t => { noise(t, 0.6, 0.08, 500); tone(110, t + 0.1, 0.5, 'sine', 0.08, sfxBus, 0.6); });
export const sfxMoo = () => fx(t => { tone(160, t, 0.6, 'sawtooth', 0.025, sfxBus, 0.75); tone(162, t, 0.6, 'triangle', 0.04, sfxBus, 0.75); });

/* ---------------- Music: a light, looping country tune, composed on the fly ---------------- */

// Scale degrees in C major pentatonic, two bars per chord.
const CHORDS = [[48, 52, 55], [53, 57, 60], [55, 59, 62], [48, 52, 55], [45, 48, 52], [53, 57, 60], [55, 59, 62], [48, 52, 55]];
const PENTA = [0, 2, 4, 7, 9];
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
const BPM = 96, STEP = 60 / BPM / 2; // eighth notes
let timer = 0, nextT = 0, step = 0, melodyNote = 72, playing = false;

function schedule() {
  const a = ac!;
  while (nextT < a.currentTime + 0.25) {
    const bar = Math.floor(step / 8), beat = step % 8, chord = CHORDS[Math.floor(bar / 2) % CHORDS.length];
    // bass on beats 1 and 3, a strum of the chord on the off-beats (an easy oom-pah)
    if (beat === 0 || beat === 4) tone(midi(chord[0] - 12 + (beat === 4 ? 7 : 0)), nextT, STEP * 1.8, 'triangle', 0.07, musicBus);
    if (beat === 2 || beat === 6) chord.forEach(n => tone(midi(n), nextT, STEP * 1.2, 'triangle', 0.018, musicBus));
    // a wandering pentatonic melody that rests now and then
    if (Math.random() < (beat % 2 ? 0.35 : 0.7)) {
      const cands = [];
      for (let o = 60; o <= 84; o += 12) for (const d of PENTA) cands.push(o + d);
      const near = cands.filter(n => Math.abs(n - melodyNote) <= 4 && n >= 67 && n <= 81);
      melodyNote = beat === 0 ? chord[Math.floor(Math.random() * 3)] + 24 : near[Math.floor(Math.random() * near.length)] ?? melodyNote;
      tone(midi(melodyNote), nextT, STEP * (Math.random() < 0.3 ? 2 : 0.9), 'sine', 0.045, musicBus);
    }
    if (beat % 2 === 1) noise(nextT, 0.05, 0.012, 6000, musicBus);
    nextT += STEP; step++;
  }
}

function startMusic() {
  if (playing || !unlocked) return;
  const a = ctx();
  playing = true;
  nextT = a.currentTime + 0.1;
  musicBus.gain.cancelScheduledValues(a.currentTime);
  musicBus.gain.linearRampToValueAtTime(0.55, a.currentTime + 1.5);
  timer = window.setInterval(schedule, 100);
}

function stopMusic() {
  if (!playing || !ac) return;
  playing = false;
  musicBus.gain.cancelScheduledValues(ac.currentTime);
  musicBus.gain.linearRampToValueAtTime(0, ac.currentTime + 0.4);
  clearInterval(timer);
}

// A hidden tab goes quiet.
addEventListener('visibilitychange', () => { if (document.hidden) stopMusic(); else if (prefs.music) startMusic(); });

export function setMusic(on: boolean) { prefs.music = on; savePrefs(); if (on) startMusic(); else stopMusic(); }
export function setSfx(on: boolean) { prefs.sfx = on; savePrefs(); if (ac) sfxBus.gain.value = on ? 1 : 0; }

/** Quiet the game while an ad plays. */
export function pauseAudio(on: boolean) { if (ac) void (on ? ac.suspend() : ac.resume()); }

/* ---------------- Storm: a rain loop and thunder ---------------- */

let rainSrc: AudioBufferSourceNode | null = null, rainGain: GainNode | null = null, rainBuf: AudioBuffer | null = null;

/** Start or stop the steady hiss of heavy rain (fades in and out). Follows the sound-effects switch. */
export function setRain(on: boolean): boolean {
  if (!unlocked) return false;
  try {
    const a = ctx(), t = a.currentTime;
    if (on && !rainSrc) {
      if (!rainBuf) {
        // Two seconds of noise with soft random "drops" on top, looped.
        rainBuf = a.createBuffer(1, a.sampleRate * 2, a.sampleRate);
        const d = rainBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (Math.random() < 0.002 ? 3 : 0.6);
      }
      const s = a.createBufferSource(), lp = a.createBiquadFilter(), hp = a.createBiquadFilter(), g = a.createGain();
      s.buffer = rainBuf; s.loop = true;
      lp.type = 'lowpass'; lp.frequency.value = 5200;
      hp.type = 'highpass'; hp.frequency.value = 400;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.09, t + 2.5);
      s.connect(hp).connect(lp).connect(g).connect(sfxBus);
      s.start();
      rainSrc = s; rainGain = g;
    } else if (!on && rainSrc) {
      const s = rainSrc;
      rainGain!.gain.cancelScheduledValues(t);
      rainGain!.gain.setValueAtTime(rainGain!.gain.value, t);
      rainGain!.gain.linearRampToValueAtTime(0, t + 2);
      s.stop(t + 2.1);
      rainSrc = null; rainGain = null;
    }
  } catch { /* no audio */ }
  return true;
}

/** Thunder after a lightning flash: a sharp crack when close, then a long low rumble. `near` is 0 (far) to 1 (close). */
export const thunder = (near: number) => fx(t => {
  const a = ac!;
  if (!noiseBuf) noise(t, 0.01, 0.0001);
  const rumble = (start: number, dur: number, vol: number, freq: number) => {
    const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    s.buffer = noiseBuf; s.loop = true;
    f.type = 'lowpass'; f.frequency.setValueAtTime(freq, start); f.frequency.exponentialRampToValueAtTime(60, start + dur);
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(vol, start + 0.08 + (1 - near) * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0008, start + dur);
    s.connect(f).connect(g).connect(sfxBus);
    s.start(start, Math.random() * 0.5); s.stop(start + dur + 0.05);
  };
  if (near > 0.6) noise(t, 0.25, 0.22 * near, 2500);
  rumble(t, 2.5 + 2 * (1 - near), 0.18 + 0.2 * near, 280 + 500 * near);
  rumble(t + 0.4 + Math.random() * 0.6, 2.2, 0.1, 160);
});
