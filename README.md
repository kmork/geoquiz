# 🌍 GeoQuiz - Interactive Geography Games

A collection of engaging geography quiz games to test and improve your knowledge of world geography. Play directly in your browser with beautiful, interactive maps and no installation required.

**[Play Now at geoquiz.info](https://geoquiz.info)** 🎮

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Games: 9](https://img.shields.io/badge/Games-9-green.svg)
![Countries: 194](https://img.shields.io/badge/Countries-194-orange.svg)

---

## 🎮 Games

### 🗺️ Connect the Countries
**Find the shortest land route between two countries**

Navigate from one country to another by typing neighboring countries. Can you find the optimal path? Features intelligent map zoom, flexible branching, and mobile-optimized interface.

- 🎯 Find shortest routes between any two countries
- 🔀 Branch from any country in your path
- ⌨️ Autocomplete suggestions with keyboard navigation
- 🚀 Cleaned map data (no distant overseas territories)

[**Play Connect the Countries →**](route.html)

---

### 🎯 Find the Country
**Click on countries as fast as you can**

Race against the clock to find countries on the map. How fast can you find all 194 countries?

- ⏱️ Timed challenge mode
- 🗺️ Full world map with all territories
- 🎨 Color-coded feedback
- 📊 Track your best times
- 📱 Pinch zoom and pan for mobile

[**Play Find the Country →**](find-country.html)

---

### 🖼️ Guess the Country
**Identify countries by their outlines**

Can you recognize countries just by their shape? Test your geographical intuition!

- 🎭 Country outlines without labels
- ⌨️ Type country names (76+ aliases supported)
- 💡 Hint system available
- ✅ Instant feedback

[**Play Guess the Country →**](outlines.html)

---

### 🏛️ Capitals of the World
**Find capitals on the map**

Test your knowledge of world capitals. Type the capital and locate it on the map.

- 🌍 All 194 countries
- 🗺️ Interactive map placement
- ⌨️ Autocomplete input
- 🎮 Short / Medium / Long modes

[**Play Capitals of the World →**](capitals.html)

---

### 🔗 Capital Pairs
**Match countries to their capitals**

Three countries, three capitals — scrambled. Identify the correct pairs. One wrong guess ends the game.

- 🧩 Staggered-queue mechanic: always 2 safe matches and 1 decoy per side
- ⚡ Short (10) / Medium (25) / Long (all 194) modes
- 🌍 Continent filter supported
- 📊 Score and accuracy tracking

[**Play Capital Pairs →**](capital-pairs.html)

---

### 🏛️ UNESCO Heritage
**Identify countries from World Heritage Sites**

Can you recognize countries from their iconic UNESCO World Heritage Sites?

- 🖼️ 47 stunning UNESCO World Heritage Sites
- 🎯 Two-attempt scoring: text input or multiple choice
- 💡 Hint button available
- 🌍 Mix of natural wonders and cultural landmarks

[**Play UNESCO Heritage →**](heritage.html)

---

### 🚩 Flags of the World
**Match the flag to the country**

Four flags, one right answer. Neighboring countries are used as distractors — making it much harder than it sounds.

- 🚩 239 country flags served locally (no external requests)
- 🌍 Neighbor-priority distractors
- ⚡ Short (10) / Medium (25) / Long (all) modes
- 📊 Score and accuracy tracking

[**Play Flags of the World →**](flags.html)

---

### 🌊 Rivers & Mountain Ranges
**Click every country a feature passes through**

Select all countries a river flows through or a mountain range spans, then submit. Correct countries score points; wrong ones subtract.

- 🐟 22 rivers and 16 mountain ranges
- 🗺️ Canvas map with toggle-click countries
- 🔵 River overlay (blue line) / ⛰️ Mountain overlay (brown dots)
- 🟡 Missed countries highlighted after reveal

[**Play Rivers & Mountain Ranges →**](rivers.html)

---

### 🧠 Geography Trivia
**General geography knowledge questions**

Broader geography questions covering continents, regions, landmarks, and more.

- 📚 120+ questions with interesting facts
- 🎭 Mix of serious geography and quirky trivia
- 💡 Detailed explanations for each answer

[**Play Geography Trivia →**](trivia.html)

---

### 📅 Daily Challenge
**All games in one daily session**

Seven mini-games in sequence, same puzzle for everyone each day. Up to 24 stars per day.

- 🎮 Find · Trivia · Outlines · Heritage · Flags · Capitals · Connect
- ⭐ 24 stars maximum (3+2+4+3+3+4+5)
- 📋 Shareable results
- 🔥 Daily streak tracking

[**Play Daily Challenge →**](daily.html)

---

## ✨ Features

### 🎨 Interface
- **Dark/Light Mode** — automatic, with manual toggle
- **Responsive Design** — desktop, tablet, and mobile
- **Smooth Animations** — confetti and transitions
- **Continent Filter** — play any game with only one continent's countries

### 🚀 Performance
- **Compressed Maps** — GeoJSON compressed with gzip (77 MB → 14 MB)
- **Optimized Images** — Heritage images reduced 90% (424 MB → 42 MB)
- **Client-side Decompression** — pako.js
- **Canvas Rendering** — Find the Country and geo-features games use Canvas for performance

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
- **Canvas** — Find the Country and geo-features games
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
├── route.html                  # Connect the Countries
├── find-country.html           # Find the Country
├── outlines.html               # Guess the Country
├── capitals.html               # Capitals of the World
├── capital-pairs.html          # Capital Pairs
├── heritage.html               # UNESCO Heritage
├── flags.html                  # Flags of the World
├── rivers.html                 # Rivers & Mountain Ranges
├── mountains.html              # Mountain Ranges (shares rivers UI)
├── trivia.html                 # Geography Trivia
├── play.html                   # Difficulty selection (all games)
│
├── css/
│   ├── styles.css              # Global styles, dark/light themes
│   └── daily-challenge.css     # Daily challenge styles
│
├── js/
│   ├── games/                  # Pure logic modules (no DOM)
│   │   ├── capital-pairs-logic.js
│   │   ├── capitals-logic.js
│   │   ├── find-logic.js
│   │   ├── flags-logic.js
│   │   ├── geo-features-logic.js   # Shared rivers + mountains logic
│   │   ├── heritage-logic.js
│   │   ├── outlines-logic.js
│   │   ├── route-logic.js
│   │   └── trivia-logic.js
│   │
│   ├── ui-components/          # DOM/SVG/Canvas renderers
│   │   ├── capital-pairs-ui.js
│   │   ├── flags-ui.js
│   │   ├── heritage-ui.js
│   │   ├── map-renderer.js
│   │   ├── outlines-renderer.js
│   │   └── route-renderer.js
│   │
│   ├── capital-pairs-main.js
│   ├── daily-challenge-main.js
│   ├── daily-challenge-scoring.js
│   ├── daily-challenge-share.js
│   ├── find-country-main.js
│   ├── flags-main.js
│   ├── geo-features-complete.js    # Shared canvas factory (rivers + mountains)
│   ├── heritage-main.js
│   ├── mountains-main.js
│   ├── outlines-main.js
│   ├── rivers-main.js
│   ├── route-main.js
│   ├── seeded-random.js
│   │
│   ├── aliases.js              # 76 country name aliases
│   ├── confetti.js
│   ├── data.js                 # window.DATA (194 countries + capitals)
│   ├── game-records.js         # Finish screen + localStorage records
│   ├── game-utils.js           # shuffleArray, hapticFeedback, etc.
│   ├── geojson-loader.js
│   ├── mobile-autocomplete.js
│   ├── pako.min.js
│   ├── theme.js
│   └── utils.js
│
├── data/
│   ├── ne_10m_admin_0_countries.geojson.gz       # 6.7 MB
│   ├── ne_10m_admin_0_countries_route.geojson.gz # 7.8 MB
│   ├── countries-continents.json   # country → continent mapping
│   ├── countries-flags.json        # country → ISO_A2 mapping
│   ├── countries-neighbors.json    # adjacency graph
│   ├── heritage-sites.json         # 47 UNESCO sites
│   ├── mountains.json              # 16 mountain ranges
│   ├── places.geojson              # capitals + major cities
│   ├── qa.json                     # 120+ trivia questions
│   └── rivers.json                 # 22 rivers
│
└── img/
    ├── heritage/   # 47 optimized UNESCO images (42 MB)
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

# Regenerate country → ISO_A2 flag mapping
node generate-flags-mapping.js

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
