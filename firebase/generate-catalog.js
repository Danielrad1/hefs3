#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const decks = {
  "Chinese(Mandarin)": [
    { file: "Chinese_Handwriting_with_HSK_1-6.apkg", name: "Chinese Handwriting with HSK 1-6", desc: "Master Chinese character writing with HSK levels 1-6", count: 500, tags: ["chinese", "mandarin", "hsk", "handwriting"], diff: "intermediate", color: "#EF4444" },
    { file: "HSK-1-6_official_vocabulary.apkg", name: "HSK 1-6 Official Vocabulary", desc: "Official HSK vocabulary for all 6 levels", count: 300, tags: ["chinese", "mandarin", "hsk", "vocabulary"], diff: "intermediate", color: "#EF4444" },
    { file: "HSK_levels_1_to_6_with_audio_read_speak_and_write.apkg", name: "HSK Levels 1-6 with Audio", desc: "Complete HSK vocabulary with native audio", count: 600, tags: ["chinese", "mandarin", "hsk", "audio"], diff: "intermediate", color: "#EF4444" },
    { file: "Hanping_Chinese_HSK_1-6.apkg", name: "Hanping Chinese HSK 1-6", desc: "Comprehensive HSK preparation deck", count: 450, tags: ["chinese", "mandarin", "hsk"], diff: "intermediate", color: "#EF4444" },
    { file: "MandarinChinese_HSK_1-6.apkg", name: "Mandarin Chinese HSK 1-6", desc: "Complete Mandarin HSK study deck", count: 500, tags: ["chinese", "mandarin", "hsk"], diff: "intermediate", color: "#EF4444" }
  ],
  "French": [
    { file: "5000_Most_Common_French_Words.apkg", name: "5000 Most Common French Words", desc: "Master the most frequently used French vocabulary", count: 5000, tags: ["french", "vocabulary", "frequency"], diff: "intermediate", color: "#8B5CF6" },
    { file: "5000_most_frequently_used_French_words_v._60.apkg", name: "5000 Most Frequently Used French Words v.60", desc: "Updated frequency list of essential French vocabulary", count: 5000, tags: ["french", "vocabulary", "frequency"], diff: "intermediate", color: "#8B5CF6" },
    { file: "5000_most_frequently_used_French_words_v._60_Parts_1__2.apkg", name: "5000 Most Frequently Used French Words Parts 1-2", desc: "Comprehensive French vocabulary in two parts", count: 5000, tags: ["french", "vocabulary", "frequency"], diff: "intermediate", color: "#8B5CF6" },
    { file: "French_5000_Word_Fluency_Deck.apkg", name: "French 5000 Word Fluency Deck", desc: "Build French fluency with 5000 essential words", count: 5000, tags: ["french", "vocabulary", "fluency"], diff: "intermediate", color: "#8B5CF6" },
    { file: "Times_5000_Most_Common_French_Words.apkg", name: "Times 5000 Most Common French Words", desc: "Times magazine list of most common French vocabulary", count: 5000, tags: ["french", "vocabulary", "common"], diff: "intermediate", color: "#8B5CF6" }
  ],
  "German": [
    { file: "5000_German_words_sorted_by_frequency.apkg", name: "5000 German Words Sorted by Frequency", desc: "Learn German vocabulary by frequency of use", count: 5000, tags: ["german", "vocabulary", "frequency"], diff: "intermediate", color: "#F59E0B" },
    { file: "A_Frequency_Dictionary_of_German.apkg", name: "A Frequency Dictionary of German", desc: "Comprehensive frequency-based German vocabulary", count: 4000, tags: ["german", "vocabulary", "dictionary"], diff: "intermediate", color: "#F59E0B" },
    { file: "Deutsch_4600_German_Words_by_Frequency.apkg", name: "Deutsch 4600 German Words by Frequency", desc: "4600 most common German words sorted by frequency", count: 4600, tags: ["german", "vocabulary", "frequency"], diff: "intermediate", color: "#F59E0B" },
    { file: "English-German_Sorted_by_Frequency.apkg", name: "English-German Sorted by Frequency", desc: "English to German vocabulary by frequency", count: 4000, tags: ["german", "english", "translation"], diff: "intermediate", color: "#F59E0B" },
    { file: "German_Core_5000_English__Russian__Audio.apkg", name: "German Core 5000 English-Russian Audio", desc: "German vocabulary with English and Russian translations", count: 5000, tags: ["german", "audio", "multilingual"], diff: "intermediate", color: "#F59E0B" },
    { file: "German_Most_Frequently_Used_Words_Patterns_and_Phrases.apkg", name: "German Most Frequently Used Words, Patterns and Phrases", desc: "Essential German words and common phrases", count: 3000, tags: ["german", "phrases", "patterns"], diff: "beginner", color: "#F59E0B" }
  ],
  "Japanese": [
    { file: "Core23k_v3_KKLC_Order_-_unofficial.apkg", name: "Core23k v3 KKLC Order", desc: "23,000 core Japanese vocabulary in KKLC order", count: 23000, tags: ["japanese", "vocabulary", "kanji"], diff: "advanced", color: "#EC4899" },
    { file: "Core_23k_Anki_Deck__Version_3_Core23k.apkg", name: "Core 23k Anki Deck Version 3", desc: "Comprehensive 23,000 word Japanese vocabulary deck", count: 23000, tags: ["japanese", "vocabulary", "core"], diff: "advanced", color: "#EC4899" },
    { file: "JLPT_Tango_N5_1000_Most_Common_Japanese_Words_in_Sentences.apkg", name: "JLPT Tango N5 1000 Most Common Japanese Words", desc: "JLPT N5 level vocabulary with sentences", count: 1000, tags: ["japanese", "jlpt", "n5", "beginner"], diff: "beginner", color: "#EC4899" },
    { file: "JLPT_Tango_N5_Deck_-_Mijaku_Note_Types.apkg", name: "JLPT Tango N5 Deck - Mijaku Note Types", desc: "JLPT N5 with enhanced note types", count: 1000, tags: ["japanese", "jlpt", "n5"], diff: "beginner", color: "#EC4899" },
    { file: "JLPT_Tango_N5_MIA.apkg", name: "JLPT Tango N5 MIA", desc: "Mass Immersion Approach JLPT N5 deck", count: 1000, tags: ["japanese", "jlpt", "n5", "mia"], diff: "beginner", color: "#EC4899" },
    { file: "Japanese_course_based_on_Tae_Kims_grammar_guide__anime.apkg", name: "Japanese Course Based on Tae Kim's Grammar Guide", desc: "Comprehensive Japanese grammar course", count: 800, tags: ["japanese", "grammar", "tae-kim"], diff: "intermediate", color: "#EC4899" }
  ],
  "Law": [
    { file: "Bar_Exam_UBE_Constitutional_Law.apkg", name: "Bar Exam UBE Constitutional Law", desc: "Constitutional law for bar exam preparation", count: 500, tags: ["law", "bar-exam", "constitutional"], diff: "advanced", color: "#3B82F6" },
    { file: "Bar_Exam_UBE_Criminal_Law.apkg", name: "Bar Exam UBE Criminal Law", desc: "Criminal law essentials for the bar exam", count: 450, tags: ["law", "bar-exam", "criminal"], diff: "advanced", color: "#3B82F6" },
    { file: "Bar_Exam_UBE_Torts_Law.apkg", name: "Bar Exam UBE Torts Law", desc: "Comprehensive torts law for bar preparation", count: 400, tags: ["law", "bar-exam", "torts"], diff: "advanced", color: "#3B82F6" },
    { file: "Bar_Mnemonics_for_MBE_Law_School_Bar_Exam.apkg", name: "Bar Mnemonics for MBE Law School", desc: "Memory aids for MBE subjects", count: 300, tags: ["law", "bar-exam", "mnemonics", "mbe"], diff: "advanced", color: "#3B82F6" },
    { file: "Contract_Law_with_E.apkg", name: "Contract Law with E", desc: "Comprehensive contract law study deck", count: 600, tags: ["law", "contracts"], diff: "advanced", color: "#3B82F6" },
    { file: "Contracts_Law_Bar_Exam.apkg", name: "Contracts Law Bar Exam", desc: "Contract law essentials for bar exam", count: 500, tags: ["law", "contracts", "bar-exam"], diff: "advanced", color: "#3B82F6" },
    { file: "Criminal_Law_Flashcards.apkg", name: "Criminal Law Flashcards", desc: "Essential criminal law concepts and rules", count: 400, tags: ["law", "criminal"], diff: "advanced", color: "#3B82F6" },
    { file: "Landmark_Supreme_Court_Cases_US_Law.apkg", name: "Landmark Supreme Court Cases US Law", desc: "Major Supreme Court decisions and their impact", count: 350, tags: ["law", "supreme-court", "cases"], diff: "advanced", color: "#3B82F6" },
    { file: "Tort_law.apkg", name: "Tort Law", desc: "Comprehensive torts law study deck", count: 450, tags: ["law", "torts"], diff: "advanced", color: "#3B82F6" },
    { file: "US_Constitutional_Law_Bar_Examination..apkg", name: "US Constitutional Law Bar Examination", desc: "Constitutional law for bar exam success", count: 500, tags: ["law", "constitutional", "bar-exam"], diff: "advanced", color: "#3B82F6" }
  ],
  "MCAT": [
    { file: "Anking_Mcat_deck.apkg", name: "AnKing MCAT Deck", desc: "Comprehensive MCAT preparation deck", count: 6320, tags: ["mcat", "test-prep", "comprehensive"], diff: "advanced", color: "#10B981" },
    { file: "Jacksparrow2048 MCAT Anki UPDATED.apkg", name: "Jacksparrow2048 MCAT Anki UPDATED", desc: "Updated comprehensive MCAT deck", count: 6301, tags: ["mcat", "test-prep"], diff: "advanced", color: "#10B981" },
    { file: "MCAT_Kaplan_Deck.apkg", name: "MCAT Kaplan Deck", desc: "Official Kaplan MCAT preparation materials", count: 5047, tags: ["mcat", "kaplan", "test-prep"], diff: "advanced", color: "#10B981" },
    { file: "MCAT_Logic_Flashcards.apkg", name: "MCAT Logic Flashcards", desc: "Essential MCAT logic review flashcards", count: 152, tags: ["mcat", "test-prep", "flashcards", "logic"], diff: "intermediate", color: "#10B981" },
    { file: "Miles_Down_MCAT_deck.apkg", name: "MilesDown MCAT Deck", desc: "Popular comprehensive MCAT study deck", count: 3002, tags: ["mcat", "milesdown", "test-prep"], diff: "advanced", color: "#10B981" },
    { file: "Ortho_528_MCAT_deck.apkg", name: "Ortho 528 MCAT Deck", desc: "High-yield MCAT deck for scoring 528", count: 4351, tags: ["mcat", "high-yield", "test-prep"], diff: "advanced", color: "#10B981" }
  ],
  "Spanish": [
    { file: "5000_Spanish_Most_Frequent_Words.apkg", name: "5000 Spanish Most Frequent Words", desc: "Master the most common Spanish vocabulary", count: 5000, tags: ["spanish", "vocabulary", "frequency"], diff: "intermediate", color: "#F59E0B" },
    { file: "5000_Spanish_Words_Sorted_by_Frequency.apkg", name: "5000 Spanish Words Sorted by Frequency", desc: "Spanish vocabulary ordered by usage frequency", count: 5000, tags: ["spanish", "vocabulary", "frequency"], diff: "intermediate", color: "#F59E0B" },
    { file: "A_Frequency_Dictionary_of_Spanish.apkg", name: "A Frequency Dictionary of Spanish", desc: "Comprehensive frequency-based Spanish vocabulary", count: 4000, tags: ["spanish", "vocabulary", "dictionary"], diff: "intermediate", color: "#F59E0B" },
    { file: "Kal_Medical_Spanish_Vocabulary_Listening_and_Translation.apkg", name: "Kal Medical Spanish Vocabulary Listening and Translation", desc: "Medical Spanish with audio and translations", count: 1500, tags: ["spanish", "medical", "audio"], diff: "advanced", color: "#F59E0B" },
    { file: "New_Spanish_Top_5000_Vocabulary.apkg", name: "New Spanish Top 5000 Vocabulary", desc: "Updated top 5000 Spanish words", count: 5000, tags: ["spanish", "vocabulary", "top-5000"], diff: "intermediate", color: "#F59E0B" },
    { file: "SpanishEnglish_-_Top_5000_Spanish_-_With_Examples.apkg", name: "SpanishEnglish - Top 5000 Spanish - With Examples", desc: "Top Spanish vocabulary with example sentences", count: 5000, tags: ["spanish", "vocabulary", "examples"], diff: "intermediate", color: "#F59E0B" },
    { file: "Spanish_Top_5000_Vocabulary.apkg", name: "Spanish Top 5000 Vocabulary", desc: "Essential Spanish vocabulary deck", count: 5000, tags: ["spanish", "vocabulary"], diff: "intermediate", color: "#F59E0B" },
    { file: "Spanish_Top_5000_Words_v3_-_Oliver.apkg", name: "Spanish Top 5000 Words v3 - Oliver", desc: "Oliver's curated Spanish vocabulary deck", count: 5000, tags: ["spanish", "vocabulary"], diff: "intermediate", color: "#F59E0B" },
    { file: "top_5000_spanish_langham_spanish_audiompl.apkg", name: "Top 5000 Spanish Langham Spanish Audio", desc: "Spanish vocabulary with native audio recordings", count: 5000, tags: ["spanish", "vocabulary", "audio"], diff: "intermediate", color: "#F59E0B" }
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
    const storagePath = `Decks/${folder}/${item.file}`;
    const encodedStoragePath = storagePath.split('/').map(encodeURIComponent).join('%2F');
    
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
