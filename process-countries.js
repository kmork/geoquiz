#!/usr/bin/env node

/**
 * Process GeoJSON to remove overseas territories and fix antimeridian wraparound
 * 
 * This script:
 * 1. Removes distant overseas territories from specific countries
 * 2. Fixes coordinate wraparound for countries crossing ±180° longitude
 * 3. Keeps Alaska for the United States
 * 4. Removes isolated islands that don't connect to other countries
 */

const fs = require('fs');
const path = require('path');

// Load the original GeoJSON
const inputFile = path.join(__dirname, 'data', 'ne_10m_admin_0_countries.geojson');
const outputFile = path.join(__dirname, 'data', 'ne_10m_admin_0_countries_route.geojson');
const backupFile = path.join(__dirname, 'data', 'ne_10m_admin_0_countries_route.geojson.bak');

console.log('Loading GeoJSON data...');
const geojson = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

// Calculate polygon area using shoelace formula (approximate for geographic coordinates)
function calculatePolygonArea(coordinates) {
  if (!coordinates || coordinates.length === 0) return 0;
  
  let area = 0;
  const ring = coordinates[0]; // Use outer ring only
  
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    area += (x1 * y2) - (x2 * y1);
  }
  
  return Math.abs(area / 2);
}

// Calculate bounding box of a polygon
function getPolygonBounds(coordinates) {
  let minLon = Infinity, maxLon = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;
  
  for (const ring of coordinates) {
    for (const [lon, lat] of ring) {
      minLon = Math.min(minLon, lon);
      maxLon = Math.max(maxLon, lon);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }
  }
  
  return { minLon, maxLon, minLat, maxLat };
}

// Calculate centroid of a polygon
function getPolygonCentroid(coordinates) {
  let sumLon = 0, sumLat = 0, count = 0;
  
  for (const ring of coordinates) {
    for (const [lon, lat] of ring) {
      sumLon += lon;
      sumLat += lat;
      count++;
    }
  }
  
  return {
    lon: sumLon / count,
    lat: sumLat / count
  };
}

// Check if polygon crosses the antimeridian (±180° longitude)
function crossesAntimeridian(coordinates) {
  const bounds = getPolygonBounds(coordinates);
  // If the difference is very large (> 180°), it likely crosses the antimeridian
  return (bounds.maxLon - bounds.minLon) > 180;
}

// Shift coordinates to fix antimeridian wraparound
// For polygons crossing ±180°, normalize all longitudes to one side
function fixAntimeridianWrap(coordinates) {
  const bounds = getPolygonBounds(coordinates);
  
  if (!crossesAntimeridian(coordinates)) {
    return coordinates; // No fix needed
  }
  
  // If polygon crosses antimeridian, shift negative values to positive (0-360 range)
  return coordinates.map(ring => 
    ring.map(([lon, lat]) => {
      // Shift western hemisphere coordinates to eastern side (180-360)
      const newLon = lon < 0 ? lon + 360 : lon;
      return [newLon, lat];
    })
  );
}

// Define rules for keeping/removing polygons for specific countries
const COUNTRY_RULES = {
  'France': {
    // Keep only European mainland (roughly 42-51°N, -5-10°E)
    keep: (centroid, bounds) => {
      return centroid.lat > 41 && centroid.lat < 52 && 
             centroid.lon > -6 && centroid.lon < 11;
    }
  },
  'United Kingdom': {
    // Keep British Isles only (roughly 49-61°N, -8-2°E)
    keep: (centroid, bounds) => {
      return centroid.lat > 48 && centroid.lat < 62 && 
             centroid.lon > -9 && centroid.lon < 3;
    }
  },
  'United States of America': {
    // Keep continental US and Alaska (exclude Hawaii, territories)
    keep: (centroid, bounds) => {
      // Continental US: roughly 24-49°N, -125 to -66°E
      const isContinental = centroid.lat > 23 && centroid.lat < 50 && 
                           centroid.lon > -126 && centroid.lon < -65;
      // Alaska: roughly 51-72°N, -180 to -130°E
      const isAlaska = centroid.lat > 50 && centroid.lat < 73 && 
                      centroid.lon > -181 && centroid.lon < -129;
      return isContinental || isAlaska;
    }
  },
  'Netherlands': {
    // Keep European mainland only (roughly 50-54°N, 3-8°E)
    keep: (centroid, bounds) => {
      return centroid.lat > 49 && centroid.lat < 55 && 
             centroid.lon > 2 && centroid.lon < 9;
    }
  },
  'Norway': {
    // Keep mainland Norway, exclude Svalbard and distant islands
    // Mainland Norway: roughly 58-71°N, 4-32°E
    keep: (centroid, bounds) => {
      return centroid.lat > 57 && centroid.lat < 72 && 
             centroid.lon > 3 && centroid.lon < 33 &&
             centroid.lat < 75; // Exclude Svalbard (74-81°N)
    }
  },
  'Denmark': {
    // Keep Denmark mainland and nearby islands, exclude Greenland and Faroe Islands
    // Denmark: roughly 54-58°N, 8-16°E
    keep: (centroid, bounds) => {
      return centroid.lat > 53 && centroid.lat < 59 && 
             centroid.lon > 7 && centroid.lon < 16;
    }
  },
  'Portugal': {
    // Keep mainland Portugal, exclude Azores and Madeira
    // Mainland: roughly 37-42°N, -10 to -6°E
    keep: (centroid, bounds) => {
      return centroid.lat > 36 && centroid.lat < 43 && 
             centroid.lon > -10 && centroid.lon < -5;
    }
  },
  'Spain': {
    // Keep mainland Spain and Balearic Islands, exclude Canary Islands
    // Mainland + Balearics: roughly 36-44°N, -10 to 5°E
    keep: (centroid, bounds) => {
      return centroid.lat > 35 && centroid.lat < 45 && 
             centroid.lon > -10 && centroid.lon < 6;
    }
  },
  'Italy': {
    // Keep mainland Italy, Sicily, Sardinia - remove distant territories
    // Italy: roughly 36-48°N, 6-19°E
    keep: (centroid, bounds) => {
      return centroid.lat > 35 && centroid.lat < 48 && 
             centroid.lon > 5 && centroid.lon < 20;
    }
  }
};

// Process a feature (country)
function processFeature(feature) {
  const countryName = feature.properties.ADMIN;
  const geometry = feature.geometry;
  
  if (!geometry || geometry.type === 'Polygon') {
    // Single polygon - just check for antimeridian crossing
    if (geometry.type === 'Polygon') {
      const fixed = fixAntimeridianWrap(geometry.coordinates);
      if (fixed !== geometry.coordinates) {
        console.log(`  Fixed antimeridian wrap for ${countryName}`);
        feature.geometry.coordinates = fixed;
      }
    }
    return feature;
  }
  
  if (geometry.type !== 'MultiPolygon') {
    return feature;
  }
  
  // MultiPolygon - process each polygon
  const polygons = geometry.coordinates;
  const rule = COUNTRY_RULES[countryName];
  
  if (rule) {
    console.log(`Processing ${countryName}...`);
    
    // Analyze all polygons
    const polygonData = polygons.map((poly, idx) => {
      const area = calculatePolygonArea(poly);
      const centroid = getPolygonCentroid(poly);
      const bounds = getPolygonBounds(poly);
      return { poly, area, centroid, bounds, idx };
    });
    
    // Filter based on rules
    const kept = polygonData.filter(p => rule.keep(p.centroid, p.bounds));
    
    console.log(`  Kept ${kept.length} of ${polygons.length} polygons`);
    
    if (kept.length > 0) {
      // Update geometry with kept polygons
      feature.geometry.coordinates = kept.map(p => p.poly);
      
      // If only one polygon remains, convert to Polygon type
      if (kept.length === 1) {
        feature.geometry.type = 'Polygon';
        feature.geometry.coordinates = kept[0].poly;
        console.log(`  Converted to Polygon type`);
      }
    }
  }
  
  // Fix antimeridian wrapping for all remaining polygons
  if (feature.geometry.type === 'MultiPolygon') {
    let hasChanges = false;
    const fixed = feature.geometry.coordinates.map(poly => {
      const fixedPoly = fixAntimeridianWrap(poly);
      if (fixedPoly !== poly) hasChanges = true;
      return fixedPoly;
    });
    if (hasChanges) {
      console.log(`  Fixed antimeridian wrap for ${countryName}`);
      feature.geometry.coordinates = fixed;
    }
  } else if (feature.geometry.type === 'Polygon') {
    const fixed = fixAntimeridianWrap(feature.geometry.coordinates);
    if (fixed !== feature.geometry.coordinates) {
      console.log(`  Fixed antimeridian wrap for ${countryName}`);
      feature.geometry.coordinates = fixed;
    }
  }
  
  return feature;
}

// Backup original file if it exists
if (fs.existsSync(outputFile)) {
  console.log('Creating backup of existing route file...');
  fs.copyFileSync(outputFile, backupFile);
  console.log(`Backup created: ${backupFile}`);
}

// Process all features
console.log('\nProcessing countries...\n');
geojson.features = geojson.features.map(processFeature);

// Write cleaned data
console.log('\nWriting cleaned data for route game...');
fs.writeFileSync(outputFile, JSON.stringify(geojson, null, 2));
console.log(`Cleaned data written to: ${outputFile}`);

console.log('\nDone! Route-specific data created.');
console.log('Original file unchanged:', inputFile);
console.log('Route game will use:', outputFile);
