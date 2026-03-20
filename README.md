# 🌍 GeoQuiz - Interactive Geography Games

A collection of engaging geography quiz games to test and improve your knowledge of world geography. Play directly in your browser with beautiful, interactive maps and no installation required.

**[Play Now at geoquiz.info](https://geoquiz.info)** 🎮

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Countries: 194](https://img.shields.io/badge/Countries-194-orange.svg)

---

## 🎮 Games

### 📅 Daily Challenge
**All games in one daily session**

Seven mini-games in sequence, same puzzle for everyone each day. Up to 24 stars per day.

- 🎮 Find · Trivia · Outlines · Heritage · Flags · Capitals · Route
- ⭐ 24 stars maximum (3+2+4+3+3+4+5)
- 📋 Shareable results
- 🔥 Daily streak tracking

[**Play Daily Challenge →**](daily.html)

---

### 🗺️ Countries
**Find countries on the map or spell their names from a scrambled hint.**

- 🎯 Find — click the correct country on the interactive world map
- 🔤 Spelling — unscramble country names letter by letter
- ⏱️ Timed challenge mode
- 📊 Track your best times

[**Play Countries →**](play.html?game=find)

---

### 🖼️ Country Outline
**Identify countries from their outline, rotate them to the correct orientation, or both.**

- ❓ Guess — name the country from its outline
- 🔄 Rotate — rotate the outline to its correct orientation (name shown)
- ⚡ Rotate & Guess — rotate and name the country
- ⌨️ 76+ country aliases supported
- 💡 Hint system available

[**Play Country Outline →**](play.html?game=outlines)

---

### 🏛️ Cities
**Guess capitals, place cities on the map, or spell city names from a scrambled hint.**

- 🏛️ Capitals — type the capital and locate it on the map
- 📍 Place Cities — pinpoint cities on the world map
- 🔤 Spelling — unscramble city names letter by letter
- 🌍 All 194 countries

[**Play Cities →**](play.html?game=capitals)

---

### 🧭 Route
**Find the land route between two countries through neighboring borders.**

Navigate from one country to another by typing neighboring countries. Can you find the optimal path?

- 🎯 Three difficulty levels (easy / normal / hard)
- 🔀 Branch from any country in your path
- ⌨️ Autocomplete suggestions with keyboard navigation
- 🚀 Cleaned map data (no distant overseas territories)

[**Play Route →**](play.html?game=route)

---

### 📚 Geography Trivia
**General geography knowledge questions**

Broader geography questions covering continents, regions, landmarks, and more.

- 📚 124 questions with interesting facts
- 🎭 Mix of serious geography and quirky trivia
- 💡 Detailed explanations for each answer

[**Play Geography Trivia →**](play.html?game=trivia)

---

### 🖼️ UNESCO Heritage
**Guess which country a UNESCO site belongs to, or pinpoint its location on the map.**

- 🖼️ 116 UNESCO World Heritage Sites
- 🎯 Guess — identify the country from a photo
- 📍 Locate — pinpoint the site on the world map
- 🌍 Mix of natural wonders and cultural landmarks

[**Play UNESCO Heritage →**](play.html?game=heritage)

---

### 🚩 Flags of the World
**Match the flag to the country**

Four flags, one right answer. Neighboring countries are used as distractors — making it much harder than it sounds.

- 🚩 239 country flags served locally (no external requests)
- 🌍 Neighbor-priority distractors
- ⚡ Short (10) / Medium (25) / Long (all) modes
- 📊 Score and accuracy tracking

[**Play Flags of the World →**](play.html?game=flags)

---

### 🌊 Rivers, Mountains & Peaks
**Click countries a river or mountain range spans, or pinpoint peaks on the map.**

- 🐟 27 rivers — click all countries a river flows through
- ⛰️ 16 mountain ranges — click all countries a range spans
- ▲ Peaks — pinpoint the highest peaks on the map
- 🗺️ Canvas map with toggle-click countries

[**Play Rivers, Mountains & Peaks →**](play.html?game=rivers)

---

### 🔗 Pairs
**Match countries with capitals, peaks, or cities — one wrong answer ends your streak.**

Three items on each side — scrambled. Identify the correct pairs. One wrong guess ends the game.

- 🏛️ Capitals — match countries with their capitals
- ⛰️ Peaks — match countries with their highest peaks
- 🏙️ Cities — match countries with their cities
- 🧩 Staggered-queue mechanic: always 2 safe matches and 1 decoy per side
- 🌍 Continent filter supported

[**Play Pairs →**](play.html?game=pairs)

---

### 🆚 Country Duel
**Two countries face off — pick the right answer to keep your streak alive!**

Compare two countries across different categories and pick the correct one.

[**Play Country Duel →**](play.html?game=duel)

---

### 📖 Study Mode
**Explore countries, rivers, mountains, heritage sites, and historical empires on an interactive map.**

- 🌍 Click any country to see flag, capital, population, and borders
- 🐟 Toggle river and mountain range overlays
- 🖼️ Toggle UNESCO heritage site markers
- 👑 Historical empires timeline
- 💡 Fun facts for each country

[**Explore Study Mode →**](study.html)

---

## ✨ Features

### 🎨 Interface
- **Dark/Light Mode** — automatic, with manual toggle
- **Responsive Design** — desktop, tablet, and mobile
- **Smooth Animations** — confetti and transitions
- **Continent Filter** — play many games with only one continent's countries

### 🚀 Performance
- **Compressed Maps** — GeoJSON compressed with gzip
- **Optimized Images** — heritage images reduced 90%
- **Client-side Decompression** — pako.js
- **Canvas Rendering** — Find the Country, geo-features, and peaks games use Canvas

### 📱 Mobile
- **Touch-Optimized** — 44px touch targets
- **Gesture Detection** — tap vs scroll for autocomplete
- **Pinch Zoom & Pan** — smooth map interactions
- **Safe Area Support** — notched phones (iPhone X+)

### ⌨️ Input
- **Autocomplete** — dropdown for all 194 countries
- **Keyboard Navigation** — arrow keys + Enter
- **76 Country Aliases** — "US", "UK", "DR Congo", etc.

---

## 🛠️ Technical Details

### Technology Stack
- **Vanilla JavaScript** — no frameworks, pure ES6 modules
- **SVG Maps** — vector graphics for most games
- **Canvas** — Find the Country, geo-features, and peaks games
- **CSS3** — custom properties for theming, Grid and Flexbox layout

### Key Libraries
- **pako.js** (45 KB) — gzip decompression for map data
- **Natural Earth Data** — geographic source data

### Browser Support
- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Mobile browsers (iOS Safari, Chrome Android)

---

## 🚀 Getting Started

### Play Online
Visit **[geoquiz.info](https://geoquiz.info)** — no installation needed.

### Run Locally

```bash
git clone https://github.com/yourusername/GeoQuiz.git
cd GeoQuiz
python3 -m http.server 8080
# then open http://localhost:8080
```

> A web server is required — ES6 modules don't work over `file://`.

---

## 📂 Project Structure

```
GeoQuiz/
├── index.html                  # Landing page with game selection
├── daily.html                  # Daily Challenge landing page
├── daily-challenge.html        # Daily Challenge game container
├── find-country.html           # Find the Country
├── outlines.html               # Country Outline (guess / rotate / both)
├── capitals.html               # Capitals of the World
├── cities.html                 # Place the Cities
├── spelling.html               # Spelling (countries or cities)
├── route.html                  # Route
├── heritage.html               # UNESCO Heritage (guess)
├── heritage-locate.html        # UNESCO Heritage (locate on map)
├── flags.html                  # Flags of the World
├── rivers.html                 # Rivers
├── mountains.html              # Mountain Ranges
├── peaks.html                  # Peaks (locate on map)
├── pairs.html                  # Pairs (capitals / peaks / cities)
├── duel.html                   # Country Duel
├── trivia.html                 # Geography Trivia
├── study.html                  # Study Mode
├── play.html                   # Difficulty / mode selection (all games)
│
├── css/
│   ├── styles.css              # Global styles, dark/light themes
│   └── daily-challenge.css     # Daily challenge styles
│
├── js/
│   ├── games/                  # Pure logic modules (no DOM)
│   │   ├── pairs-logic.js
│   │   ├── capitals-logic.js
│   │   ├── duel-logic.js
│   │   ├── find-logic.js
│   │   ├── flags-logic.js
│   │   ├── geo-features-logic.js   # Shared rivers + mountains logic
│   │   ├── heritage-logic.js
│   │   ├── heritage-locate-logic.js
│   │   ├── outlines-logic.js
│   │   ├── place-cities-logic.js
│   │   ├── rotated-logic.js
│   │   ├── route-logic.js
│   │   ├── spelling-logic.js
│   │   └── trivia-logic.js
│   │
│   ├── ui-components/          # DOM/SVG/Canvas renderers
│   │   ├── pairs-ui.js
│   │   ├── capitals-ui.js
│   │   ├── duel-ui.js
│   │   ├── find-country-ui.js
│   │   ├── flags-ui.js
│   │   ├── heritage-ui.js
│   │   ├── map-renderer.js
│   │   ├── outlines-renderer.js
│   │   ├── outlines-ui.js
│   │   ├── route-renderer.js
│   │   ├── spelling-ui.js
│   │   └── trivia-ui.js
│   │
│   ├── pairs-main.js
│   ├── capitals-main.js
│   ├── daily-challenge-main.js
│   ├── daily-challenge-scoring.js
│   ├── daily-challenge-share.js
│   ├── duel-main.js
│   ├── find-country-main.js
│   ├── flags-main.js
│   ├── geo-features-complete.js    # Shared canvas factory (rivers + mountains)
│   ├── heritage-main.js
│   ├── heritage-locate-main.js
│   ├── mountains-main.js
│   ├── outlines-main.js
│   ├── peaks-main.js
│   ├── place-cities-main.js
│   ├── rivers-main.js
│   ├── rotated-main.js
│   ├── route-main.js
│   ├── spelling-main.js
│   ├── study-main.js
│   ├── trivia-main.js
│   ├── seeded-random.js
│   │
│   ├── aliases.js              # 76 country name aliases
│   ├── canvas-map-engine.js    # Shared canvas world-map engine
│   ├── confetti.js
│   ├── data.js                 # window.DATA / window.ALL_COUNTRIES
│   ├── game-records.js         # Finish screen + localStorage records
│   ├── game-utils.js           # shuffleArray, hapticFeedback, etc.
│   ├── geojson-loader.js
│   ├── mobile-autocomplete.js
│   ├── pako.min.js
│   ├── theme.js
│   └── utils.js
│
├── data/
│   ├── ne_10m_admin_0_countries.geojson.gz       # Full world GeoJSON
│   ├── ne_10m_admin_0_countries_route.geojson.gz  # Cleaned for route game
│   ├── countries.json             # 233 entries (194 UN + 39 territories)
│   ├── heritage-sites.json        # 116 UNESCO sites
│   ├── mountain-ranges.json       # 16 mountain ranges with peaks
│   ├── places.geojson             # Capitals + major cities
│   ├── trivia.json                # 124 trivia questions
│   ├── rivers.json                # 27 rivers
│   ├── country-facts.json         # Fun facts per country
│   └── empires.json               # Historical empires timeline
│
└── img/
    ├── heritage/   # 116 optimized UNESCO images
    └── flags/      # 239 SVG flag files from flagcdn.com
```

---

## 🔧 Development

### Data Processing

```bash
# Regenerate cleaned route map data
node process-countries.js

# Compress GeoJSON after modifications
cd data/ && gzip -9 -k ne_10m_admin_0_countries.geojson
cd data/ && gzip -9 -k ne_10m_admin_0_countries_route.geojson

# Download flag SVGs from flagcdn.com (skips existing)
node download-flags.js

# Optimize heritage images (90% size reduction)
cd img/heritage/ && sips --resampleWidth 1920 --setProperty formatOptions 85 *.jpg
```

---

## 🤝 Contributing

Contributions are welcome!

- 🐛 Report bugs via [GitHub Issues](https://github.com/yourusername/GeoQuiz/issues)
- 💡 Suggest new features
- 🌍 Add country aliases in `js/aliases.js`
- 📱 Test on different devices and browsers

---

## 📄 License

MIT License — see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Natural Earth** — free vector map data ([naturalearthdata.com](https://www.naturalearthdata.com/))
- **pako.js** — fast zlib port to JavaScript
- **flagcdn.com** — flag SVG source

---

**Made with ❤️ for geography enthusiasts worldwide** 🌍
