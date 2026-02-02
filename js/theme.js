/**
 * Theme management for GeoQuiz
 * Handles dark/light mode toggle with localStorage persistence
 */

const STORAGE_KEY = 'geoquiz-theme';

/**
 * Get system color scheme preference
 */
function getSystemPreference() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Get saved theme preference from localStorage
 */
function getSavedPreference() {
  return localStorage.getItem(STORAGE_KEY);
}

/**
 * Get current theme (saved preference or system default)
 */
function getTheme() {
  return getSavedPreference() || getSystemPreference();
}

/**
 * Apply theme to document
 */
function applyTheme(theme) {
  // Remove from both html and body to clean up
  document.documentElement.classList.remove('light-mode');
  document.body.classList.remove('light-mode');
  
  if (theme === 'light') {
    // Apply to html (documentElement) where CSS variables are inherited from
    document.documentElement.classList.add('light-mode');
  }
  updateThemeIcon(theme);
}

/**
 * Update theme toggle button icon
 */
function updateThemeIcon(theme) {
  const iconEl = document.querySelector('.theme-icon');
  if (iconEl) {
    iconEl.textContent = theme === 'light' ? '🌙' : '☀️';
  }
}

/**
 * Toggle between light and dark themes
 */
function toggleTheme() {
  const currentTheme = getTheme();
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  localStorage.setItem(STORAGE_KEY, newTheme);
  applyTheme(newTheme);
}

/**
 * Initialize theme on page load
 */
function initTheme() {
  const theme = getTheme();
  applyTheme(theme);
  
  // Attach toggle handler
  const toggleBtn = document.getElementById('theme-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleTheme);
  }
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTheme);
} else {
  initTheme();
}
