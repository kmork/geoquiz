/**
 * Shared hamburger menu — About & Preferences.
 * Regular script (not a module) so it runs synchronously before theme.js.
 *
 * Data attributes on the <script> tag:
 *   data-autocomplete="false"      — hide the autocomplete toggle (default: true)
 *   data-btn-container=".selector" — append button inside this element (default: prepend to <body>)
 */
(function () {
  var script = document.currentScript;
  var showAutocomplete = script.getAttribute('data-autocomplete') !== 'false';
  var containerSel = script.getAttribute('data-btn-container');

  // ── Menu button ──────────────────────────────────────────────────────────

  var btn = document.createElement('button');
  btn.id = 'menu-btn';
  btn.className = 'menu-btn';
  btn.setAttribute('aria-label', 'Open menu');
  btn.textContent = '\u2630'; // ☰

  var container = containerSel ? document.querySelector(containerSel) : null;
  if (container) {
    container.appendChild(btn);
  } else {
    document.body.insertBefore(btn, document.body.firstChild);
  }

  // ── Overlay ──────────────────────────────────────────────────────────────

  var overlay = document.createElement('div');
  overlay.id = 'menu-overlay';
  overlay.className = 'menu-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Menu');

  var autocompleteRow = showAutocomplete
    ? '<div class="pref-row">'
      + '<div class="pref-label">'
      + '<span class="pref-label-title">Autocomplete</span>'
      + '<span class="pref-label-desc">Show suggestions while typing</span>'
      + '</div>'
      + '<button id="autocomplete-toggle" class="pref-toggle" role="switch" aria-checked="true" aria-label="Toggle autocomplete"></button>'
      + '</div>'
    : '';

  overlay.innerHTML =
    '<div class="menu-panel">'
    + '<button id="menu-close" class="menu-close" aria-label="Close menu">\u00d7</button>'

    // About
    + '<section class="menu-section">'
    + '<h2 class="menu-section-title">About</h2>'
    + '<div class="menu-about-header">'
    + '<img class="menu-about-globe" src="img/icon-logo-small.svg" alt="" width="28" height="28">'
    + '<span class="menu-about-name">Geo Quiz</span>'
    + '</div>'
    + '<p class="menu-about-text">'
    + 'A collection of interactive geography games &mdash; free for everyone, no ads, no cookies, just the fun of exploring the world.'
    + '</p>'
    + '<p class="menu-about-text">'
    + 'Created by <strong>Knut Mork</strong>.<br>'
    + 'Open source on <a class="menu-link" href="https://github.com/kmork/geoquiz" target="_blank" rel="noopener">GitHub</a>.'
    + '</p>'
    + '<p class="menu-about-text">'
    + 'Have a suggestion, found a bug, or want to contribute? '
    + '<a class="menu-link" href="https://github.com/kmork/geoquiz/issues" target="_blank" rel="noopener">Open an issue on GitHub</a> &mdash; all feedback is welcome!'
    + '</p>'
    + '</section>'

    // Preferences
    + '<section class="menu-section">'
    + '<h2 class="menu-section-title">Preferences</h2>'
    + '<div class="pref-row">'
    + '<div class="pref-label">'
    + '<span class="pref-label-title">Theme</span>'
    + '<span class="pref-label-desc">Dark or light mode</span>'
    + '</div>'
    + '<button id="theme-toggle" class="theme-toggle" aria-label="Toggle dark/light mode">'
    + '<span class="theme-icon">\u2600\ufe0f</span>'
    + '</button>'
    + '</div>'
    + autocompleteRow
    + '<div class="pref-row">'
    + '<div class="pref-label">'
    + '<span class="pref-label-title">Game Records</span>'
    + '<span class="pref-label-desc">Clears all saved best scores and times, and Where in the World data</span>'
    + '</div>'
    + '<button id="clear-records-btn" class="clear-records-btn">Clear</button>'
    + '</div>'
    + '<div class="pref-row">'
    + '<div class="pref-label">'
    + '<span class="pref-label-title">Cache</span>'
    + '<span class="pref-label-desc">Clear cached data and reload to get latest updates</span>'
    + '</div>'
    + '<button id="clear-cache-btn" class="clear-records-btn">Clear</button>'
    + '</div>'
    + '</section>'

    + '</div>';

  document.body.appendChild(overlay);

  // ── Event handlers ───────────────────────────────────────────────────────

  var closeBtn = document.getElementById('menu-close');
  var clearBtn = document.getElementById('clear-records-btn');

  btn.addEventListener('click', function () { overlay.classList.add('open'); });
  closeBtn.addEventListener('click', function () { overlay.classList.remove('open'); });
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) overlay.classList.remove('open');
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') overlay.classList.remove('open');
  });

  // Autocomplete toggle
  if (showAutocomplete) {
    var autocompleteBtn = document.getElementById('autocomplete-toggle');
    var autocompleteOn = localStorage.getItem('geoquiz-autocomplete') !== 'off';
    autocompleteBtn.setAttribute('aria-checked', String(autocompleteOn));
    autocompleteBtn.addEventListener('click', function () {
      var next = autocompleteBtn.getAttribute('aria-checked') !== 'true';
      autocompleteBtn.setAttribute('aria-checked', String(next));
      localStorage.setItem('geoquiz-autocomplete', next ? 'on' : 'off');
    });
  }

  // Clear game records + carmen state
  clearBtn.addEventListener('click', function () {
    var keys = Object.keys(localStorage).filter(function (k) {
      return k.startsWith('geoquiz-record-') || k.startsWith('carmen-');
    });
    keys.forEach(function (k) { localStorage.removeItem(k); });
    clearBtn.textContent = 'Cleared!';
    setTimeout(function () { clearBtn.textContent = 'Clear'; }, 2000);
  });

  // Clear cache (IndexedDB + browser cache) and force reload
  var clearCacheBtn = document.getElementById('clear-cache-btn');
  clearCacheBtn.addEventListener('click', function () {
    var tasks = [];
    // Delete IndexedDB cached GeoJSON
    tasks.push(new Promise(function (resolve) {
      var req = indexedDB.deleteDatabase('geoquiz-cache');
      req.onsuccess = resolve;
      req.onerror = resolve;
      req.onblocked = resolve;
    }));
    // Clear browser Cache API (cached JS/CSS/HTML)
    if (window.caches) {
      tasks.push(caches.keys().then(function (names) {
        return Promise.all(names.map(function (n) { return caches.delete(n); }));
      }));
    }
    Promise.all(tasks).then(function () {
      location.reload(true);
    });
  });
})();
