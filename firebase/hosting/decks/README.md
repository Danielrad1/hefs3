# Curated Decks Directory

## 📁 Place Your .apkg Files Here

Put your Anki deck files (.apkg) in this directory:

```
firebase/hosting/decks/
├── spanish-basic.apkg
├── japanese-n5.apkg
├── medical-terms.apkg
└── [your-deck-name].apkg
```

## 📝 Then Update decks.json

After adding .apkg files, update `decks.json` with deck metadata.

## 🔍 Where to Find Free Decks

1. **AnkiWeb Shared Decks**
   - https://ankiweb.net/shared/decks
   - Download popular decks
   - Rename and place here

2. **Your Own Decks**
   - Export from Anki Desktop
   - File → Export → .apkg format
   - Place here

## 📤 Deploy

```bash
cd /Users/danielrad/Desktop/repos/hefs2/memorize-app/firebase
firebase deploy --only hosting
```

Your decks will be available at:
`https://hefs-b3e45.web.app/decks/[filename].apkg`
