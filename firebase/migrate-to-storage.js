#!/usr/bin/env node

/**
 * Migrate .apkg decks from Hosting to Storage
 * Updates catalog.json with new Storage URLs
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require('./service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'enqode-6b13f.appspot.com'
});

const bucket = admin.storage().bucket();
const decksDir = path.join(__dirname, 'hosting', 'decks');
const catalogPath = path.join(decksDir, 'decks.json');

async function uploadDeck(filename) {
  const localPath = path.join(decksDir, filename);
  const storagePath = `decks/${filename}`;
  
  console.log(`Uploading ${filename}...`);
  
  await bucket.upload(localPath, {
    destination: storagePath,
    metadata: {
      contentType: 'application/x-anki-collection',
      cacheControl: 'public, max-age=31536000', // Cache for 1 year
    },
  });
  
  // Make file publicly readable
  await bucket.file(storagePath).makePublic();
  
  // Get public URL
  const publicUrl = `https://storage.googleapis.com/enqode-6b13f.appspot.com/${storagePath}`;
  console.log(`✓ Uploaded: ${publicUrl}`);
  
  return publicUrl;
}

async function migrateAllDecks() {
  try {
    // Read current catalog
    const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
    console.log(`Found ${catalog.decks.length} decks in catalog\n`);
    
    // Get all .apkg files
    const apkgFiles = fs.readdirSync(decksDir)
      .filter(f => f.endsWith('.apkg'));
    
    console.log(`Found ${apkgFiles.length} .apkg files to upload\n`);
    
    // Upload each deck and build URL map
    const urlMap = {};
    for (const filename of apkgFiles) {
      const newUrl = await uploadDeck(filename);
      urlMap[filename] = newUrl;
    }
    
    console.log('\n--- Updating catalog.json ---\n');
    
    // Update catalog with new URLs
    let updatedCount = 0;
    for (const deck of catalog.decks) {
      const oldUrl = deck.downloadUrl;
      const filename = oldUrl.split('/').pop();
      
      if (urlMap[filename]) {
        deck.downloadUrl = urlMap[filename];
        console.log(`✓ Updated: ${deck.name}`);
        updatedCount++;
      } else {
        console.log(`⚠ Warning: No file found for ${deck.name} (${filename})`);
      }
    }
    
    // Write updated catalog
    fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
    console.log(`\n✓ Updated catalog.json (${updatedCount} decks)`);
    
    console.log('\n✓ Migration complete!');
    console.log('\nNext steps:');
    console.log('1. Review the updated hosting/decks/decks.json');
    console.log('2. Deploy: firebase deploy --only hosting');
    console.log('3. Optional: Delete .apkg files from hosting/decks/ (keep decks.json)');
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateAllDecks();
