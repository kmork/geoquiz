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
