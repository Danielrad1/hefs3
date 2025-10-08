# Phase 4: Curated Deck Downloads - Simple & Free

## Why This Approach is Better

### ✅ Advantages
- **Free:** Firebase Hosting free tier = 10GB bandwidth/month
- **Simple:** No user authentication needed for downloads
- **Universal:** One set of curated decks for all users
- **No backend:** Just static files on CDN
- **Fast:** CDN-distributed, globally cached
- **Easy updates:** Upload new decks anytime

### 💰 Cost Comparison
- **Cloud Backup:** Storage per user + bandwidth = $$$
- **Curated Decks:** One-time storage + shared bandwidth = FREE (under 10GB/month)

---

## Architecture

```
Firebase Hosting (CDN)
├── /decks/decks.json          # Catalog manifest
├── /decks/spanish-basic.apkg  # Deck file 1
├── /decks/japanese-n5.apkg    # Deck file 2
└── /decks/medical-terms.apkg  # Deck file 3

Mobile App
└── DiscoverService.getCatalog()
    ↓
    Fetch https://hefs-b3e45.web.app/decks/decks.json
    ↓
    Display decks in DiscoverScreen
    ↓
    User taps "Download"
    ↓
    Fetch deck.apkg file
    ↓
    Import using existing ApkgParser
```

---

## Implementation Steps

### 1. Create Deck Catalog (5 min)
```json
// firebase/hosting/decks/decks.json
{
  "decks": [
    {
      "id": "spanish-basic",
      "name": "Spanish Basics",
      "description": "500 essential Spanish words and phrases",
      "cardCount": 500,
      "downloadUrl": "https://hefs-b3e45.web.app/decks/spanish-basic.apkg",
      "thumbnail": "https://hefs-b3e45.web.app/decks/spanish-basic.jpg",
      "tags": ["spanish", "beginner", "vocabulary"],
      "difficulty": "beginner",
      "language": "Spanish",
      "size": 245000,
      "author": "Memorize Team",
      "version": "1.0"
    }
  ],
  "categories": ["Languages", "Science", "Medical"],
  "lastUpdated": 1696790400000
}
```

### 2. Set Up Firebase Hosting (2 min)
```bash
cd firebase
firebase init hosting
# Choose: hosting directory = "hosting"
# Configure as single-page app: No
# Set up automatic builds: No
```

### 3. Upload Deck Files (1 min)
```bash
# Place .apkg files in firebase/hosting/decks/
firebase deploy --only hosting
```

### 4. Update DiscoverService (Already done! ✅)
The service is already implemented in:
`src/services/cloud/DiscoverService.ts`

Just needs the correct hosting URL.

### 5. Update DiscoverScreen (10 min)
Replace mock data with real catalog fetch.

---

## What You Need

### Curated Deck Files
- Find or create .apkg files
- Place in `firebase/hosting/decks/`
- Or use sample decks from Anki shared decks

### Free Resources
- AnkiWeb shared decks: https://ankiweb.net/shared/decks
- Download popular decks
- Re-upload to your hosting

---

## Costs (Free Tier)

### Firebase Hosting
- **Storage:** 10GB free
- **Bandwidth:** 360MB/day free
- **Example:** 100 users × 5MB deck = 500MB/day = FREE

### No Backend Needed
- No Cloud Functions required
- No authentication needed
- No database needed
- Just static file hosting

---

## Next Steps

1. **Disable Cloud Backup** (clean up)
2. **Set up Firebase Hosting**
3. **Create sample deck catalog**
4. **Update DiscoverScreen**
5. **Test download flow**

Want me to implement this? It's much simpler than cloud backup!
