Complete Analysis Report

       /Users/Knut.Mork/geoquiz/GeoQuiz/play.html - Full GAMES Object Structure

       The GAMES object is defined in lines 364-451 and contains these 9 games:

       GAMES object structure:
       const GAMES = {
         find:       { title, desc, url, fullCount: 194, pointsPerRound: 1, icon }
         outlines:   { title, desc, url, fullCount: 194, pointsPerRound: 2, icon }
         capitals:   { title, desc, url, fullCount: 194, pointsPerRound: 2, icon }
         trivia:     { title, desc, url, fullCount: 124, pointsPerRound: 1, icon }
         heritage:   { title, desc, url, pointsPerRound: null, icon, noContinent: true, customDifficulties: [...] }
         flags:      { title, desc, url, fullCount: 194, pointsPerRound: 1, icon }
         route:      { title, desc, url, fullCount: 194, pointsPerRound: null, icon, customDifficulties: [...], continentSlugs: [...] }
         rivers:     { title, desc, url, pointsPerRound: null, icon, noContinent: true, customDifficulties: [...] }
       }

       Key properties per game:
       - title: Display name (shown as heading)
       - desc: Short description (shown in header)
       - url: Base URL (e.g., find-country.html, heritage.html)
       - fullCount: Total countries (194 for UN members, varies for some)
       - pointsPerRound: Scoring multiplier (null for non-linear scoring games)
       - icon: HTML emoji or SVG for display
       - customDifficulties (optional): Array of difficulty objects instead of standard 3 (used for heritage, route, rivers)
       - noContinent (optional): If true, continent filtering is disabled (heritage, rivers)
       - continentSlugs (optional): Limits which continents show for the game (route excludes Oceania)

       Game record key format:
       - Standard games: {gameKey}-{continentSlug}-{diffKey} (e.g., flags-europe-short)
       - Custom difficulties: {diffKey}-{continentSlug} (e.g., heritage-short-africa)

       ---
       2. /Users/Knut.Mork/geoquiz/GeoQuiz/index.html - Homepage Game Cards

       The games grid section (lines 57-166) contains 12 glass-card elements:

       Games shown on homepage (in order):
       1. Daily Challenge → daily.html (no filtering)
       2. Find the Country → region.html?game=find (uses region.html for continent filtering)
       3. Guess the Country → region.html?game=outlines
       4. Capitals of the World → region.html?game=capitals
       5. Route → region.html?game=route
       6. Geography Trivia → play.html?game=trivia (no continent filtering)
       7. UNESCO Heritage → play.html?game=heritage (no continent filtering)
       8. Flags of the World → region.html?game=flags
       9. Rivers & Mountain Ranges → play.html?game=rivers (no continent filtering)
       10. Capital Pairs → region.html?game=capital-pairs
       11. Country Duel → region.html?game=duel
       12. Study Mode → study.html (no filtering)

       HTML structure of each card:
       <a href="[url]" class="glass-card">
         <div class="card-content">
           <div class="game-icon">[emoji]</div>
           <div class="card-title">[title]</div>
           <div class="card-description">[description]</div>
           <div class="play-button">Play Now →</div>
         </div>
       </a>

       Key routing pattern:
       - Games that support continent filtering: region.html?game=[gameKey]
       - Games that don't: play.html?game=[gameKey]

       ---
       3. CSS Files Overview

       Main CSS files:
       - /Users/Knut.Mork/geoquiz/GeoQuiz/css/index.css (402 lines) - Homepage styling
       - /Users/Knut.Mork/geoquiz/GeoQuiz/play.html (inline <style> in head, 335 lines) - Game selection screen
       - /Users/Knut.Mork/geoquiz/GeoQuiz/css/menu.css (189 lines) - Shared hamburger menu
       - Other game-specific: daily-challenge.css, duel.css, styles.css, study.css

       Design system (CSS variables):

       Both index.css and play.html use identical color variables:
       - Dark mode defaults (:root)
       - Light mode overrides (html.light-mode)

       Color variables:
       --bg-primary, --bg-gradient-1, --bg-gradient-2
       --text-primary, --text-secondary
       --accent-color, --accent-color-rgb
       --dot-color, --card-bg, --card-bg-hover
       --card-border, --card-border-hover, --card-shadow
       --button-bg, --button-bg-hover, --button-border, --button-border-hover
       --button-text, --button-text-hover
       --globe-gradient-1, --globe-gradient-2
       --ring-color

       Key CSS classes:
       - .glass-card (index.html) - Game cards with glassmorphism effect
       - .diff-card (play.html) - Difficulty selection cards
       - .games-grid - Responsive grid layout (auto-fit, minmax 300px)
       - .card-grid / .card-grid.two-cards - Play.html difficulty grids

       Responsive breakpoints:
       - Mobile: @media (max-width: 600px) for play.html
       - Mobile: @media (max-width: 640px) for index.html

Summary for Adding New Games

       To add a new game to the homepage:
       1. Add entry to GAMES object in play.html (lines 364-451)
       2. Add <a class="glass-card"> entry to games-grid in index.html (lines 57-166)
       3. Route to play.html (no filtering) or region.html (with filtering support)
       4. Define all required properties: title, desc, url, icon, pointsPerRound, fullCount
