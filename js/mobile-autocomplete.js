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

  if (localStorage.getItem('geoquiz-autocomplete') === 'off') {
    return; // Disabled by user preference
  }
  
  const {
    maxSuggestions = 5,
    minChars = 1,
    onSelect = null,
    placeholder = 'Type to search...'
  } = options;
  
  // Create dropdown container (appended to body so it's never clipped by ancestors)
  const dropdown = document.createElement('div');
  dropdown.className = 'mobile-autocomplete-dropdown';
  dropdown.style.display = 'none';
  document.body.appendChild(dropdown);
  
  // Track currently highlighted index for keyboard navigation
  let highlightedIndex = -1;
  
  // Position & size the fixed dropdown relative to the input's viewport rect
  function sizeDropdown() {
    const rect = inputElement.getBoundingClientRect();
    const viewportW = window.visualViewport
      ? window.visualViewport.width
      : window.innerWidth;
    const viewportH = window.visualViewport
      ? window.visualViewport.height
      : window.innerHeight;
    const gap = 4;
    const margin = 16;

    // On iOS Safari, position:fixed is relative to the layout viewport, but
    // getBoundingClientRect() is relative to the visual viewport. When the
    // keyboard opens, visualViewport.offsetTop/Left becomes non-zero and we
    // must add it to convert to layout-viewport coordinates.
    // Android Chrome does NOT need this — there fixed is relative to the
    // visual viewport, so adding the offset would push the dropdown off-screen.
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const vvOffsetTop = (isIOS && window.visualViewport) ? window.visualViewport.offsetTop : 0;
    const vvOffsetLeft = (isIOS && window.visualViewport) ? window.visualViewport.offsetLeft : 0;

    // Vertical: open above input when keyboard is likely shown (little space below)
    const availableBelow = viewportH - rect.bottom - gap - margin;
    const availableAbove = rect.top - gap - margin;
    const showAbove = availableBelow < 120 && availableAbove > availableBelow;

    // Always use `top` (never `bottom`) so position:fixed reference is consistent
    // across iOS and Android. For the "above" case, translateY(-100%) flips the
    // element upward so its bottom edge sits at rect.top - gap, regardless of
    // how many items are in the dropdown.
    if (showAbove) {
      dropdown.style.maxHeight = Math.max(availableAbove, 80) + 'px';
      dropdown.style.top = (rect.top - gap + vvOffsetTop) + 'px';
      dropdown.style.transform = 'translateY(-100%)';
    } else {
      dropdown.style.maxHeight = Math.max(availableBelow, 80) + 'px';
      dropdown.style.top = (rect.bottom + gap + vvOffsetTop) + 'px';
      dropdown.style.transform = '';
    }

    // Horizontal: match input width but enforce a minimum, clamped to viewport
    const minW = 220;
    let width = Math.max(rect.width, minW);
    let left = rect.left;
    // Keep dropdown within viewport
    if (left + width > viewportW - margin) {
      left = Math.max(margin, viewportW - margin - width);
    }
    dropdown.style.left = (left + vvOffsetLeft) + 'px';
    dropdown.style.width = width + 'px';
  }

  // Filter and show suggestions
  function updateSuggestions(e) {
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

    // Auto-fill when exactly one suggestion matches, but not when user is deleting
    const isDeleting = e && e.inputType && e.inputType.startsWith('delete');
    if (matches.length === 1 && !isDeleting) {
      inputElement.value = matches[0];
      // Select the auto-completed suffix so accidental keystrokes replace it
      // rather than append to the end. Clicking or arrow keys deselect normally.
      inputElement.setSelectionRange(value.length, matches[0].length);
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
    sizeDropdown();
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
    if (inputElement.disabled) return; // Input disabled (e.g. MC shown) — ignore stale dropdown taps
    inputElement.value = value;
    dropdown.style.display = 'none';

    if (onSelect) {
      // Let the submit handler decide what to do with focus
      onSelect(value);
      return;
    }

    // No onSelect: blur to dismiss mobile keyboard
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
    const item = e.target.closest('.autocomplete-item');
    if (item) {
      const value = item.getAttribute('data-value');
      selectSuggestion(value);
      // Don't refocus - selectSuggestion already blurs to dismiss keyboard
    }
  });

  // Touch handling for better mobile experience
  let touchStartY = 0;
  let touchStartTime = 0;

  dropdown.addEventListener('touchstart', (e) => {
    if (e.target.closest('.autocomplete-item')) {
      touchStartY = e.touches[0].clientY;
      touchStartTime = Date.now();
    }
  }, { passive: true });

  dropdown.addEventListener('touchend', (e) => {
    const item = e.target.closest('.autocomplete-item');
    if (item) {
      const touchEndY = e.changedTouches[0].clientY;
      const touchEndTime = Date.now();
      const deltaY = Math.abs(touchEndY - touchStartY);
      const deltaTime = touchEndTime - touchStartTime;

      // Only select if it's a tap (not a scroll)
      // Tap: small movement (<10px) and quick (<300ms)
      if (deltaY < 10 && deltaTime < 300) {
        e.preventDefault();
        const value = item.getAttribute('data-value');
        selectSuggestion(value);
        inputElement.focus();
      }
    }
  });
  
  // Re-size dropdown when viewport changes (e.g. mobile keyboard open/close)
  const resizeTarget = window.visualViewport || window;
  const onResize = () => {
    if (dropdown.style.display !== 'none') sizeDropdown();
  };
  resizeTarget.addEventListener('resize', onResize);

  // Clean up function
  return () => {
    resizeTarget.removeEventListener('resize', onResize);
    dropdown.remove();
  };
}

// Track visual viewport height as --vvh CSS variable.
// window.visualViewport.height shrinks when the keyboard opens on both iOS and
// Android, unlike `vh`/`svh` which are tied to the layout viewport.
// CSS uses var(--vvh) to fill the page and eliminate the gap below game cards.
(function trackVisualViewport() {
  if (!window.visualViewport) return;
  const update = () => {
    document.documentElement.style.setProperty('--vvh', window.visualViewport.height + 'px');
  };
  window.visualViewport.addEventListener('resize', update);
  update();
})();

// Export for use in other modules
window.initMobileAutocomplete = initMobileAutocomplete;
