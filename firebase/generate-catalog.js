#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const decks = {
  "German": [
    { file: "A_Frequency_Dictionary_of_German.apkg", name: "A Frequency Dictionary of German", desc: "Comprehensive frequency-based German vocabulary", count: 4000, tags: ["german", "vocabulary", "dictionary"], diff: "intermediate", color: "#F59E0B" },
    { file: "German_Most_Frequently_Used_Words_Patterns_and_Phrases.apkg", name: "German Most Frequently Used Words, Patterns and Phrases", desc: "Essential German words and common phrases", count: 3000, tags: ["german", "phrases", "patterns"], diff: "beginner", color: "#F59E0B" }
  ],
  "Japanese": [
    { file: "JLPT_Tango_N5_1000_Most_Common_Japanese_Words_in_Sentences.apkg", name: "JLPT Tango N5 1000 Most Common Japanese Words", desc: "JLPT N5 level vocabulary with sentences", count: 1000, tags: ["japanese", "jlpt", "n5", "beginner"], diff: "beginner", color: "#EC4899" },
    { file: "Japanese_course_based_on_Tae_Kims_grammar_guide__anime.apkg", name: "Japanese Course Based on Tae Kim's Grammar Guide", desc: "Comprehensive Japanese grammar course", count: 800, tags: ["japanese", "grammar", "tae-kim"], diff: "intermediate", color: "#EC4899" }
  ],
  "Law": [
    { file: "Bar_Exam_UBE_Constitutional_Law.apkg", name: "Bar Exam UBE Constitutional Law", desc: "Constitutional law for bar exam preparation", count: 500, tags: ["law", "bar-exam", "constitutional"], diff: "advanced", color: "#3B82F6" },
    { file: "Bar_Exam_UBE_Criminal_Law.apkg", name: "Bar Exam UBE Criminal Law", desc: "Criminal law essentials for the bar exam", count: 450, tags: ["law", "bar-exam", "criminal"], diff: "advanced", color: "#3B82F6" },
    { file: "Bar_Exam_UBE_Torts_Law.apkg", name: "Bar Exam UBE Torts Law", desc: "Comprehensive torts law for bar preparation", count: 400, tags: ["law", "bar-exam", "torts"], diff: "advanced", color: "#3B82F6" },
    { file: "Bar_Mnemonics_for_MBE_Law_School_Bar_Exam.apkg", name: "Bar Mnemonics for MBE Law School", desc: "Memory aids for MBE subjects", count: 300, tags: ["law", "bar-exam", "mnemonics", "mbe"], diff: "advanced", color: "#3B82F6" },
    { file: "Contract_Law_with_E.apkg", name: "Contract Law with E", desc: "Comprehensive contract law study deck", count: 600, tags: ["law", "contracts"], diff: "advanced", color: "#3B82F6" },
    { file: "Contracts_Law_Bar_Exam.apkg", name: "Contracts Law Bar Exam", desc: "Contract law essentials for bar exam", count: 500, tags: ["law", "contracts", "bar-exam"], diff: "advanced", color: "#3B82F6" },
    { file: "Landmark_Supreme_Court_Cases_US_Law.apkg", name: "Landmark Supreme Court Cases US Law", desc: "Major Supreme Court decisions and their impact", count: 350, tags: ["law", "supreme-court", "cases"], diff: "advanced", color: "#3B82F6" }
  ],
  "MCAT": [
    { file: "Anking_Mcat_deck.apkg", name: "AnKing MCAT Deck", desc: "Comprehensive MCAT preparation deck", count: 6320, tags: ["mcat", "test-prep", "comprehensive"], diff: "advanced", color: "#10B981" },
    { file: "Jacksparrow2048 MCAT Anki UPDATED.apkg", name: "Jacksparrow2048 MCAT Anki UPDATED", desc: "Updated comprehensive MCAT deck", count: 6301, tags: ["mcat", "test-prep"], diff: "advanced", color: "#10B981" },
    { file: "MCAT_Kaplan_Deck.apkg", name: "MCAT Kaplan Deck", desc: "Official Kaplan MCAT preparation materials", count: 5047, tags: ["mcat", "kaplan", "test-prep"], diff: "advanced", color: "#10B981" },
    { file: "MCAT_Logic_Flashcards.apkg", name: "MCAT Logic Flashcards", desc: "Essential MCAT logic review flashcards", count: 152, tags: ["mcat", "test-prep", "flashcards", "logic"], diff: "intermediate", color: "#10B981" },
    { file: "Miles_Down_MCAT_deck.apkg", name: "MilesDown MCAT Deck", desc: "Popular comprehensive MCAT study deck", count: 3002, tags: ["mcat", "milesdown", "test-prep"], diff: "advanced", color: "#10B981" },
    { file: "Ortho_528_MCAT_deck.apkg", name: "Ortho 528 MCAT Deck", desc: "High-yield MCAT deck for scoring 528", count: 4351, tags: ["mcat", "high-yield", "test-prep"], diff: "advanced", color: "#10B981" }
  ]
};

const catalog = {
  version: "2.0.0",
  lastUpdated: new Date().toISOString().split('T')[0],
  categories: [], // Will be populated below
  decks: []
};

for (const [folder, items] of Object.entries(decks)) {
  for (const item of items) {
    const id = item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    // Firebase Storage API URL format: encode path with %2F for slashes
    // Also encode parentheses which Firebase Storage requires
    const storagePath = `Decks/${folder}/${item.file}`;
    const encodedStoragePath = storagePath.split('/').map(segment => 
      encodeURIComponent(segment).replace(/\(/g, '%28').replace(/\)/g, '%29')
    ).join('%2F');
    
    catalog.decks.push({
      id,
      name: item.name,
      description: item.desc,
      cardCount: item.count,
      downloadUrl: `https://firebasestorage.googleapis.com/v0/b/enqode-6b13f.firebasestorage.app/o/${encodedStoragePath}?alt=media`,
      thumbnail: { icon: "language", color: item.color },
      tags: item.tags,
      difficulty: item.diff,
      language: folder.includes('MCAT') || folder.includes('Law') ? 'English' : folder.replace(/\(.*\)/, '').trim()
    });
  }
}

// Extract unique categories from folders  
catalog.categories = Object.keys(decks).map(folder => {
  // Clean up folder names: remove parentheses content, keep original case
  return folder.replace(/\(.*\)/, '').trim();
});

const outputPath = path.join(__dirname, 'hosting', 'decks', 'decks.json');
fs.writeFileSync(outputPath, JSON.stringify(catalog, null, 2));

console.log(`✅ Generated catalog with ${catalog.decks.length} decks`);
console.log(`📝 Categories: ${catalog.categories.join(', ')}`);
console.log(`📝 Saved to: ${outputPath}`);
