/**
 * Picture Guess UI Component
 * Shared UI rendering for both standalone and Daily Challenge modes
 */

/**
 * Renders the Picture Guess game UI
 * @param {HTMLElement} container - Container to render into
 * @param {Object} site - Heritage site data {siteName, country, imageUrl, hint}
 * @param {Object} options - Configuration options
 * @param {boolean} options.showProgress - Show score/progress pills
 * @param {boolean} options.allowMultipleChoice - Enable two-attempt system (text → multiple choice)
 * @param {boolean} options.showHint - Show hint button
 * @param {Function} options.onAnswer - Callback when answer submitted
 * @param {Function} options.onHintUsed - Callback when hint used
 * @returns {Object} UI controls and methods
 */
export function renderPictureUI(container, site, options = {}) {
  const {
    showProgress = false,
    allowMultipleChoice = false,
    showHint = true,
    onAnswer = () => {},
    onHintUsed = () => {}
  } = options;
  
  // Build HTML using existing CSS classes
  const html = `
    ${showProgress ? `
      <div class="row" style="justify-content: space-between; margin-bottom: 1rem;">
        <div class="pill">Score: <b id="pg-score">0</b></div>
        <div class="pill">Progress: <b id="pg-progress">0 / 0</b></div>
      </div>
    ` : ''}
    
    <!-- Image -->
    <div class="picture-container">
      <img id="pg-image" src="${site.imageUrl}" alt="UNESCO Site" style="opacity: 0;">
      <div id="pg-loading" class="image-loading">
        <div class="spinner"></div>
      </div>
    </div>
    
    <!-- Text input section -->
    <div id="pg-text-section" class="input-section">
      <div class="answerRow">
        <input type="text" id="pg-input" class="country-input" placeholder="Type country name..." spellcheck="false">
        ${showHint ? `
          <button id="pg-hint-btn" class="btn btn-secondary">💡 Hint</button>
        ` : ''}
        <button id="pg-submit-btn" class="btn btn-primary">Submit</button>
      </div>
      
      <!-- Hint display -->
      ${showHint ? `
        <div id="pg-hint" class="hint-text" style="display: none;">
          <strong>Hint:</strong> <span id="pg-hint-text">${site.hint || `Located in ${site.country}`}</span>
        </div>
      ` : ''}
    </div>
    
    ${allowMultipleChoice ? `
      <!-- Multiple choice section (hidden initially) -->
      <div id="pg-mc-section" class="multiple-choice-section" style="display: none;">
        <div class="hint-text">
          <strong>Hint:</strong> <span id="pg-mc-hint">${site.hint || `Located in ${site.country}`}</span>
        </div>
        <div id="pg-choices" class="choices"></div>
      </div>
    ` : ''}
    
    <!-- Feedback/Status -->
    <div id="pg-feedback" class="status" style="display: none;"></div>
  `;
  
  container.innerHTML = html;
  
  // Get element references
  const elements = {
    image: document.getElementById('pg-image'),
    loading: document.getElementById('pg-loading'),
    textSection: document.getElementById('pg-text-section'),
    input: document.getElementById('pg-input'),
    submitBtn: document.getElementById('pg-submit-btn'),
    hintBtn: document.getElementById('pg-hint-btn'),
    hintDiv: document.getElementById('pg-hint'),
    hintText: document.getElementById('pg-hint-text'),
    mcSection: document.getElementById('pg-mc-section'),
    mcHint: document.getElementById('pg-mc-hint'),
    choices: document.getElementById('pg-choices'),
    feedback: document.getElementById('pg-feedback'),
    score: document.getElementById('pg-score'),
    progress: document.getElementById('pg-progress')
  };
  
  // Load image with fade-in
  const img = new Image();
  img.onload = () => {
    elements.image.src = site.imageUrl;
    elements.loading.style.display = 'none';
    elements.image.style.opacity = '1';
  };
  img.onerror = () => {
    elements.loading.style.display = 'none';
    elements.image.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect fill="%23333" width="400" height="300"/><text x="50%" y="50%" fill="%23fff" text-anchor="middle">Image not available</text></svg>';
    elements.image.style.opacity = '1';
  };
  img.src = site.imageUrl;
  
  // Track state
  let hintUsed = false;
  let answered = false;
  
  // Event handlers
  const handleSubmit = () => {
    if (answered) return;
    const answer = elements.input.value.trim();
    if (!answer) return;
    
    answered = true;
    elements.input.disabled = true;
    elements.submitBtn.disabled = true;
    
    onAnswer({ answer, hintUsed });
  };
  
  const handleHint = () => {
    if (hintUsed) return;
    hintUsed = true;
    elements.hintDiv.style.display = 'block';
    elements.hintBtn.disabled = true;
    elements.hintBtn.style.opacity = '0.5';
    onHintUsed();
  };
  
  // Attach events
  elements.submitBtn.addEventListener('click', handleSubmit);
  elements.input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSubmit();
  });
  
  if (elements.hintBtn) {
    elements.hintBtn.addEventListener('click', handleHint);
  }
  
  // Auto-focus on desktop (not mobile to avoid keyboard popup)
  const isMobile = window.innerWidth <= 640 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (!isMobile) {
    elements.input.focus();
  }
  
  // Return control methods
  return {
    elements,
    
    /**
     * Show feedback message
     * @param {string} message - Feedback text
     * @param {boolean} isCorrect - Whether answer was correct
     */
    showFeedback(message, isCorrect) {
      elements.feedback.textContent = message;
      elements.feedback.className = isCorrect ? 'status good' : 'status bad';
      elements.feedback.style.display = 'block';
    },
    
    /**
     * Show multiple choice options
     * @param {string[]} options - Array of 4 country names (including correct)
     * @param {Function} onChoiceClick - Callback when choice clicked
     */
    showMultipleChoice(options, onChoiceClick) {
      if (!allowMultipleChoice) return;
      
      // Reset answered flag to allow multiple choice interaction
      answered = false;
      
      elements.textSection.style.display = 'none';
      elements.mcSection.style.display = 'block';
      elements.choices.innerHTML = '';
      
      options.forEach(option => {
        const btn = document.createElement('button');
        btn.textContent = option;
        btn.className = 'btn';
        btn.addEventListener('click', () => {
          if (answered) return;
          answered = true;
          
          // Disable all buttons
          elements.choices.querySelectorAll('button').forEach(b => b.disabled = true);
          
          onChoiceClick(option);
        });
        elements.choices.appendChild(btn);
      });
    },
    
    /**
     * Highlight correct/wrong choices in multiple choice
     * @param {string} correctAnswer - The correct country
     * @param {string} userAnswer - The user's selected country
     */
    highlightChoices(correctAnswer, userAnswer) {
      const buttons = elements.choices.querySelectorAll('button');
      buttons.forEach(btn => {
        if (btn.textContent === correctAnswer) {
          btn.classList.add('correct');
          btn.style.background = 'var(--good-bg)';
          btn.style.color = 'var(--good-text)';
        } else if (btn.textContent === userAnswer) {
          btn.classList.add('wrong');
          btn.style.background = 'var(--bad-bg)';
          btn.style.color = 'var(--bad-text)';
        }
      });
    },
    
    /**
     * Update score/progress display
     * @param {number} score - Current score
     * @param {number} current - Current question number
     * @param {number} total - Total questions
     */
    updateProgress(score, current, total) {
      if (elements.score) elements.score.textContent = score;
      if (elements.progress) elements.progress.textContent = `${current} / ${total}`;
    },
    
    /**
     * Reset to initial state for next question
     */
    reset() {
      answered = false;
      hintUsed = false;
      elements.input.value = '';
      elements.input.disabled = false;
      elements.submitBtn.disabled = false;
      elements.feedback.style.display = 'none';
      if (elements.hintDiv) elements.hintDiv.style.display = 'none';
      if (elements.hintBtn) {
        elements.hintBtn.disabled = false;
        elements.hintBtn.style.opacity = '1';
      }
      elements.textSection.style.display = 'block';
      if (elements.mcSection) elements.mcSection.style.display = 'none';
    }
  };
}

/**
 * Setup autocomplete for country/site input
 * @param {HTMLInputElement} input - Input element
 * @param {string[]} suggestions - Array of suggestions
 */
export function setupPictureAutocomplete(input, suggestions) {
  if (!input || !suggestions || suggestions.length === 0) return;
  
  // Check if mobile autocomplete is available
  if (typeof initMobileAutocomplete === 'function') {
    input.removeAttribute('list'); // Remove datalist if exists
    initMobileAutocomplete(input, suggestions, {
      maxSuggestions: null, // Show all matches (scrollable)
      minChars: 1
    });
  } else {
    console.warn('initMobileAutocomplete not available');
  }
}
