/**
 * Country Duel UI Component
 * Two-card layout for the duel game.
 */

/**
 * @param {HTMLElement} container
 * @param {object} roundData - { countryA, countryB, questionText }
 * @param {object} flagsData - country → flagCode mapping
 */
export function renderDuelUI(container, roundData, flagsData) {
  const { countryA, countryB, questionText } = roundData;
  const isoA = flagsData[countryA.country] || '';
  const isoB = flagsData[countryB.country] || '';

  container.innerHTML = `
    <div class="duel-layout">
      <div class="duel-question">${escapeHtml(questionText)}</div>
      <div class="duel-cards">
        <button class="duel-card" data-choice="A">
          <img class="duel-flag" src="img/flags/${isoA}.svg"
               alt="${escapeAttr(countryA.country)} flag">
          <div class="duel-country-name">${escapeHtml(countryA.country)}</div>
        </button>
        <div class="duel-vs">VS</div>
        <button class="duel-card" data-choice="B">
          <img class="duel-flag" src="img/flags/${isoB}.svg"
               alt="${escapeAttr(countryB.country)} flag">
          <div class="duel-country-name">${escapeHtml(countryB.country)}</div>
        </button>
      </div>
    </div>
  `;

  const cards = container.querySelectorAll('.duel-card');

  function setupEvents({ onClick }) {
    cards.forEach(card => {
      card.addEventListener('click', () => {
        if (card.disabled) return;
        onClick(card.dataset.choice);
      });
    });

    // Hover effect
    cards.forEach(card => {
      card.addEventListener('mouseenter', () => {
        if (!card.disabled) card.style.transform = 'scale(1.03)';
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
      });
    });
  }

  function highlightResult(correctAnswer, selectedAnswer) {
    cards.forEach(card => {
      const choice = card.dataset.choice;
      if (choice === correctAnswer) {
        card.classList.add('duel-correct');
      } else if (choice === selectedAnswer && selectedAnswer !== correctAnswer) {
        card.classList.add('duel-wrong');
      }
    });
  }

  function disableAll() {
    cards.forEach(card => {
      card.disabled = true;
      card.style.cursor = 'default';
    });
  }

  return { setupEvents, highlightResult, disableAll };
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
