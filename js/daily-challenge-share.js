/**
 * Daily Challenge - Social Sharing
 * 
 * Generates shareable text with emojis for social media posts.
 * Handles copy-to-clipboard functionality with fallbacks.
 */

import { getChallengeNumber } from './seeded-random.js';
import { getRating, formatTime } from './daily-challenge-scoring.js';

/**
 * Generate shareable text for social media
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {number} totalStars - Total stars earned (0-23)
 * @param {number} totalTime - Total time in seconds
 * @param {Array} breakdown - Array of per-game results
 * @param {object} stats - Player statistics
 * @returns {string} Formatted shareable text
 */
export function generateShareText(date, totalStars, totalTime, breakdown, stats) {
  const challengeNum = getChallengeNumber(date);
  const rating = getRating(totalStars);
  const timeStr = formatTime(totalTime);
  
  // Format date as "Feb 6, 2026"
  const dateObj = new Date(date + 'T00:00:00');
  const dateFormatted = dateObj.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });

  const gameEmojis = {
    find: '🗺️',
    trivia: '📚',
    outlines: '🌍',
    picture: '🖼️',
    capitals: '🏛️',
    connect: '🔗'
  };

  const gameNames = {
    find: 'Find Country',
    trivia: 'Trivia',
    outlines: 'Outlines',
    picture: 'Heritage',
    capitals: 'Capitals',
    connect: 'Connect'
  };
  
  const maxStars = {
    find: 5,
    trivia: 2,
    outlines: 4,
    picture: 3,
    capitals: 4,
    connect: 5
  };

  let text = `🌍 GeoQuiz Daily Challenge #${challengeNum}\n`;
  text += `📅 ${dateFormatted}\n\n`;
  text += `⭐ ${totalStars}/23 stars in ${timeStr}\n\n`;

  breakdown.forEach(result => {
    const emoji = gameEmojis[result.gameId];
    const name = gameNames[result.gameId].padEnd(12);
    const max = maxStars[result.gameId] || 5;
    const starStr = '⭐'.repeat(result.stars) + '☆'.repeat(max - result.stars);
    const timeStr = result.time !== undefined && result.time !== null ? `${result.time.toFixed(1)}s` : '';
    const extras = result.usedHint ? ' 💡' : '';
    const parInfo = result.parDiff !== undefined ? 
      (result.parDiff === 999 ? ' gave up' : ` par${result.parDiff > 0 ? '+' : ''}${result.parDiff}`) : '';
    
    text += `${emoji} ${name} ${starStr} ${timeStr}${extras}${parInfo}\n`;
  });

  text += `\n🔥 Streak: ${stats.currentStreak} day${stats.currentStreak !== 1 ? 's' : ''}\n`;
  text += `🎯 Rating: ${rating}\n\n`;
  text += `Play at: https://geoquiz.info/daily.html`;

  return text;
}

/**
 * Copy text to clipboard with modern API and fallback
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} True if successful
 */
export async function copyToClipboard(text) {
  // Try modern clipboard API first
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('Clipboard API failed, trying fallback:', err);
    }
  }

  // Fallback for older browsers
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    document.body.appendChild(textarea);
    
    textarea.focus();
    textarea.select();
    
    const successful = document.execCommand('copy');
    document.body.removeChild(textarea);
    
    return successful;
  } catch (err) {
    console.error('Copy fallback failed:', err);
    return false;
  }
}

/**
 * Show notification toast
 * @param {string} message - Message to display
 * @param {string} type - Notification type ('success', 'error', 'info')
 */
export function showNotification(message, type = 'success') {
  // Remove existing notifications
  const existing = document.querySelectorAll('.share-notification');
  existing.forEach(el => el.remove());

  const notification = document.createElement('div');
  notification.className = `share-notification share-notification-${type}`;
  notification.textContent = message;
  
  document.body.appendChild(notification);

  // Trigger animation
  setTimeout(() => notification.classList.add('show'), 10);

  // Remove after 3 seconds
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

/**
 * Show modal with text for manual copying (ultimate fallback)
 * @param {string} text - Text to display
 */
export function showCopyModal(text) {
  const modal = document.createElement('div');
  modal.className = 'copy-modal';
  modal.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-content">
      <h3>📋 Copy Your Results</h3>
      <p>Select the text below and copy it manually:</p>
      <textarea readonly class="share-textarea">${text}</textarea>
      <div class="modal-buttons">
        <button class="btn btn-primary copy-btn">
          📋 Copy to Clipboard
        </button>
        <button class="btn btn-secondary close-btn">
          Close
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Auto-select text
  const textarea = modal.querySelector('.share-textarea');
  textarea.select();

  // Copy button
  modal.querySelector('.copy-btn').addEventListener('click', async () => {
    textarea.select();
    const success = await copyToClipboard(text);
    if (success) {
      showNotification('✅ Copied to clipboard!');
      modal.remove();
    } else {
      // If even this fails, just tell user to copy manually
      showNotification('Please copy the text manually', 'info');
    }
  });

  // Close button
  modal.querySelector('.close-btn').addEventListener('click', () => {
    modal.remove();
  });

  // Click backdrop to close
  modal.querySelector('.modal-backdrop').addEventListener('click', () => {
    modal.remove();
  });
}

/**
 * Handle share button click
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {number} totalStars - Total stars earned
 * @param {number} totalTime - Total time in seconds
 * @param {Array} breakdown - Per-game results
 * @param {object} stats - Player statistics
 */
export async function handleShare(date, totalStars, totalTime, breakdown, stats) {
  const text = generateShareText(date, totalStars, totalTime, breakdown, stats);
  
  const success = await copyToClipboard(text);
  
  if (success) {
    showNotification('✅ Copied to clipboard! Paste in your favorite app.');
  } else {
    // Show modal as last resort
    showCopyModal(text);
  }
}
