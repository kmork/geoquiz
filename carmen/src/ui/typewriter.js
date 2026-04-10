/**
 * Typewriter effect — reveals text letter-by-letter with key sounds.
 * Returns a promise that resolves when done. Click skips to full text.
 */

import { playTypeKey } from '../audio/audio-engine.js';

export function typewriter(element, text, speed = 25) {
  return new Promise(resolve => {
    element.textContent = '';
    element.classList.add('typewriter-active');
    let i = 0;
    let skip = false;
    let keyCount = 0;

    function onClick() {
      skip = true;
    }
    element.addEventListener('click', onClick);

    function tick() {
      if (skip || i >= text.length) {
        element.textContent = text;
        element.classList.remove('typewriter-active');
        element.removeEventListener('click', onClick);
        resolve();
        return;
      }
      element.textContent += text[i];
      if (text[i] !== ' ' && keyCount++ % 2 === 0) {
        playTypeKey();
      }
      i++;
      setTimeout(tick, speed);
    }
    tick();
  });
}
