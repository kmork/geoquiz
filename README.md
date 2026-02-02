# 🌍 GeoQuiz - Interactive Geography Games

A collection of engaging geography quiz games to test and improve your knowledge of world geography. Play directly in your browser with beautiful, interactive maps and no installation required.

**[Play Now at geoquiz.info](https://geoquiz.info)** 🎮

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Games: 5](https://img.shields.io/badge/Games-5-green.svg)
![Countries: 195+](https://img.shields.io/badge/Countries-195%2B-orange.svg)

---

## 🎮 Games

### 🗺️ Connect the Countries
**Find the shortest land route between two countries**

Navigate from one country to another by typing neighboring countries. Can you find the optimal path? Features intelligent map zoom, flexible branching, and mobile-optimized interface.

- 🎯 Find shortest routes between any two countries
- 🔀 Branch from any country in your path (explore freely!)
- 📱 Fully optimized for mobile devices
- ⌨️ Autocomplete suggestions for country names
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

[**Play Find the Country →**](find-country.html)

---

### 🖼️ Guess the Country
**Identify countries by their outlines**

Can you recognize countries just by their shape? Test your geographical intuition!

- 🎭 Country outlines without labels
- ⌨️ Type country names (76+ aliases supported!)
- 💡 Hint system available
- ✅ Instant feedback

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
- **Client-side Decompression** - Fast loading using pako.js
- **Lazy Loading** - Games load only the data they need
- **Efficient Rendering** - Optimized SVG map rendering

### 📱 Mobile-First Design
- **44px Touch Targets** - iOS Human Interface Guidelines compliant
- **Auto-dismiss Keyboard** - Seamless input flow on mobile
- **Responsive Map Height** - Adapts to screen size (50vh with constraints)
- **Safe Area Support** - Works perfectly on notched phones (iPhone X+)
- **Grid Button Layout** - Easy to tap, no accidental presses

### ⌨️ Smart Input
- **Autocomplete** - Dropdown suggestions for all 195+ countries
- **76 Country Aliases** - Type "US" instead of "United States", "UK" instead of "United Kingdom"
- **Flexible Naming** - Accepts common variations and historical names

### 🗺️ Advanced Mapping
- **Antimeridian Handling** - Correctly displays Russia, Fiji, and other ±180° spanning countries
- **Pinch Zoom & Pan** - Smooth touch interactions on mobile
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
├── route.html              # Connect the Countries game
├── find-country.html       # Find the Country game
├── outlines.html           # Guess the Country game
├── capitals.html           # Capitals quiz
├── trivia.html            # Geography trivia
│
├── css/
│   └── styles.css         # Global styles with dark/light themes
│
├── js/
│   ├── route-main.js      # Route game initialization
│   ├── route-game.js      # Route game logic
│   ├── find-country-main.js
│   ├── outlines-main.js
│   ├── main.js            # Capitals game
│   ├── aliases.js         # 76 country name aliases
│   ├── geojson-loader.js  # Compressed file loader
│   ├── pako.min.js        # Gzip decompression
│   ├── confetti.js        # Victory animations
│   ├── theme.js           # Dark/light mode
│   └── utils.js           # Helper functions
│
├── data/
│   ├── ne_10m_admin_0_countries.geojson.gz        # 6.7 MB
│   ├── ne_10m_admin_0_countries_route.geojson.gz  # 7.8 MB
│   ├── countries-neighbors.json
│   ├── places.geojson
│   └── countries.geojson
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

### Mobile Testing

Test mobile layouts using browser DevTools:
- Chrome: F12 → Toggle Device Toolbar (Ctrl+Shift+M)
- Firefox: F12 → Responsive Design Mode (Ctrl+Shift+M)
- Safari: Develop → Enter Responsive Design Mode

Or test on real devices for best results.

---

## 📊 Recent Improvements

### v2.0 - Major Enhancements (February 2026)

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
- 🗺️ **2.2M Lines** - Of GeoJSON coordinate data
- 💾 **14 MB** - Total compressed map data size
- ⚡ **82%** - Size reduction from compression
- 📱 **44px** - Minimum touch target size (iOS standard)
- 🔀 **76** - Country name aliases supported

---

**Made with ❤️ for geography enthusiasts worldwide** 🌍
