#!/bin/bash

# Migrate decks from Hosting to Storage
# Uses Firebase CLI + Node.js (no gsutil needed)

set -e

PROJECT_ID="enqode-6b13f"
BUCKET="enqode-6b13f.appspot.com"
DECKS_DIR="hosting/decks"

echo "🚀 Starting migration to Firebase Storage..."
echo ""

# Create upload script
cat > /tmp/upload-to-storage.js << 'UPLOADSCRIPT'
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize without service account (uses Application Default Credentials)
admin.initializeApp({
  storageBucket: process.env.BUCKET
});

const bucket = admin.storage().bucket();
const decksDir = process.env.DECKS_DIR;

async function uploadAll() {
  const files = fs.readdirSync(decksDir).filter(f => f.endsWith('.apkg'));
  
  for (const file of files) {
    const localPath = path.join(decksDir, file);
    const destination = `decks/${file}`;
    
    console.log(`  Uploading: ${file}`);
    
    await bucket.upload(localPath, {
      destination,
      metadata: {
        contentType: 'application/x-anki-collection',
        cacheControl: 'public, max-age=31536000',
      },
    });
    
    await bucket.file(destination).makePublic();
  }
  
  console.log('\n✅ Upload complete!\n');
}

uploadAll().catch(err => {
  console.error('Upload failed:', err);
  process.exit(1);
});
UPLOADSCRIPT

echo "📦 Uploading .apkg files to Storage..."
cd firebase
BUCKET="$BUCKET" DECKS_DIR="../$DECKS_DIR" node /tmp/upload-to-storage.js
cd ..

echo "📝 Now updating catalog URLs..."
echo ""

# Update catalog.json URLs using Node.js
node -e "
const fs = require('fs');
const path = require('path');

const catalogPath = path.join('$DECKS_DIR', 'decks.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));

let updated = 0;
for (const deck of catalog.decks) {
  const oldUrl = deck.downloadUrl;
  const filename = oldUrl.split('/').pop();
  
  // New Storage URL format
  const encodedFilename = encodeURIComponent(filename);
  deck.downloadUrl = \`https://storage.googleapis.com/$PROJECT_ID.appspot.com/decks/\${encodedFilename}\`;
  
  console.log(\`  ✓ \${deck.name}\`);
  updated++;
}

fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
console.log(\`\n✅ Updated \${updated} decks in catalog.json\n\`);
"

echo "🎉 Migration complete!"
echo ""
echo "Next steps:"
echo "1. Review: hosting/decks/decks.json"
echo "2. Deploy: firebase deploy --only hosting --project $PROJECT_ID"
echo "3. Test a deck download in your app"
echo "4. Optional: Delete .apkg files from hosting/decks/ (keep decks.json only)"
