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
    await sleep(3000);
  }

  console.log(`\nDone! OK: ${ok}  Failed: ${fail}`);
  if (ok > 0) {
    console.log(`\nOptimize with:\n  cd img/heritage && sips --resampleWidth 1920 --setProperty formatOptions 85 *.jpg`);
  }
}

main().catch(console.error);
