/**
 * Trivia UI Component
 * Shared UI rendering for both standalone and Daily Challenge modes
 */

/**
 * Renders the Trivia Quiz UI
 * @param {HTMLElement} container - Container to render into
 * @param {Object} question - Question data with options and answer
 * @param {Array} shuffledOptions - Pre-shuffled options
 * @param {Object} options - Configuration options
 * @param {Function} options.onAnswer - Callback when answer selected
 * @returns {Object} UI controls and methods
 */
export function renderTriviaUI(container, question, shuffledOptions, options = {}) {
  const {
    onAnswer = () => {}
  } = options;
  
  // Build HTML
  const html = `
    <div style="max-width: 600px; margin: 0 auto;">
      <p style="font-size: 1.2rem; margin-bottom: 2rem; line-height: 1.6;">
        ${question.question}
      </p>
      
      <div id="trivia-choices" style="display: grid; gap: 1rem;">
        ${shuffledOptions.map((option, i) => `
          <button class="trivia-option btn btn-secondary" data-option="${option}" style="text-align: left; padding: 1rem; font-size: 1rem;">
            ${option}
          </button>
        `).join('')}
      </div>
      
      <div id="trivia-explanation" style="display: none; margin-top: 1.5rem; padding: 1rem; border-radius: 8px;"></div>
    </div>
  `;
  
  container.innerHTML = html;
  
  // Get element references
  const elements = {
    choices: document.getElementById('trivia-choices'),
    explanation: document.getElementById('trivia-explanation')
  };
  
  // Helper: highlight button as correct or wrong
  function highlightButton(button, isCorrect) {
    if (!button) return;
    
    button.disabled = true;
    const color = isCorrect ? '#22c55e' : '#ef4444';
    button.style.backgroundColor = color;
    button.style.borderColor = color;
    button.style.color = 'white';
  }
  
  // Helper: show explanation
  function showExplanation(text, isCorrect) {
    if (!elements.explanation) return;
    
    elements.explanation.textContent = text;
    elements.explanation.style.display = 'block';
    elements.explanation.style.background = isCorrect ? 
      'rgba(5, 150, 105, 0.1)' : 'rgba(220, 38, 38, 0.1)';
    elements.explanation.style.borderLeft = `4px solid ${isCorrect ? '#059669' : '#dc2626'}`;
  }
  
  // Helper: disable all choices
  function disableChoices() {
    const buttons = elements.choices?.querySelectorAll('button') || [];
    buttons.forEach(btn => btn.disabled = true);
  }
  
  // Return public API
  return {
    elements,
    highlightButton,
    showExplanation,
    disableChoices,
    
    // Event setup helper
    setupEvents({ onClick }) {
      if (elements.choices && onClick) {
        elements.choices.addEventListener('click', (e) => {
          const button = e.target.closest('.trivia-option');
          if (button && !button.disabled) {
            const option = button.dataset.option;
            onClick(option, button);
          }
        });
      }
    }
  };
}
