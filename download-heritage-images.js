/**
 * download-heritage-images.js
 * Downloads heritage site images from Wikipedia's pageimages API.
 * Run with: node download-heritage-images.js
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const outputDir = path.join(__dirname, 'img', 'heritage');

// Wikipedia article title → local filename
const sites = [
  // Previous batch
  { title: 'Sigiriya',                       filename: 'sigiriya.jpg' },
  { title: 'Persepolis',                     filename: 'persepolis.jpg' },
  { title: 'Himeji Castle',                  filename: 'himeji-castle.jpg' },
  { title: 'Hallstatt',                      filename: 'hallstatt.jpg' },
  { title: 'Abu Simbel temples',             filename: 'abu-simbel.jpg' },
  { title: 'Bryggen',                        filename: 'bryggen.jpg' },
  { title: 'Skellig Michael',                filename: 'skellig-michael.jpg' },
  { title: 'Havana',                          filename: 'old-havana.jpg' },
  { title: 'Luang Prabang',                  filename: 'luang-prabang.jpg' },
  { title: 'Cartagena de Indias',             filename: 'cartagena.jpg' },
  { title: 'Great Mosque of Djenné',         filename: 'great-mosque-djenne.jpg' },
  { title: 'Lalibela',                       filename: 'lalibela.jpg' },
  { title: 'Prague',                          filename: 'prague-historic-centre.jpg' },
  { title: 'Þingvellir',                     filename: 'thingvellir.jpg' },
  { title: 'Gorée',                          filename: 'goree-island.jpg' },
  { title: 'Marrakesh',                      filename: 'marrakesh-medina.jpg' },
  { title: 'Hampi',                          filename: 'hampi.jpg' },
  { title: 'Potala Palace',                  filename: 'potala-palace.jpg' },
  { title: 'Teotihuacan',                    filename: 'teotihuacan.jpg' },
  { title: 'Old Bridge, Mostar',             filename: 'mostar-bridge.jpg' },
  // New batch — Africa
  { title: 'Table Mountain',                 filename: 'table-mountain.jpg' },
  { title: 'Ngorongoro Conservation Area',   filename: 'ngorongoro-crater.jpg' },
  { title: 'Stone Town',                     filename: 'stone-town-zanzibar.jpg' },
  { title: 'Great Zimbabwe',                 filename: 'great-zimbabwe.jpg' },
  { title: 'Okavango Delta',                 filename: 'okavango-delta.jpg' },
  { title: 'Cairo',                          filename: 'historic-cairo.jpg' },
  // New batch — Asia
  { title: 'Terracotta Army',               filename: 'terracotta-army.jpg' },
  { title: 'Hagia Sophia',                  filename: 'istanbul.jpg' },
  { title: 'Ayutthaya Historical Park',     filename: 'ayutthaya.jpg' },
  { title: 'Banaue Rice Terraces',          filename: 'rice-terraces-philippines.jpg' },
  { title: 'Registan',                      filename: 'samarkand.jpg' },
  { title: 'Prambanan',                     filename: 'prambanan-temple.jpg' },
  { title: 'Itsukushima Shrine',            filename: 'itsukushima-shrine.jpg' },
  { title: 'Bulguksa',                      filename: 'gyeongju.jpg' },
  { title: 'Boudhanath',                    filename: 'kathmandu-valley.jpg' },
  { title: 'Baalbek',                       filename: 'baalbek.jpg' },
  { title: 'Dome of the Rock',              filename: 'jerusalem-old-city.jpg' },
  { title: 'Wadi Rum',                      filename: 'wadi-rum.jpg' },
  { title: 'Naqsh-e Jahan Square',          filename: 'meidan-emam-isfahan.jpg' },
  { title: "Sana'a",                         filename: 'sanaa-old-city.jpg' },
  { title: 'Ellora Caves',                    filename: 'ellora-caves.jpg' },
  { title: 'Kinkaku-ji',                    filename: 'kyoto.jpg' },
  // New batch — Europe
  { title: 'Pompeii',                       filename: 'pompeii.jpg' },
  { title: 'Bruges',                        filename: 'bruges.jpg' },
  { title: 'Aletsch Glacier',               filename: 'jungfrau-aletsch.jpg' },
  { title: "Giant's Causeway",              filename: 'giants-causeway.jpg' },
  { title: 'Rila Monastery',               filename: 'rila-monastery.jpg' },
  { title: "Saint Basil's Cathedral",       filename: 'kremlin-red-square.jpg' },
  { title: 'Auschwitz concentration camp',  filename: 'auschwitz-birkenau.jpg' },
  { title: 'Delphi',                        filename: 'delphi.jpg' },
  { title: 'Cologne Cathedral',             filename: 'cologne-cathedral.jpg' },
  { title: 'Tower of London',               filename: 'tower-of-london.jpg' },
  { title: 'Suomenlinna',                   filename: 'suomenlinna.jpg' },
  { title: 'Tallinn',                       filename: 'tallinn.jpg' },
  { title: 'Bârsana',                        filename: 'maramures-churches.jpg' },
  // New batch — Americas
  { title: 'Independence Hall',             filename: 'independence-hall.jpg' },
  { title: 'Oaxaca',                        filename: 'oaxaca.jpg' },
  { title: 'Old Quebec',                    filename: 'old-quebec.jpg' },
  { title: 'Antigua Guatemala',             filename: 'antigua-guatemala.jpg' },
  { title: 'Plaza Mayor, Lima',             filename: 'lima.jpg' },
  { title: 'Nazca Lines',                   filename: 'nazca-lines.jpg' },
  { title: 'Valparaíso',                    filename: 'valparaiso.jpg' },
  { title: 'Tiwanaku',                      filename: 'tiwanaku.jpg' },
  { title: 'Angel Falls',                   filename: 'canaima-angel-falls.jpg' },
  { title: 'Colonia del Sacramento',        filename: 'colonia-del-sacramento.jpg' },
  { title: 'Christ the Redeemer (statue)',  filename: 'rio-de-janeiro.jpg' },
  // New batch — Oceania
  { title: 'Tongariro National Park',       filename: 'tongariro.jpg' },
  { title: 'Sydney Opera House',            filename: 'sydney-opera-house.jpg' },
  // New batch — Caribbean
  { title: 'Pitons (Saint Lucia)',          filename: 'pitons-saint-lucia.jpg' },
];

const HEADERS = { 'User-Agent': 'GeoQuiz/1.0 (heritage image downloader; geoquiz.info)' };

function httpsGet(reqUrl, opts = {}) {
  return new Promise((resolve, reject) => {
    https.get(reqUrl, { headers: HEADERS, ...opts }, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(httpsGet(res.headers.location, opts));
        res.resume();
        return;
      }
      resolve(res);
    }).on('error', reject);
  });
}

async function getJSON(apiUrl) {
  const res = await httpsGet(apiUrl);
  return new Promise((resolve, reject) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try { resolve(JSON.parse(data)); }
      catch (e) { reject(e); }
    });
    res.on('error', reject);
  });
}

async function downloadImage(imageUrl, outputPath) {
  const res = await httpsGet(imageUrl);
  if (res.statusCode !== 200) throw new Error(`HTTP ${res.statusCode}`);
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    res.pipe(file);
    file.on('finish', () => { file.close(); resolve(); });
    file.on('error', (err) => {
      fs.unlink(outputPath, () => {});
      reject(err);
    });
  });
}

async function getWikipediaImageUrl(articleTitle) {
  const encoded = encodeURIComponent(articleTitle);
  const apiUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&pithumbsize=1920&pilicense=any&format=json&redirects=1&titles=${encoded}`;
  const data = await getJSON(apiUrl);
  const pages = data?.query?.pages;
  if (!pages) return null;
  const page = Object.values(pages)[0];
  return page?.thumbnail?.source || null;
}

async function processSite(site) {
  const outputPath = path.join(outputDir, site.filename);

  if (fs.existsSync(outputPath)) {
    console.log(`⏭  ${site.filename} (already exists)`);
    return true;
  }

  try {
    const imageUrl = await getWikipediaImageUrl(site.title);
    if (!imageUrl) {
      console.error(`✗  No image found for article: "${site.title}"`);
      return false;
    }
    await downloadImage(imageUrl, outputPath);
    const srcFile = imageUrl.split('/').slice(-1)[0].split('?')[0];
    console.log(`✓  ${site.filename}  ← ${decodeURIComponent(srcFile)}`);
    return true;
  } catch (err) {
    console.error(`✗  ${site.filename}: ${err.message}`);
    return false;
  }
}

async function main() {
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  console.log(`Downloading ${sites.length} heritage images → ${outputDir}/\n`);
  let ok = 0, fail = 0;

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // Sequential with delay to respect Wikipedia's rate limits
  for (const site of sites) {
    let success = await processSite(site);
    // Retry once on rate-limit
    if (!success) {
      console.log(`   retrying ${site.filename} in 8s...`);
      await sleep(8000);
      success = await processSite(site);
    }
    if (success) ok++; else fail++;
    await sleep(8000);
  }

  console.log(`\nDone! OK: ${ok}  Failed: ${fail}`);
  if (ok > 0) {
    console.log(`\nOptimize with:\n  cd img/heritage && sips --resampleWidth 1920 --setProperty formatOptions 85 *.jpg`);
  }
}

main().catch(console.error);
