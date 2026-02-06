/**
 * Outlines Quiz UI Component
 * Shared UI rendering for both standalone and Daily Challenge modes
 */

/**
 * Renders the Outlines Quiz UI
 * @param {HTMLElement} container - Container to render into
 * @param {Object} country - Country data with region/subregion
 * @param {Object} options - Configuration options
 * @param {Function} options.onAnswer - Callback when answer submitted
 * @param {Function} options.onHint - Callback when hint requested
 * @returns {Object} UI controls and methods
 */
export function renderOutlinesUI(container, country, options = {}) {
  const {
    onAnswer = () => {},
    onHint = () => {}
  } = options;
  
  // Build HTML
  const html = `
    <div style="max-width: 600px; margin: 0 auto;">
      <svg id="outline-svg" width="400" height="300" viewBox="0 0 600 320" style="display: block; margin: 0 auto 1rem; border: 1px solid var(--border-color); border-radius: 8px; background: var(--card-bg);"></svg>
      
      <p style="font-size: 1.1rem; margin-bottom: 1rem; text-align: center;">Which country is this?</p>
      
      <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
        <input type="text" id="outline-input" placeholder="Type country name..." 
          style="flex: 1; padding: 0.75rem; border: 1px solid var(--border-color); border-radius: 8px; background: var(--input-bg); color: var(--text-primary); font-size: 1rem;">
        <button id="outline-hint-btn" class="btn btn-secondary" style="padding: 0.75rem 1rem;">
          💡 Hint
        </button>
        <button id="outline-submit-btn" class="btn btn-primary" style="padding: 0.75rem 1.5rem;">
          Submit
        </button>
      </div>
      
      <div id="outline-hint" style="display: none; padding: 0.75rem; background: var(--card-bg); border-radius: 8px; margin-bottom: 1rem; color: var(--text-secondary);">
        <strong>Hint:</strong> Region: ${country.region}${country.subregion ? `, ${country.subregion}` : ''}
      </div>
      
      <div id="outline-feedback" style="display: none; padding: 1rem; border-radius: 8px; margin-top: 1rem;"></div>
    </div>
  `;
  
  container.innerHTML = html;
  
  // Get element references
  const elements = {
    svg: document.getElementById('outline-svg'),
    input: document.getElementById('outline-input'),
    submitBtn: document.getElementById('outline-submit-btn'),
    hintBtn: document.getElementById('outline-hint-btn'),
    hint: document.getElementById('outline-hint'),
    feedback: document.getElementById('outline-feedback')
  };
  
  // Helper: show feedback message
  function showFeedback(message, isCorrect) {
    if (!elements.feedback) return;
    
    elements.feedback.textContent = message;
    elements.feedback.style.display = 'block';
    elements.feedback.style.background = isCorrect ? 
      'rgba(5, 150, 105, 0.1)' : 'rgba(220, 38, 38, 0.1)';
    elements.feedback.style.borderLeft = `4px solid ${isCorrect ? '#059669' : '#dc2626'}`;
  }
  
  // Helper: hide feedback
  function hideFeedback() {
    if (elements.feedback) {
      elements.feedback.style.display = 'none';
    }
  }
  
  // Helper: show hint
  function showHint() {
    if (elements.hint) {
      elements.hint.style.display = 'block';
    }
    if (elements.hintBtn) {
      elements.hintBtn.disabled = true;
      elements.hintBtn.style.opacity = '0.5';
    }
  }
  
  // Helper: disable inputs
  function disableInputs() {
    if (elements.input) elements.input.disabled = true;
    if (elements.submitBtn) elements.submitBtn.disabled = true;
    if (elements.hintBtn) elements.hintBtn.disabled = true;
  }
  
  // Return public API
  return {
    elements,
    showFeedback,
    hideFeedback,
    showHint,
    disableInputs,
    
    // Event setup helper
    setupEvents({ onSubmit, onHintClick }) {
      // Submit answer
      if (elements.submitBtn && onSubmit) {
        elements.submitBtn.addEventListener('click', onSubmit);
      }
      
      // Enter key
      if (elements.input && onSubmit) {
        elements.input.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') onSubmit();
        });
        
        // Auto-focus on non-mobile
        if (!isMobileDevice()) {
          elements.input.focus();
        }
      }
      
      // Hint button
      if (elements.hintBtn && onHintClick) {
        elements.hintBtn.addEventListener('click', onHintClick);
      }
    }
  };
}

// Helper: detect mobile device
function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}
