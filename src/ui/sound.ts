/** Tiny synthesized sounds (no audio files). Browsers only allow sound after the player has tapped once. */
let ac: AudioContext | null = null;
let unlocked = false;
addEventListener('pointerdown', () => { unlocked = true; }, { once: true });

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'square', vol = 0.06) {
  const o = ac!.createOscillator(), g = ac!.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(vol, start + 0.02);
  g.gain.setValueAtTime(vol, start + dur - 0.04);
  g.gain.linearRampToValueAtTime(0, start + dur);
  o.connect(g).connect(ac!.destination);
  o.start(start); o.stop(start + dur);
}

/** Two friendly beeps, or one long angry blast. */
export function honk(angry = false) {
  if (!unlocked) return;
  try {
    ac ??= new AudioContext();
    const t = ac.currentTime;
    if (angry) { tone(220, t, 0.7); tone(233, t, 0.7, 'sawtooth', 0.03); }
    else { tone(392, t, 0.16); tone(392, t + 0.24, 0.2); tone(494, t, 0.16, 'triangle', 0.03); tone(494, t + 0.24, 0.2, 'triangle', 0.03); }
  } catch { /* no audio */ }
}

/** A short coin jingle for a loaded truck. */
export function chaChing() {
  if (!unlocked) return;
  try {
    ac ??= new AudioContext();
    const t = ac.currentTime;
    [988, 1319, 1568].forEach((f, i) => tone(f, t + i * 0.07, 0.14, 'triangle', 0.05));
  } catch { /* no audio */ }
}
