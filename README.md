# 🌍 GeoQuiz - Interactive Geography Games

A collection of engaging geography quiz games to test and improve your knowledge of world geography. Play directly in your browser with beautiful, interactive maps and no installation required.

**[Play Now at geoquiz.info](https://geoquiz.info)** 🎮

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Games: 7](https://img.shields.io/badge/Games-7-green.svg)
![Countries: 195+](https://img.shields.io/badge/Countries-195%2B-orange.svg)

---

## 🎮 Games

### 🗺️ Connect the Countries
**Find the shortest land route between two countries**

Navigate from one country to another by typing neighboring countries. Can you find the optimal path? Features intelligent map zoom, flexible branching, and mobile-optimized interface.

- 🎯 Find shortest routes between any two countries
- 🔀 Branch from any country in your path (explore freely!)
- 📱 Fully optimized for mobile devices
- ⌨️ Autocomplete suggestions with keyboard navigation
- 🚀 Cleaned map data (no distant overseas territories)

[**Play Connect the Countries →**](route.html)

---

### 🎯 Find the Country
**Click on countries as fast as you can**

Race against the clock to find countries on the map. How fast can you find all 195 countries?

- ⏱️ Timed challenge mode
- 🗺️ Full world map with all territories
- 🎨 Beautiful color-coded feedback
- 📊 Track your best times
- 📱 Optimized pinch zoom and pan for mobile

[**Play Find the Country →**](find-country.html)

---

### 🏛️ Where is this? (UNESCO Heritage)
**Identify countries from UNESCO World Heritage Sites**

Can you recognize countries from their iconic UNESCO World Heritage Sites? Test your cultural geography knowledge!

- 🖼️ 47 stunning UNESCO World Heritage Sites
- 🎯 Two-attempt scoring: text input or multiple choice (after wrong answer)
- 💡 Hint button available (-1 star penalty)
- 🌍 Mix of natural wonders and cultural landmarks
- ⌨️ Smart autocomplete with all country names
- 📱 Optimized images for fast mobile loading (90% smaller!)

[**Play UNESCO Heritage →**](heritage.html)

---

### 🖼️ Guess the Country
**Identify countries by their outlines**

Can you recognize countries just by their shape? Test your geographical intuition!

- 🎭 Country outlines without labels
- ⌨️ Type country names (76+ aliases supported!)
- 💡 Hint system available
- ✅ Instant feedback
- ⌨️ Keyboard navigation for autocomplete

[**Play Guess the Country →**](outlines.html)

---

### 🏛️ Capitals Quiz
**Match capitals to their countries**

Test your knowledge of world capitals. From Kabul to Zagreb, how many can you get right?

- 🌍 All 195 UN-recognized countries
- 🎲 Randomized questions
- 📈 Score tracking
- 🎯 Multiple game modes

[**Play Capitals Quiz →**](capitals.html)

---

### 🧠 Geography Trivia
**General geography knowledge questions**

Broader geography questions covering continents, regions, landmarks, and more.

- 📚 120+ questions with interesting facts
- 🎭 Mix of serious geography and quirky trivia
- 💡 Detailed explanations for each answer
- 📊 Score tracking

[**Play Geography Trivia →**](trivia.html)

---

## ✨ Features

### 🎨 Beautiful Interface
- **Dark/Light Mode** - Automatic theme switching based on system preferences
- **Responsive Design** - Works perfectly on desktop, tablet, and mobile
- **Smooth Animations** - Confetti celebrations and smooth transitions
- **Modern UI** - Clean, intuitive interface with card-based layout

### 🚀 Performance Optimized
- **82% Smaller Downloads** - GeoJSON files compressed with gzip (77 MB → 14 MB)
- **90% Image Optimization** - Heritage site images optimized for web (424 MB → 42 MB)
- **Client-side Decompression** - Fast loading using pako.js
- **Lazy Loading** - Games load only the data they need
- **Efficient Rendering** - Optimized SVG and Canvas map rendering

### 📱 Mobile-First Design
- **Touch-Optimized** - 44px touch targets, iOS Human Interface Guidelines compliant
- **Gesture Detection** - Smart tap vs scroll recognition for autocomplete
- **Auto-dismiss Keyboard** - Seamless input flow on mobile
- **Responsive Map Height** - Adapts to screen size (50vh with constraints)
- **Safe Area Support** - Works perfectly on notched phones (iPhone X+)
- **No Tap Highlight Flash** - Smooth interactions without visual artifacts
- **Grid Button Layout** - Easy to tap, no accidental presses

### ⌨️ Smart Input
- **Autocomplete** - Dropdown suggestions for all 195+ countries
- **Keyboard Navigation** - Use arrow keys (⬆️⬇️) to navigate autocomplete, Enter to select
- **Mobile Scrolling** - Touch-friendly autocomplete with gesture detection
- **76 Country Aliases** - Type "US" instead of "United States", "UK" instead of "United Kingdom"
- **Flexible Naming** - Accepts common variations and historical names

### 🗺️ Advanced Mapping
- **Antimeridian Handling** - Correctly displays Russia, Fiji, and other ±180° spanning countries
- **Pinch Zoom & Pan** - Smooth touch interactions on mobile with proper centering
- **Smart Zoom Limits** - Prevents over-zooming, handles tiny islands gracefully
- **No Accidental Taps** - Cooldown after pinch zoom prevents unintended country selection
- **Cleaned Route Data** - Removed distant overseas territories for better zoom behavior
- **Full Territory Display** - Complete maps with all territories for Find the Country game

---

## 🛠️ Technical Details

### Technology Stack
- **Vanilla JavaScript** - No frameworks, pure ES6+ modules
- **SVG Maps** - Vector graphics for crisp display at any zoom level
- **CSS3** - Modern styling with CSS Grid and Flexbox
- **HTML5** - Semantic markup

### Key Libraries
- **pako.js** (45 KB) - Gzip decompression for compressed map data
- **Natural Earth Data** - High-quality geographic data

### Data Files
- **Country Geometries** - 6.7 MB compressed (from 23 MB original)
- **Route Game Data** - 7.8 MB compressed (from 54 MB original)
- **Neighbors Graph** - Pre-computed country adjacencies
- **Places Data** - Capitals and major cities

### Browser Support
- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Mobile browsers (iOS Safari, Chrome Android)

---

## 🚀 Getting Started

### Play Online
Simply visit **[geoquiz.info](https://geoquiz.info)** - no installation needed!

### Run Locally

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/GeoQuiz.git
   cd GeoQuiz
   ```

2. **Start a local server**
   
   Using Python:
   ```bash
   python3 -m http.server 8080
   ```
   
   Using Node.js:
   ```bash
   npx http-server -p 8080
   ```
   
   Using PHP:
   ```bash
   php -S localhost:8080
   ```

3. **Open in browser**
   ```
   http://localhost:8080
   ```

> **Note:** A web server is required due to ES6 module imports and CORS restrictions on local files.

---

## 📂 Project Structure

```
GeoQuiz/
├── index.html              # Landing page with game selection
├── daily.html              # Daily Challenge landing page
├── daily-challenge.html    # Daily Challenge game container
├── route.html              # Connect the Countries game
├── find-country.html       # Find the Country game
├── heritage.html           # UNESCO Heritage game (formerly picture-guess.html)
├── outlines.html           # Guess the Country game
├── capitals.html           # Capitals quiz
├── trivia.html             # Geography trivia
│
├── css/
│   ├── styles.css          # Global styles with dark/light themes
│   └── daily-challenge.css # Daily challenge specific styles
│
├── js/
│   ├── daily-challenge-main.js      # Daily challenge orchestrator
│   ├── daily-challenge-scoring.js   # Difficulty-based star system
│   ├── daily-challenge-share.js     # Social sharing functionality
│   ├── seeded-random.js             # Deterministic RNG for daily challenges
│   │
│   ├── games/                       # Shared game logic modules
│   │   ├── trivia-logic.js
│   │   ├── find-logic.js
│   │   ├── outlines-logic.js
│   │   ├── picture-logic.js         # Heritage game logic
│   │   ├── heritage-logic.js        # Re-exports picture-logic
│   │   ├── capitals-logic.js
│   │   └── route-logic.js
│   │
│   ├── ui-components/               # Shared UI renderers
│   │   ├── picture-ui.js            # Heritage UI components
│   │   ├── heritage-ui.js           # Re-exports picture-ui
│   │   ├── outlines-renderer.js
│   │   ├── map-renderer.js
│   │   └── route-renderer.js
│   │
│   ├── route-main.js                # Route game initialization
│   ├── find-country-main.js         # Find country initialization
│   ├── heritage-main.js             # Heritage initialization
│   ├── outlines-main.js             # Outlines initialization
│   │
│   ├── mobile-autocomplete.js       # Shared autocomplete module
│   ├── aliases.js                   # 76 country name aliases
│   ├── geojson-loader.js            # Compressed file loader
│   ├── pako.min.js                  # Gzip decompression
│   ├── confetti.js                  # Victory animations
│   ├── theme.js                     # Dark/light mode
│   ├── game-utils.js                # Shared utilities
│   └── utils.js                     # Helper functions
│
├── data/
│   ├── ne_10m_admin_0_countries.geojson.gz        # 6.7 MB
│   ├── ne_10m_admin_0_countries_route.geojson.gz  # 7.8 MB
│   ├── heritage-sites.json                         # 47 UNESCO sites
│   ├── countries-neighbors.json
│   ├── places.geojson
│   ├── qa.json                                     # 120+ trivia questions
│   └── countries.geojson
│
├── img/
│   └── heritage/          # 47 optimized UNESCO images (42 MB)
│
└── process-countries.js   # Data processing script
```

---

## 🔧 Development

### Data Processing

To regenerate the cleaned route map data:

```bash
node process-countries.js
```

This script:
- Removes overseas territories from 9 countries (France, UK, US, Netherlands, Norway, Denmark, Portugal, Spain, Italy)
- Keeps Alaska for the United States
- Outputs to `data/ne_10m_admin_0_countries_route.geojson`

### Compressing Map Data

After modifying GeoJSON files:

```bash
cd data/
gzip -9 -k ne_10m_admin_0_countries.geojson
gzip -9 -k ne_10m_admin_0_countries_route.geojson
```

The `-9` flag maximizes compression, `-k` keeps the original files.

### Optimizing Images

To optimize large images for web:

```bash
cd img/heritage/
# Resize to max 1920px width, 85% JPEG quality
sips --resampleWidth 1920 --setProperty formatOptions 85 *.jpg
```

This reduces file sizes by ~90% while maintaining visual quality for web display.

### Mobile Testing

Test mobile layouts using browser DevTools:
- Chrome: F12 → Toggle Device Toolbar (Ctrl+Shift+M)
- Firefox: F12 → Responsive Design Mode (Ctrl+Shift+M)
- Safari: Develop → Enter Responsive Design Mode

Or test on real devices for best results.

---

## 📊 Recent Improvements

### v3.2 - Daily Challenge & Scoring System (February 2026)

#### 🎮 New Daily Challenge Mode
- **6 Mini-Games in One** - Complete all games in a single daily challenge
- **Difficulty-Based Scoring** - Stars based on game difficulty (1-5 stars per game, 23 total)
- **Speed Bonuses** - Earn extra stars for fast answers
- **Smart Penalties** - Using hints reduces your star count
- **Share Your Score** - Copy formatted results to share with friends
- **Once-Per-Day** - New challenge every day for everyone
- **Streak Tracking** - Track your daily completion streak

#### ⭐ New Scoring System
- **Trivia**: 1 base star + 1 speed bonus (< 5 seconds)
- **Heritage**: 2 base + 1 time bonus - 1 hint penalty
- **Outlines/Capitals**: 3 base + 1 time bonus - 1 hint penalty
- **Find/Connect**: 4-5 stars based on performance
- **Total**: 23 stars maximum per day

#### 🏛️ Heritage Game Enhancements
- **Multiple Choice Support** - Get multiple choice buttons after wrong text answer
- **Hint System** - Request hints at cost of 1 star
- **Time Tracking** - Accurate time measurement for speed bonuses
- **Proper Scoring** - Correct star calculation with time bonuses

#### 🗺️ Map Interaction Improvements
- **Pan/Zoom Constraints** - Countries always remain partially visible (20% minimum)
- **No Touch Flicker** - Removed mobile tap highlight artifacts
- **Smooth Canvas** - Optimized rendering for mobile devices
- **Better Controls** - Improved touch interaction on all map games

### v3.1 - Game Renaming & UI Polish (February 2026)

#### 📝 Heritage Branding
- **Renamed "Where is this?"** to **"UNESCO Heritage"**
- Updated all references in UI and code
- Maintained backward compatibility with old URLs

#### 🎯 UI Improvements  
- **Globe Ring Alignment** - Fixed positioning on index page
- **Star Display** - Proper wrapping for long star counts
- **Time Format** - One decimal place for all times
- **Rating System** - Updated for 23-star total

### v3.0 - New Game & Mobile Enhancements (February 2026)

#### 🏛️ New Game: Where is this?
- **47 UNESCO World Heritage Sites** - Stunning images from around the world
- **Two-Attempt Scoring** - Text input (2 pts) or multiple choice (1 pt)
- **Optimized Images** - 90% size reduction (424 MB → 42 MB)
- **Smart Alternatives** - Region-based multiple choice options
- **Full Autocomplete** - All 195+ countries with keyboard navigation

#### ⌨️ Enhanced Autocomplete (All Games)
- **Keyboard Navigation** - Arrow keys (⬆️⬇️), Enter to select, Escape to close
- **Dark Mode Visibility** - Opaque background with backdrop blur
- **Unlimited Suggestions** - Shows all matching countries, scrollable
- **Mobile Scrolling** - Smart tap vs scroll gesture detection
- **Compact Design** - Space-efficient rows matching input height

#### 📱 Mobile Touch Improvements
- **Pinch Zoom Centering** - Properly centers on finger midpoint
- **No Accidental Selection** - 300ms cooldown after pinch zoom
- **No Tap Flash** - Removed webkit tap highlight artifact
- **Gesture Detection** - Distinguishes taps from scrolls (10px/300ms threshold)

#### 🗺️ Map Enhancements
- **Smart Zoom Limits** - Respects minimum zoom, handles tiny islands
- **Tiny Island Detection** - Minimum 10° visible area for small countries
- **Increased Padding** - 40% padding for better country visibility

#### 🧠 Trivia Updates
- **120+ Questions** - Added 25 new quirky geography facts
- **Error Corrections** - Fixed 3 wrong answers in existing questions
- **Humor & Facts** - Mix of serious geography and entertaining trivia

### v2.0 - Major Enhancements (2025)

#### 📱 Mobile Usability
- **44px Touch Targets** - iOS compliant button sizes
- **Auto-dismiss Keyboard** - Shows map updates after each answer
- **Autocomplete Dropdown** - 195+ country suggestions while typing
- **Responsive Map** - 50vh height with smart constraints
- **Safe Area Support** - Works on iPhone X+ notched devices

#### 🗺️ Map Fixes
- **Russia ViewBox Error** - Fixed antimeridian-crossing countries
- **Flexible Branching** - Add countries from any point in your path
- **Cleaned Route Data** - Removed overseas territories for better zoom

#### 🚀 Performance
- **82% Size Reduction** - 77 MB → 14 MB (compressed GeoJSON)
- **Client-side Decompression** - Fast loading with pako.js
- **Repository Cleanup** - 100 MB removed from Git history

#### ⌨️ User Experience
- **76 Country Aliases** - Type "US", "UK", "DR Congo", etc.
- **Smart Input** - Autocomplete with all countries and aliases
- **Better Error Messages** - Clear feedback on invalid moves

---

## 🤝 Contributing

Contributions are welcome! Here are some ways you can help:

- 🐛 Report bugs via [GitHub Issues](https://github.com/yourusername/GeoQuiz/issues)
- 💡 Suggest new features or improvements
- 🌍 Add more country aliases for common abbreviations
- 🎨 Improve UI/UX design
- 📱 Test on different devices and browsers
- 📝 Improve documentation

### Adding Country Aliases

Edit `js/aliases.js`:

```javascript
export const COUNTRY_ALIASES = {
  // Existing aliases...
  "Your Alias": "Official Country Name",
};
```

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Natural Earth** - Free vector and raster map data ([naturalearthdata.com](https://www.naturalearthdata.com/))
- **pako.js** - Fast zlib port to JavaScript
- **United Nations** - Country definitions and standards

---

## 📞 Contact

- **Website:** [geoquiz.info](https://geoquiz.info)
- **Issues:** [GitHub Issues](https://github.com/yourusername/GeoQuiz/issues)
- **Email:** your.email@example.com

---

## 🎯 Fun Facts

- 🌍 **195 Countries** - All UN-recognized countries included
- 🎮 **7 Game Modes** - Six standalone + Daily Challenge
- 🏆 **23 Stars** - Maximum daily challenge score
- 🏛️ **47 UNESCO Sites** - From Great Wall to Machu Picchu
- 📚 **120+ Trivia Questions** - Mix of facts and fun
- 🗺️ **2.2M Lines** - Of GeoJSON coordinate data
- 💾 **14 MB** - Total compressed map data size
- 🖼️ **42 MB** - Optimized heritage images (was 424 MB!)
- ⚡ **90%** - Image size reduction from optimization
- 📱 **44px** - Minimum touch target size (iOS standard)
- 🔀 **76** - Country name aliases supported
- ⌨️ **4 Keys** - Arrow keys + Enter for autocomplete navigation
- 🎯 **20%** - Minimum country visibility constraint for pan/zoom

---

**Made with ❤️ for geography enthusiasts worldwide** 🌍
