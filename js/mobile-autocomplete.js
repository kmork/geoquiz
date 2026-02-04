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
 * Initialize autocomplete for an input field
 * @param {HTMLInputElement} inputElement - The input field to attach autocomplete to
 * @param {Array<string>} suggestions - Array of suggestion strings
 * @param {Object} options - Configuration options
 */
function initMobileAutocomplete(inputElement, suggestions, options = {}) {
  if (!inputElement || !suggestions) {
    return; // Don't init if missing required params
  }
  
  const {
    maxSuggestions = 5,
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
  
  // Track currently highlighted index for keyboard navigation
  let highlightedIndex = -1;
  
  // Filter and show suggestions
  function updateSuggestions() {
    const value = inputElement.value.trim();
    
    if (value.length < minChars) {
      dropdown.style.display = 'none';
      highlightedIndex = -1;
      return;
    }
    
    // Filter suggestions (case-insensitive, starts with)
    const matches = suggestions.filter(item => 
      item.toLowerCase().startsWith(value.toLowerCase())
    );
    
    if (matches.length === 0) {
      dropdown.style.display = 'none';
      highlightedIndex = -1;
      return;
    }
    
    // Show all matches (no limit - scrollable dropdown will handle overflow)
    const displayMatches = maxSuggestions ? matches.slice(0, maxSuggestions) : matches;
    
    // Build dropdown HTML
    dropdown.innerHTML = displayMatches.map((match, index) => {
      // Highlight matching text
      const regex = new RegExp(`(${value})`, 'gi');
      const highlighted = match.replace(regex, '<mark>$1</mark>');
      return `<div class="autocomplete-item" data-value="${match}" data-index="${index}">${highlighted}</div>`;
    }).join('');
    
    dropdown.style.display = 'block';
    highlightedIndex = -1; // Reset highlight when updating suggestions
  }
  
  // Highlight item by index
  function highlightItem(index) {
    const items = dropdown.querySelectorAll('.autocomplete-item');
    if (index < 0 || index >= items.length) return;
    
    // Remove previous highlight
    items.forEach(item => item.classList.remove('highlighted'));
    
    // Add highlight to current item
    if (items[index]) {
      items[index].classList.add('highlighted');
      // Scroll item into view if needed
      items[index].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    highlightedIndex = index;
  }
  
  // Select suggestion
  function selectSuggestion(value) {
    inputElement.value = value;
    dropdown.style.display = 'none';
    
    // Callback if provided (call BEFORE blur to let it process)
    if (onSelect) {
      onSelect(value);
    }
    
    // Blur input to dismiss keyboard on mobile (delayed to ensure it happens last)
    setTimeout(() => {
      inputElement.blur();
    }, 100);
  }
  
  // Event listeners
  inputElement.addEventListener('input', updateSuggestions);
  
  inputElement.addEventListener('focus', () => {
    if (inputElement.value.length >= minChars) {
      updateSuggestions();
    }
  });
  
  // Keyboard navigation
  inputElement.addEventListener('keydown', (e) => {
    const items = dropdown.querySelectorAll('.autocomplete-item');
    if (items.length === 0 || dropdown.style.display === 'none') return;
    
    switch(e.key) {
      case 'ArrowDown':
        e.preventDefault();
        highlightItem(Math.min(highlightedIndex + 1, items.length - 1));
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        highlightItem(Math.max(highlightedIndex - 1, 0));
        break;
        
      case 'Enter':
        if (highlightedIndex >= 0 && items[highlightedIndex]) {
          e.preventDefault();
          e.stopImmediatePropagation(); // Prevent other handlers on same element
          const value = items[highlightedIndex].getAttribute('data-value');
          selectSuggestion(value);
        }
        break;
        
      case 'Escape':
        e.preventDefault();
        dropdown.style.display = 'none';
        highlightedIndex = -1;
        break;
    }
  }, true); // Use capture phase to run before game's handler
  
  inputElement.addEventListener('blur', () => {
    // Delay to allow click on dropdown
    setTimeout(() => {
      dropdown.style.display = 'none';
      highlightedIndex = -1;
    }, 200);
  });
  
  dropdown.addEventListener('click', (e) => {
    if (e.target.matches('.autocomplete-item')) {
      const value = e.target.getAttribute('data-value');
      selectSuggestion(value);
      // Don't refocus - selectSuggestion already blurs to dismiss keyboard
    }
  });
  
  // Touch handling for better mobile experience
  let touchStartY = 0;
  let touchStartTime = 0;
  
  dropdown.addEventListener('touchstart', (e) => {
    if (e.target.matches('.autocomplete-item')) {
      touchStartY = e.touches[0].clientY;
      touchStartTime = Date.now();
    }
  }, { passive: true });
  
  dropdown.addEventListener('touchend', (e) => {
    if (e.target.matches('.autocomplete-item')) {
      const touchEndY = e.changedTouches[0].clientY;
      const touchEndTime = Date.now();
      const deltaY = Math.abs(touchEndY - touchStartY);
      const deltaTime = touchEndTime - touchStartTime;
      
      // Only select if it's a tap (not a scroll)
      // Tap: small movement (<10px) and quick (<300ms)
      if (deltaY < 10 && deltaTime < 300) {
        e.preventDefault();
        const value = e.target.getAttribute('data-value');
        selectSuggestion(value);
        inputElement.focus();
      }
    }
  });
  
  // Clean up function
  return () => {
    dropdown.remove();
  };
}

// Export for use in other modules
window.initMobileAutocomplete = initMobileAutocomplete;
