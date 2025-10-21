#!/usr/bin/env node

/**
 * Update catalog.json to use Storage URLs instead of Hosting URLs
 * Run this AFTER uploading .apkg files to Firebase Storage
 */

const fs = require('fs');
const path = require('path');

const catalogPath = path.join(__dirname, 'hosting', 'decks', 'decks.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));

console.log('🔄 Updating URLs to Firebase Storage...\n');

let updated = 0;
for (const deck of catalog.decks) {
  const oldUrl = deck.downloadUrl;
  
  // Extract the path after /decks/ or /Decks/ (case insensitive)
  const urlParts = oldUrl.split(/\/[Dd]ecks\//);
  if (urlParts.length < 2) {
    console.warn(`⚠️  Skipping invalid URL: ${oldUrl}`);
    continue;
  }
  
  const deckPath = urlParts[1]; // e.g., "French/deck1.apkg" or just "deck1.apkg"
  
  // New Storage URL format (public URLs)
  // Encode each path segment separately to preserve /
  // Use 'Decks' (capital D) to match your Storage folder structure
  const encodedPath = deckPath.split('/').map(encodeURIComponent).join('/');
  deck.downloadUrl = `https://storage.googleapis.com/enqode-6b13f.appspot.com/Decks/${encodedPath}`;
  
  console.log(`✓ ${deck.name}`);
  console.log(`  Old: ${oldUrl}`);
  console.log(`  New: ${deck.downloadUrl}\n`);
  updated++;
}

fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));

console.log(`\n✅ Updated ${updated} URLs in catalog.json`);
console.log('\nNext step: firebase deploy --only hosting --project enqode-6b13f');
