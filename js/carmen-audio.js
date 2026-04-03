/**
 * Carmen Audio — procedural sound effects using Web Audio API.
 * No external audio files needed.
 */

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
const TRACKS = [
  'carmen/audio/Alley Thoughts.mp3',
  'carmen/audio/Ashtray Alibi 2.mp3',
  'carmen/audio/Ashtray Alibi.mp3',
  'carmen/audio/Bass Walker.mp3',
  'carmen/audio/Broken Casefiles 2.mp3',
  'carmen/audio/Broken Casefiles.mp3',
  'carmen/audio/Case Soda Pop.mp3',
  'carmen/audio/Casefile Chrome.mp3',
  'carmen/audio/Catching The Thief.mp3',
  'carmen/audio/Cigar Ashes 2.mp3',
  'carmen/audio/Cigar Ashes.mp3',
  'carmen/audio/Coal-Lit Case.mp3',
  'carmen/audio/Cobalt Alibi 2.mp3',
  'carmen/audio/Cobalt Alibi.mp3',
  'carmen/audio/Cool Vibes.mp3',
  'carmen/audio/Covert Affair.mp3',
  'carmen/audio/Fallen Petals.mp3',
  'carmen/audio/Just As Soon.mp3',
  'carmen/audio/Lacquered Alibi 2.mp3',
  'carmen/audio/Lacquered Alibi.mp3',
  'carmen/audio/Night Walk In Paris.mp3',
  'carmen/audio/Noir Alley.mp3',
  'carmen/audio/Signs To Nowhere.mp3',
  'carmen/audio/Smoldered Alibis.mp3',
  'carmen/audio/Tin Stethoscope 2.mp3',
  'carmen/audio/Tin Stethoscope.mp3',
];

let bgMusic = null;

function pickRandomTrack() {
  return TRACKS[Math.floor(Math.random() * TRACKS.length)];
}

/** Start looping background music (fade in). Picks a random track each time. */
export function startMusic() {
  if (bgMusic && !bgMusic.paused) return;

  bgMusic = new Audio(pickRandomTrack());
  bgMusic.loop = true;
  bgMusic.volume = 0;
  bgMusic.play().catch(() => {});

  let v = 0;
  const fade = setInterval(() => {
    v = Math.min(v + 0.05, 0.25);
    bgMusic.volume = v;
    if (v >= 0.25) clearInterval(fade);
  }, 60);
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
