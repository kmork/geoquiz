/**
 * Capitals Quiz UI Component
 * Shared UI rendering for both standalone and Daily Challenge modes
 */

import { norm } from '../utils.js';

/**
 * Renders the Capitals Quiz UI (matching standalone game exactly)
 * @param {HTMLElement} container - Container to render into
 * @param {Object} country - Country data with capital
 * @param {Object} options - Configuration options
 * @param {boolean} options.showMap - Show country map (SVG)
 * @param {Array} options.choices - Pre-shuffled multiple choice options
 * @returns {Object} UI controls and methods
 */
export function renderCapitalsUI(container, country, options = {}) {
  const {
    showMap = true,
    choices = null
  } = options;
  
  // Build HTML - exactly like standalone capitals.html
  const html = `
    <div style="max-width: 600px; margin: 0 auto;">
      <div class="country" style="font-size: 1.5rem; font-weight: bold; margin-bottom: 1rem;">${country.country}</div>
      
      ${showMap ? `
        <div class="mapwrap" style="margin-bottom: 1rem;">
          <svg id="capitals-map" viewBox="0 0 600 320" width="100%" style="height: auto; max-height: 260px; border: 1px solid var(--border-color); border-radius: 8px; background: var(--map-bg);"></svg>
        </div>
      ` : ''}
      
      <div class="answerRow">
        <input id="capitals-input" placeholder="Type the capital…" autocomplete="off" spellcheck="false" list="capital-suggestions"/>
        <button id="capitals-submit-btn" class="btn btn-primary">Guess</button>
      </div>
      
      <datalist id="capital-suggestions"></datalist>
      
      <div id="capitals-choices" class="choices" style="display: none;"></div>
    </div>
  `;
  
  container.innerHTML = html;
  
  // Get element references
  const elements = {
    map: document.getElementById('capitals-map'),
    input: document.getElementById('capitals-input'),
    submitBtn: document.getElementById('capitals-submit-btn'),
    choices: document.getElementById('capitals-choices'),
    datalist: document.getElementById('capital-suggestions')
  };
  
  // Helper: show multiple choice
  function showMultipleChoice() {
    if (elements.input) elements.input.disabled = true;
    if (elements.submitBtn) elements.submitBtn.disabled = true;
    if (elements.choices) elements.choices.style.display = 'grid';
  }
  
  // Helper: disable all inputs
  function disableInputs() {
    if (elements.input) elements.input.disabled = true;
    if (elements.submitBtn) elements.submitBtn.disabled = true;
    const buttons = elements.choices?.querySelectorAll('button') || [];
    buttons.forEach(btn => btn.disabled = true);
  }
  
  // Helper: populate choices (called when wrong answer given)
  function populateChoices(options, correctAnswer, onChoiceClick) {
    if (!elements.choices) return;
    
    elements.choices.innerHTML = '';
    
    options.forEach(option => {
      const btn = document.createElement('button');
      btn.className = 'choiceBtn';
      btn.type = 'button';
      btn.textContent = option;
      btn.onclick = () => onChoiceClick(option, btn, correctAnswer);
      elements.choices.appendChild(btn);
    });
  }
  
  // Return public API
  return {
    elements,
    showMultipleChoice,
    disableInputs,
    populateChoices,
    
    // Event setup helper
    setupEvents({ onTextSubmit, onEnter }) {
      // Submit button
      if (elements.submitBtn && onTextSubmit) {
        elements.submitBtn.addEventListener('click', onTextSubmit);
      }
      
      // Enter key
      if (elements.input && onEnter) {
        elements.input.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') onEnter();
        });
        
        // Auto-focus on non-mobile
        if (!isMobileDevice()) {
          elements.input.focus();
        }
      }
    }
  };
}

// Helper: detect mobile device
function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Setup autocomplete for capitals input (using native datalist)
 */
export function setupCapitalsAutocomplete(datalistElement, suggestions) {
  if (!datalistElement) return;
  
  datalistElement.innerHTML = '';
  suggestions.forEach(s => {
    const option = document.createElement('option');
    option.value = s;
    datalistElement.appendChild(option);
  });
}
