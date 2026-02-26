/**
 * Capitals - Complete Game Factory (Daily Challenge mode)
 *
 * Creates the capitals game for use in the Daily Challenge.
 * The standalone game uses js/capitals-game.js instead.
 */

import { CapitalsGameLogic } from './games/capitals-logic.js';
import { renderCapitalsUI } from './ui-components/capitals-ui.js';
import { createMap } from './map.js';
import { norm } from './utils.js';

/**
 * Create a complete Capitals game instance for the Daily Challenge.
 * @param {Object}   config
 * @param {HTMLElement} config.container  - Container element
 * @param {Object}   [config.confetti]   - Confetti instance
 * @param {Object}   [config.rng]        - Seeded RNG instance
 * @param {Function} [config.onComplete] - Called with result when round ends
 * @returns {{ setCountry(data, allData, timeLimit?): void, start(onReady?): Promise<void> }}
 */
export function createCompleteCapitalsGame({ container, confetti, rng, onComplete }) {
  let _data = null;
  let _allData = null;
  let _timeLimit = null;

  return {
    setCountry(data, allData, timeLimit = null) {
      _data = data;
      _allData = allData;
      _timeLimit = timeLimit;
    },

    async start(onReady = () => {}) {
      const targetCountry = _data;
      const allData = _allData;
      const timeLimit = _timeLimit;

      // Create game logic
      const gameLogic = new CapitalsGameLogic({
        singleRound: true,
        data: allData
      });
      gameLogic.setCountry(targetCountry);
      gameLogic.nextRound();

      // Generate answers
      const wrongAnswers = gameLogic.generateWrongAnswers(rng);
      const correctCapitals = targetCountry.capitals || [gameLogic.getCorrectCapital()];
      const correctAnswer = correctCapitals[0];
      const allOptions = [...correctCapitals, ...wrongAnswers.slice(0, 4 - correctCapitals.length)];
      const shuffled = rng
        ? rng.shuffle(allOptions)
        : allOptions.sort(() => Math.random() - 0.5);

      // Render UI
      const ui = renderCapitalsUI(container, targetCountry, {
        showMap: true,
        choices: shuffled
      });

      // Load map
      if (ui.elements.map) {
        const mapApi = createMap({
          svgEl: ui.elements.map,
          worldUrl: 'data/ne_10m_admin_0_countries_route.geojson.gz',
          placesUrl: 'data/places.geojson'
        });
        try {
          await mapApi.load();
          mapApi.draw(targetCountry.country, false);
        } catch (err) {
          console.error('Capitals map load failed:', err);
        }
      }

      // Game state
      let answered = false;
      let mcShown = false;

      const handleTextSubmit = () => {
        if (answered || mcShown) return;

        const userInput = ui.elements.input.value.trim();

        if (!userInput || !correctCapitals.some(c => norm(userInput) === norm(c))) {
          mcShown = true;
          ui.showMultipleChoice();
          ui.populateChoices(shuffled, correctAnswer, handleChoiceClick);
          return;
        }

        answered = true;
        ui.disableInputs();
        const result = gameLogic.checkAnswer(correctAnswer);
        confetti?.burst?.({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

        setTimeout(() => {
          onComplete?.({
            correct: true,
            time: result.time,
            timeLimit,
            hintPenalty: 0
          });
        }, 1200);
      };

      const handleChoiceClick = (selected, button) => {
        if (answered) return;
        answered = true;

        const isCorrect = correctCapitals.includes(selected);
        const result = gameLogic.checkAnswer(selected);

        const buttons = ui.elements.choices.querySelectorAll('button');
        buttons.forEach(btn => btn.disabled = true);
        buttons.forEach(btn => {
          if (correctCapitals.includes(btn.textContent)) {
            btn.classList.add('correct');
          }
        });

        if (!isCorrect) {
          button.classList.add('wrong');
        } else {
          confetti?.burst?.({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
        }

        setTimeout(() => {
          onComplete?.({
            correct: isCorrect,
            time: result.time,
            timeLimit,
            hintPenalty: mcShown ? 2 : 0
          });
        }, 1200);
      };

      const handleTimeout = () => {
        if (answered) return;
        answered = true;

        if (!mcShown) {
          ui.showMultipleChoice();
          ui.populateChoices(shuffled, correctAnswer, () => {});
        }

        const buttons = ui.elements.choices.querySelectorAll('button');
        buttons.forEach(btn => {
          if (correctCapitals.includes(btn.textContent)) {
            btn.classList.add('correct');
          }
          btn.disabled = true;
        });

        setTimeout(() => {
          onComplete?.({
            correct: false,
            time: timeLimit,
            timeLimit
          });
        }, 1200);
      };

      // Wire up events
      ui.setupEvents({
        onTextSubmit: handleTextSubmit,
        onEnter: handleTextSubmit
      });

      // Mobile autocomplete with capital names
      if (window.initMobileAutocomplete && allData) {
        const capitalSuggestions = allData.flatMap(c => c.capitals || []).filter(Boolean).sort();
        window.initMobileAutocomplete(ui.elements.input, capitalSuggestions, {
          onSelect: () => handleTextSubmit()
        });
      }

      onReady();

      window.addEventListener('daily-timeout', handleTimeout, { once: true });
    }
  };
}
