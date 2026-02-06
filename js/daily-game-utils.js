/**
 * Daily Challenge Game Utilities
 * 
 * Shared utilities for Daily Challenge games to reduce code duplication.
 * These functions provide common UI patterns, feedback handling, and
 * autocomplete setup used across multiple games.
 */

/**
 * Create a standard input with autocomplete for country/site name entry
 * @param {string} id - Input element ID
 * @param {string} placeholder - Placeholder text
 * @param {Array<string>} suggestions - Autocomplete suggestions
 * @returns {HTMLElement} The input element
 */
export function createAutocompleteInput(id, placeholder, suggestions) {
  const input = document.createElement('input');
  input.type = 'text';
  input.id = id;
  input.placeholder = placeholder;
  input.style.cssText = `
    flex: 1; 
    padding: 0.75rem; 
    border: 1px solid var(--border-color); 
    border-radius: 8px; 
    background: var(--input-bg); 
    color: var(--text-primary); 
    font-size: 1rem;
  `;
  
  // Setup autocomplete after element is in DOM
  setTimeout(() => {
    if (window.initMobileAutocomplete) {
      window.initMobileAutocomplete(input, suggestions, { 
        minChars: 1, 
        maxSuggestions: null 
      });
    }
  }, 0);
  
  return input;
}

/**
 * Create a standard button
 * @param {string} id - Button ID
 * @param {string} text - Button text
 * @param {string} className - CSS class (btn-primary, btn-secondary)
 * @param {boolean} disabled - Initial disabled state
 * @returns {HTMLElement} The button element
 */
export function createButton(id, text, className = 'btn-primary', disabled = false) {
  const button = document.createElement('button');
  button.id = id;
  button.textContent = text;
  button.className = `btn ${className}`;
  button.style.cssText = 'padding: 0.75rem 1rem;';
  button.disabled = disabled;
  return button;
}

/**
 * Show feedback message
 * @param {HTMLElement} feedbackDiv - Feedback container
 * @param {string} message - Message to display
 * @param {boolean} isCorrect - Whether this is success or error feedback
 * @param {number} duration - Auto-hide after milliseconds (0 = don't auto-hide)
 */
export function showFeedback(feedbackDiv, message, isCorrect, duration = 0) {
  feedbackDiv.style.display = 'block';
  feedbackDiv.style.background = isCorrect ? 
    'var(--success-color, #22c55e)' : 
    'var(--error-color, #ef4444)';
  feedbackDiv.style.color = 'white';
  feedbackDiv.style.padding = '1rem';
  feedbackDiv.style.borderRadius = '8px';
  feedbackDiv.textContent = message;
  
  if (duration > 0) {
    setTimeout(() => {
      feedbackDiv.style.display = 'none';
    }, duration);
  }
}

/**
 * Hide feedback message
 * @param {HTMLElement} feedbackDiv - Feedback container
 */
export function hideFeedback(feedbackDiv) {
  feedbackDiv.style.display = 'none';
}

/**
 * Create a standard feedback container div
 * @param {string} id - Element ID
 * @returns {HTMLElement} The feedback div
 */
export function createFeedbackDiv(id) {
  const div = document.createElement('div');
  div.id = id;
  div.style.cssText = `
    display: none; 
    padding: 1rem; 
    border-radius: 8px; 
    margin-top: 1rem;
  `;
  return div;
}

/**
 * Highlight a button as correct or incorrect
 * @param {HTMLElement} button - Button to highlight
 * @param {boolean} isCorrect - Whether to highlight as correct or incorrect
 */
export function highlightButton(button, isCorrect) {
  button.disabled = true;
  if (isCorrect) {
    button.style.background = '#22c55e';
    button.style.borderColor = '#16a34a';
    button.style.color = 'white';
  } else {
    button.style.background = '#ef4444';
    button.style.borderColor = '#dc2626';
    button.style.color = 'white';
  }
}

/**
 * Setup autocomplete on an existing input element
 * @param {HTMLElement} input - Input element
 * @param {Array<string>} suggestions - Autocomplete suggestions
 */
export function setupAutocomplete(input, suggestions) {
  if (window.initMobileAutocomplete) {
    window.initMobileAutocomplete(input, suggestions, { 
      minChars: 1, 
      maxSuggestions: null 
    });
  }
}

/**
 * Create a standard hint button and container
 * @param {string} btnId - Button ID
 * @param {string} divId - Hint div ID
 * @param {string} hintText - Hint text to show
 * @param {Function} onHintUsed - Callback when hint is clicked
 * @returns {Object} { button, div }
 */
export function createHintElements(btnId, divId, hintText, onHintUsed) {
  const button = createButton(btnId, '💡 Hint', 'btn-secondary');
  
  const div = document.createElement('div');
  div.id = divId;
  div.style.cssText = `
    display: none; 
    padding: 0.75rem; 
    background: var(--card-bg); 
    border-radius: 8px; 
    margin-bottom: 1rem; 
    color: var(--text-secondary);
  `;
  div.innerHTML = `<strong>Hint:</strong> ${hintText}`;
  
  button.addEventListener('click', () => {
    div.style.display = 'block';
    button.disabled = true;
    if (onHintUsed) onHintUsed();
  });
  
  return { button, div };
}

/**
 * Create a promise that resolves when Enter key is pressed in an input
 * @param {HTMLElement} input - Input element
 * @param {Function} callback - Function to call on Enter
 */
export function onEnterKey(input, callback) {
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      callback();
    }
  });
}

/**
 * Calculate time taken since a start time
 * @param {number} startTime - Start time from Date.now()
 * @returns {number} Seconds elapsed
 */
export function getElapsedSeconds(startTime) {
  return Math.floor((Date.now() - startTime) / 1000);
}
