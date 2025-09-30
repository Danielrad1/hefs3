# Sample Anki Deck

## Quick Start

**Just drop any `.apkg` file here and rename it to `sample.apkg`**

## Where to Get Decks

Download from AnkiWeb:
- https://ankiweb.net/shared/decks
- Popular: French, Spanish, Japanese, Medical, etc.

Or export from Anki Desktop:
1. File → Export
2. Select `.apkg` format  
3. Save as `sample.apkg`
4. Drop it here

## What Works

✅ **Full Anki compatibility:**
- All card types (basic, cloze, etc.)
- Scheduling data (intervals, ease factors)
- Deck hierarchies (Parent::Child::Grandchild)
- Media files (images, audio)
- Multiple decks in one file

## Current File

The app loads `sample.apkg` from this directory when you tap "Load Sample Deck" in Settings.

**Note:** File must be named exactly `sample.apkg` (Metro bundler requires explicit filenames at build time)

## For Production

In production, you'd use `expo-document-picker` to let users select any .apkg file from their device. This bundled approach is just for development/testing.
