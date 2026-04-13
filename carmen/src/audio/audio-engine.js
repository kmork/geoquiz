/**
 * Carmen Audio — procedural sound effects using Web Audio API + file-based music/SFX.
 * All audio file paths come from playlist.js.
 */

import { BGM_TRACKS, SPECIAL_TRACKS, AMBIENT_SOUNDS } from './playlist.js';

let ctx = null;

function getCtx() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return ctx;
}

/** Stamp/thud sound — short low-frequency impact. */
export function playStamp() {
  const ac = getCtx();
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.connect(gain);
  gain.connect(ac.destination);

  osc.type = 'sine';
  osc.frequency.setValueAtTime(120, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(40, ac.currentTime + 0.15);

  gain.gain.setValueAtTime(0.5, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ac.currentTime + 0.2);

  // Add a noise burst for the "paper" impact
  const bufferSize = ac.sampleRate * 0.08;
  const noiseBuffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }
  const noise = ac.createBufferSource();
  noise.buffer = noiseBuffer;
  const noiseGain = ac.createGain();
  noiseGain.gain.setValueAtTime(0.3, ac.currentTime);
  noiseGain.gain.exponentialRampToValueAtTime(0.01, ac.currentTime + 0.1);
  noise.connect(noiseGain);
  noiseGain.connect(ac.destination);

  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + 0.25);
  noise.start(ac.currentTime);
  noise.stop(ac.currentTime + 0.1);
}

/* ── Background music ──────────────────────────────── */

let bgMusic = null;

function pickRandomTrack() {
  return BGM_TRACKS[Math.floor(Math.random() * BGM_TRACKS.length)];
}

const MUSIC_VOLUME = 0.15;
let musicMuted = false;

/** Check if music is currently muted. */
export function isMusicMuted() { return musicMuted; }

/** Toggle music mute state. Returns new muted state. */
export function toggleMusicMute() {
  musicMuted = !musicMuted;
  if (bgMusic && !bgMusic.paused) {
    bgMusic.volume = musicMuted ? 0 : MUSIC_VOLUME;
  }
  return musicMuted;
}

/** Start looping background music (fade in). Picks a random track each time. */
export function startMusic() {
  if (bgMusic && !bgMusic.paused) return;

  bgMusic = new Audio(pickRandomTrack());
  bgMusic.loop = true;
  bgMusic.volume = 0;
  if (musicMuted) {
    bgMusic.volume = 0;
    bgMusic.play().catch(() => {});
    return;
  }
  bgMusic.play().catch(() => {});

  let v = 0;
  const fade = setInterval(() => {
    v = Math.min(v + 0.05, MUSIC_VOLUME);
    bgMusic.volume = v;
    if (v >= MUSIC_VOLUME) clearInterval(fade);
  }, 60);
}

/** Lower music volume while narrator speaks, restore when done. */
export function duckMusic() {
  if (bgMusic && !bgMusic.paused) bgMusic.volume = Math.min(bgMusic.volume, 0.10);
}
export function unduckMusic() {
  if (bgMusic && !bgMusic.paused) bgMusic.volume = musicMuted ? 0 : MUSIC_VOLUME;
}

/** Stop background music (fade out). */
export function stopMusic() {
  if (!bgMusic || bgMusic.paused) return;
  let v = bgMusic.volume;
  const m = bgMusic;
  const fade = setInterval(() => {
    v = Math.max(v - 0.05, 0);
    m.volume = v;
    if (v <= 0) {
      clearInterval(fade);
      m.pause();
    }
  }, 60);
}

/** Play the lineup track (replaces background music). */
export function playLineupMusic() {
  stopMusic();
  bgMusic = new Audio(SPECIAL_TRACKS.lineup);
  bgMusic.loop = true;
  bgMusic.volume = musicMuted ? 0 : 0.5;
  bgMusic.play().catch(() => {});
}

/** Play the victory track (replaces background music). */
export function playVictoryMusic() {
  stopMusic();
  bgMusic = new Audio(SPECIAL_TRACKS.victory);
  bgMusic.loop = false;
  bgMusic.volume = MUSIC_VOLUME;
  bgMusic.play().catch(() => {});
}

export function playFailMusic() {
  stopMusic();
  bgMusic = new Audio(SPECIAL_TRACKS.fail);
  bgMusic.loop = false;
  bgMusic.volume = MUSIC_VOLUME;
  bgMusic.play().catch(() => {});
}

/** Play narrator intro audio. Ducks music while speaking. Returns a promise that resolves when done. */
let narratorAudio = null;

export function playNarratorIntro() {
  return new Promise(resolve => {
    duckMusic();
    narratorAudio = new Audio(SPECIAL_TRACKS.narrator);
    narratorAudio.volume = 1.0;
    narratorAudio.addEventListener('ended', () => { unduckMusic(); resolve(); }, { once: true });
    narratorAudio.addEventListener('error', () => { unduckMusic(); resolve(); }, { once: true });
    narratorAudio.play().catch(() => { unduckMusic(); resolve(); });
  });
}

/** Play any narrator audio file. Ducks music while speaking. Returns a promise that resolves when done. */
export function playNarrator(file) {
  return new Promise(resolve => {
    duckMusic();
    narratorAudio = new Audio(file);
    narratorAudio.volume = 1.0;
    narratorAudio.addEventListener('ended', () => { unduckMusic(); resolve(); }, { once: true });
    narratorAudio.addEventListener('error', () => { unduckMusic(); resolve(); }, { once: true });
    narratorAudio.play().catch(() => { unduckMusic(); resolve(); });
  });
}

export function stopNarrator() {
  if (narratorAudio && !narratorAudio.paused) {
    narratorAudio.pause();
    narratorAudio = null;
  }
}

/* ── Ambient / SFX sounds ─────────────────────────── */
const AMBIENT_VOLUME = 0.5;
const ATMOSPHERE_VOLUME = 0.24;
let ambientAudio = null;
let atmosphereAudio = null;
let atmosphereTimer = null;

/** Play an ambient sound by key (on top of background music). Plays once. */
export function playAmbient(key) {
  stopAmbient();
  const file = AMBIENT_SOUNDS[key];
  if (!file) return;
  ambientAudio = new Audio(file);
  ambientAudio.volume = AMBIENT_VOLUME;
  ambientAudio.loop = false;
  ambientAudio.play().catch(() => {});
}

/** Stop any playing ambient sound. */
export function stopAmbient() {
  if (ambientAudio && !ambientAudio.paused) {
    ambientAudio.pause();
    ambientAudio.currentTime = 0;
  }
  ambientAudio = null;
}

/** Play a lower-volume ambient excerpt for a limited duration. */
export function playAtmosphere(key, durationMs = 10000) {
  stopAtmosphere();
  const file = AMBIENT_SOUNDS[key];
  if (!file) return;

  atmosphereAudio = new Audio(file);
  atmosphereAudio.volume = ATMOSPHERE_VOLUME;
  atmosphereAudio.loop = false;
  atmosphereAudio.play().catch(() => {});

  atmosphereTimer = setTimeout(() => {
    stopAtmosphere();
  }, durationMs);
}

export function stopAtmosphere() {
  if (atmosphereTimer) {
    clearTimeout(atmosphereTimer);
    atmosphereTimer = null;
  }
  if (atmosphereAudio && !atmosphereAudio.paused) {
    atmosphereAudio.pause();
    atmosphereAudio.currentTime = 0;
  }
  atmosphereAudio = null;
}

/** Start clock ticking sound. Plays on loop until stopClockTicking() is called. */
let clockAudio = null;

let clockGain = null;
let clockSource = null;

export function startClockTicking(urgency = 'normal') {
  // GainNode can amplify past 1.0 — the mp3 itself is quiet, so we boost it.
  const gainValue =
    urgency === 'critical' ? 4.0 :
    urgency === 'low'      ? 3.0 :
                             2.2;

  // Duck background music hard while the clock ticks, so it cuts through.
  if (bgMusic && !bgMusic.paused) bgMusic.volume = musicMuted ? 0 : 0.05;

  if (clockAudio && !clockAudio.paused && clockGain) {
    clockGain.gain.value = gainValue;
    return;
  }
  const ac = getCtx();
  clockAudio = new Audio(SPECIAL_TRACKS.clock);
  clockAudio.loop = true;
  clockAudio.crossOrigin = 'anonymous';
  try {
    clockSource = ac.createMediaElementSource(clockAudio);
    clockGain = ac.createGain();
    clockGain.gain.value = gainValue;
    clockSource.connect(clockGain);
    clockGain.connect(ac.destination);
  } catch {
    // Fallback: plain element playback if the graph can't be built.
    clockAudio.volume = 1.0;
  }
  clockAudio.play().catch(() => {});
}

export function stopClockTicking() {
  if (clockAudio && !clockAudio.paused) {
    clockAudio.pause();
    clockAudio.currentTime = 0;
  }
  clockAudio = null;
  clockSource = null;
  clockGain = null;
  // Restore music volume after the clock stops.
  if (bgMusic && !bgMusic.paused) bgMusic.volume = musicMuted ? 0 : MUSIC_VOLUME;
}

/** Clock tick-tock sound — synthesized fallback (used by typewriter etc). */
let tickTock = 0;
export function playTick() {
  const ac = getCtx();
  const isTick = tickTock++ % 2 === 0;

  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.connect(gain);
  gain.connect(ac.destination);

  osc.type = 'sine';
  osc.frequency.setValueAtTime(isTick ? 900 : 600, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(isTick ? 700 : 450, ac.currentTime + 0.04);

  gain.gain.setValueAtTime(0.12, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.06);

  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + 0.06);
}

/** Single typewriter key click. */
export function playTypeKey() {
  const ac = getCtx();

  const bufferSize = ac.sampleRate * 0.03;
  const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    // Sharp click that decays quickly
    const t = i / ac.sampleRate;
    data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 200) * 0.15;
  }

  const source = ac.createBufferSource();
  source.buffer = buffer;

  // Bandpass to give it a "mechanical" feel
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 2000 + Math.random() * 1000;
  filter.Q.value = 2;

  source.connect(filter);
  filter.connect(ac.destination);

  source.start(ac.currentTime);
}
