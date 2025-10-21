#!/usr/bin/env node

/**
 * Extract actual card counts from .apkg files
 * This will scan all decks in your local directory and output the real counts
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Path to your local decks - UPDATE THIS TO YOUR LOCAL PATH
const LOCAL_DECKS_PATH = process.argv[2] || '/Users/danielrad/Desktop/repos/hefs2/all-decks';

if (!fs.existsSync(LOCAL_DECKS_PATH)) {
  console.error(`❌ Decks directory not found: ${LOCAL_DECKS_PATH}`);
  console.log('\nUsage: node get-actual-card-counts.js /path/to/decks/folder');
  process.exit(1);
}

console.log(`🔍 Scanning decks in: ${LOCAL_DECKS_PATH}\n`);

// Find all .apkg files recursively
function findApkgFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      findApkgFiles(filePath, fileList);
    } else if (file.endsWith('.apkg')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Extract card count from .apkg file using unzip and sqlite3
function getCardCount(apkgPath) {
  try {
    const tempDir = `/tmp/apkg-extract-${Date.now()}`;
    fs.mkdirSync(tempDir, { recursive: true });
    
    // Unzip the .apkg file
    execSync(`unzip -q "${apkgPath}" -d "${tempDir}"`, { stdio: 'pipe' });
    
    // Query the SQLite database
    const dbPath = path.join(tempDir, 'collection.anki21') || path.join(tempDir, 'collection.anki2');
    
    let count = 0;
    try {
      const result = execSync(`sqlite3 "${dbPath}" "SELECT COUNT(*) FROM cards;"`, { 
        encoding: 'utf-8',
        stdio: 'pipe'
      }).trim();
      count = parseInt(result, 10);
    } catch (e) {
      // Try anki2 format
      const dbPath2 = path.join(tempDir, 'collection.anki2');
      if (fs.existsSync(dbPath2)) {
        const result = execSync(`sqlite3 "${dbPath2}" "SELECT COUNT(*) FROM cards;"`, { 
          encoding: 'utf-8',
          stdio: 'pipe'
        }).trim();
        count = parseInt(result, 10);
      }
    }
    
    // Cleanup
    execSync(`rm -rf "${tempDir}"`, { stdio: 'pipe' });
    
    return count;
  } catch (error) {
    console.error(`  ⚠️  Error reading ${path.basename(apkgPath)}:`, error.message);
    return null;
  }
}

// Main execution
const apkgFiles = findApkgFiles(LOCAL_DECKS_PATH);

if (apkgFiles.length === 0) {
  console.log('❌ No .apkg files found');
  process.exit(1);
}

console.log(`Found ${apkgFiles.length} .apkg files\n`);
console.log('=' .repeat(80));

const results = [];

for (const filePath of apkgFiles) {
  const relativePath = path.relative(LOCAL_DECKS_PATH, filePath);
  const fileName = path.basename(filePath);
  const folder = path.basename(path.dirname(filePath));
  
  process.stdout.write(`📦 ${fileName}... `);
  
  const count = getCardCount(filePath);
  
  if (count !== null) {
    console.log(`✓ ${count} cards`);
    results.push({
      folder,
      file: fileName,
      path: relativePath,
      count
    });
  } else {
    console.log(`✗ Failed`);
  }
}

console.log('=' .repeat(80));
console.log(`\n✅ Successfully read ${results.length} out of ${apkgFiles.length} decks\n`);

// Output results sorted by folder
results.sort((a, b) => a.folder.localeCompare(b.folder) || a.file.localeCompare(b.file));

console.log('📊 Card Counts by Folder:\n');

let currentFolder = '';
for (const result of results) {
  if (result.folder !== currentFolder) {
    currentFolder = result.folder;
    console.log(`\n📁 ${currentFolder}:`);
  }
  console.log(`  ${result.file.padEnd(60)} ${result.count.toString().padStart(6)} cards`);
}

// Save to JSON file
const outputPath = path.join(__dirname, 'actual-card-counts.json');
fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
console.log(`\n💾 Full results saved to: ${outputPath}`);
console.log('\nYou can use this data to update your catalog.json with accurate card counts!');
