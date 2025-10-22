#!/usr/bin/env node
/**
 * Upload all .apkg files to Firebase Storage
 * 
 * SETUP:
 * 1. Place all .apkg files in firebase/decks-source/ folder
 * 2. Organize them in subfolders matching the catalog structure:
 *    - Chinese(Mandarin)/
 *    - French/
 *    - German/
 *    - Japanese/
 *    - Law/
 *    - MCAT/
 *    - Spanish/
 * 3. Install: npm install firebase-admin
 * 4. Get service account key from Firebase Console:
 *    Project Settings → Service Accounts → Generate New Private Key
 * 5. Save as firebase/serviceAccountKey.json
 * 6. Run: node firebase/upload-decks.js
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'enqode-6b13f.firebasestorage.app'
});

const bucket = admin.storage().bucket();
const sourceDir = path.join(__dirname, 'decks-source');

async function uploadFile(localPath, remotePath) {
  try {
    console.log(`⬆️  Uploading: ${remotePath}`);
    
    await bucket.upload(localPath, {
      destination: remotePath,
      metadata: {
        contentType: 'application/octet-stream',
        cacheControl: 'public, max-age=31536000', // Cache for 1 year
      },
    });
    
    // Make file publicly readable
    await bucket.file(remotePath).makePublic();
    
    const stats = fs.statSync(localPath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`✅ Uploaded: ${remotePath} (${sizeMB} MB)`);
    
    return true;
  } catch (error) {
    console.error(`❌ Failed to upload ${remotePath}:`, error.message);
    return false;
  }
}

async function uploadDecks() {
  if (!fs.existsSync(sourceDir)) {
    console.error(`❌ Source directory not found: ${sourceDir}`);
    console.log('Create the directory and organize .apkg files in category subfolders');
    process.exit(1);
  }

  const categories = fs.readdirSync(sourceDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  let totalFiles = 0;
  let uploadedFiles = 0;

  for (const category of categories) {
    const categoryPath = path.join(sourceDir, category);
    const files = fs.readdirSync(categoryPath)
      .filter(file => file.endsWith('.apkg'));

    console.log(`\n📁 Category: ${category} (${files.length} files)`);

    for (const file of files) {
      const localPath = path.join(categoryPath, file);
      const remotePath = `Decks/${category}/${file}`;
      
      totalFiles++;
      const success = await uploadFile(localPath, remotePath);
      if (success) uploadedFiles++;
    }
  }

  console.log(`\n✅ Upload complete: ${uploadedFiles}/${totalFiles} files uploaded`);
  
  if (uploadedFiles < totalFiles) {
    console.log(`⚠️  ${totalFiles - uploadedFiles} files failed to upload`);
  }
}

uploadDecks()
  .then(() => {
    console.log('\n🎉 All done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Upload failed:', error);
    process.exit(1);
  });
