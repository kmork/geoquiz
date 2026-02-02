/**
 * Mobile Autocomplete Module
 * 
 * Provides custom autocomplete dropdown for mobile devices
 * (HTML5 datalist has poor mobile browser support)
 */

// Mobile device detection
function isMobileForAutocomplete() {
  return window.innerWidth <= 640 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

/**
 * Initialize mobile autocomplete for an input field
 * @param {HTMLInputElement} inputElement - The input field to attach autocomplete to
 * @param {Array<string>} suggestions - Array of suggestion strings
 * @param {Object} options - Configuration options
 */
function initMobileAutocomplete(inputElement, suggestions, options = {}) {
  if (!inputElement || !suggestions || !isMobileForAutocomplete()) {
    return; // Don't init on desktop or if missing required params
  }
  
  const {
    maxSuggestions = 8,
    minChars = 1,
    onSelect = null,
    placeholder = 'Type to search...'
  } = options;
  
  // Create dropdown container
  const dropdown = document.createElement('div');
  dropdown.className = 'mobile-autocomplete-dropdown';
  dropdown.style.display = 'none';
  
  // Insert dropdown after input
  inputElement.parentNode.insertBefore(dropdown, inputElement.nextSibling);
  
  // Filter and show suggestions
  function updateSuggestions() {
    const value = inputElement.value.trim();
    
    if (value.length < minChars) {
      dropdown.style.display = 'none';
      return;
    }
    
    // Filter suggestions (case-insensitive)
    const matches = suggestions.filter(item => 
      item.toLowerCase().includes(value.toLowerCase())
    );
    
    if (matches.length === 0) {
      dropdown.style.display = 'none';
      return;
    }
    
    // Show top N matches
    const topMatches = matches.slice(0, maxSuggestions);
    
    // Build dropdown HTML
    dropdown.innerHTML = topMatches.map(match => {
      // Highlight matching text
      const regex = new RegExp(`(${value})`, 'gi');
      const highlighted = match.replace(regex, '<mark>$1</mark>');
      return `<div class="autocomplete-item" data-value="${match}">${highlighted}</div>`;
    }).join('');
    
    dropdown.style.display = 'block';
  }
  
  // Select suggestion
  function selectSuggestion(value) {
    inputElement.value = value;
    dropdown.style.display = 'none';
    
    // Callback if provided
    if (onSelect) {
      onSelect(value);
    }
  }
  
  // Event listeners
  inputElement.addEventListener('input', updateSuggestions);
  
  inputElement.addEventListener('focus', () => {
    if (inputElement.value.length >= minChars) {
      updateSuggestions();
    }
  });
  
  inputElement.addEventListener('blur', () => {
    // Delay to allow click on dropdown
    setTimeout(() => {
      dropdown.style.display = 'none';
    }, 200);
  });
  
  dropdown.addEventListener('click', (e) => {
    if (e.target.matches('.autocomplete-item')) {
      const value = e.target.getAttribute('data-value');
      selectSuggestion(value);
      inputElement.focus();
    }
  });
  
  // Touch handling for better mobile experience
  dropdown.addEventListener('touchstart', (e) => {
    if (e.target.matches('.autocomplete-item')) {
      e.preventDefault(); // Prevent blur
      const value = e.target.getAttribute('data-value');
      selectSuggestion(value);
      inputElement.focus();
    }
  });
  
  // Clean up function
  return () => {
    dropdown.remove();
  };
}

// Export for use in other modules
window.initMobileAutocomplete = initMobileAutocomplete;
