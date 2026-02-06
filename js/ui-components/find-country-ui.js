/**
 * Find Country UI Component
 * Shared UI rendering for both standalone and Daily Challenge modes
 */

/**
 * Renders the Find Country game UI
 * @param {HTMLElement} container - Container to render into
 * @param {Object} country - Country to find
 * @param {Object} options - Configuration options
 * @param {Function} options.onMapClick - Callback when map is clicked
 * @returns {Object} UI controls and methods
 */
export function renderFindCountryUI(container, country, options = {}) {
  const {
    onMapClick = () => {}
  } = options;
  
  // Build HTML
  const html = `
    <div style="max-width: 700px; margin: 0 auto;">
      <p style="font-size: 1.3rem; margin-bottom: 1rem; text-align: center;">
        Find: <strong>${country.country}</strong>
      </p>
      
      <div style="margin-bottom: 1rem;">
        <canvas id="find-map" style="width: 100%; height: auto; cursor: pointer; border-radius: 8px; border: 1px solid var(--border-color); background: var(--map-bg);"></canvas>
      </div>
      
      <div id="find-feedback" style="display: none; padding: 1rem; border-radius: 8px; margin-top: 1rem; text-align: center; font-size: 1.1rem;"></div>
    </div>
  `;
  
  container.innerHTML = html;
  
  // Get element references
  const elements = {
    canvas: document.getElementById('find-map'),
    feedback: document.getElementById('find-feedback')
  };
  
  // Helper: show feedback message
  function showFeedback(message, isCorrect) {
    if (!elements.feedback) return;
    
    elements.feedback.textContent = message;
    elements.feedback.style.display = 'block';
    elements.feedback.style.background = isCorrect ? 
      'rgba(5, 150, 105, 0.1)' : 'rgba(220, 38, 38, 0.1)';
    elements.feedback.style.borderLeft = `4px solid ${isCorrect ? '#059669' : '#dc2626'}`;
    elements.feedback.style.color = isCorrect ? '#059669' : '#dc2626';
    elements.feedback.style.fontWeight = 'bold';
  }
  
  // Helper: hide feedback
  function hideFeedback() {
    if (elements.feedback) {
      elements.feedback.style.display = 'none';
    }
  }
  
  // Return public API
  return {
    elements,
    showFeedback,
    hideFeedback,
    
    // Event setup helper
    setupEvents({ onCanvasClick }) {
      if (elements.canvas && onCanvasClick) {
        elements.canvas.addEventListener('click', onCanvasClick);
      }
    }
  };
}
