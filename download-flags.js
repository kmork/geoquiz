/**
 * download-flags.js
 * Downloads SVG flag images from flagcdn.com for all countries in the mapping.
 * Run with: node download-flags.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const flagsData = require('./data/countries-flags.json');
const outputDir = path.join(__dirname, 'img', 'flags');

// Create output directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const codes = Object.values(flagsData);
// Deduplicate
const uniqueCodes = [...new Set(codes)];

let downloaded = 0;
let skipped = 0;
let failed = 0;

function downloadFlag(code) {
  return new Promise((resolve) => {
    const outputPath = path.join(outputDir, `${code}.svg`);

    // Skip if already downloaded
    if (fs.existsSync(outputPath)) {
      skipped++;
      resolve();
      return;
    }

    const url = `https://flagcdn.com/${code}.svg`;
    const file = fs.createWriteStream(outputPath);

    https.get(url, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          downloaded++;
          console.log(`✓ ${code}`);
          resolve();
        });
      } else {
        file.close();
        fs.unlinkSync(outputPath);
        failed++;
        console.error(`✗ ${code} (HTTP ${response.statusCode})`);
        resolve();
      }
    }).on('error', (err) => {
      file.close();
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      failed++;
      console.error(`✗ ${code} (${err.message})`);
      resolve();
    });
  });
}

async function main() {
  console.log(`Downloading ${uniqueCodes.length} flags to ${outputDir}/`);

  // Download in batches of 10 to avoid overwhelming the server
  const batchSize = 10;
  for (let i = 0; i < uniqueCodes.length; i += batchSize) {
    const batch = uniqueCodes.slice(i, i + batchSize);
    await Promise.all(batch.map(downloadFlag));
  }

  console.log(`\nDone! Downloaded: ${downloaded}, Skipped: ${skipped}, Failed: ${failed}`);
}

main();
