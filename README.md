# Memorize App 🧠

A modern, TikTok-style spaced repetition flashcard app built with React Native and Expo. Fully compatible with Anki's data format and algorithm.

## ✨ Features

### Core Study Experience
- **TikTok-Style Vertical Swiping**: Swipe through flashcards with smooth, memory-efficient animations
- **Spaced Repetition Algorithm**: Anki-compatible SM-2 algorithm (FSRS v3/v4 ready)
- **Reveal Animations**: Crossfade animations for card front/back with haptic feedback
- **Difficulty Buttons**: Right rail with staggered animated difficulty buttons (Again, Hard, Good, Easy)
- **Confetti Celebration**: Confetti cannon for "Easy" answers
- **Real-time Statistics**: Track today's reviews, accuracy, time spent, and streaks

### Deck Management
- **Hierarchical Decks**: Full support for Parent::Child deck structure
- **Deck CRUD**: Create, rename, delete, and organize decks
- **Folder Management**: Organize decks into folders with drag-and-drop
- **Custom Colors & Icons**: Personalize decks with custom icons and colors
- **Import .apkg Files**: Full Anki package import with media support
- **Curated Deck Discovery**: Browse and download pre-made decks (12+ topics)

### Content Creation
- **AI Deck Generation**: Create flashcards from topics or notes using GPT-5 Nano
- **Rich Text Editor**: WYSIWYG editor with formatting, media, and cloze support
- **Cloze Deletions**: Full Anki-style cloze deletion authoring
- **Media Support**: Images, audio, and attachments with deduplication
- **Note Types**: Basic and Cloze note types with custom fields
- **Card Browser**: Search, filter, and bulk-edit cards

### Cloud & Sync
- **Firebase Authentication**: Secure sign-in with Apple ID and email
- **Cloud Backup**: Export/import database to cloud storage
- **Real-time Persistence**: Automatic saving to local file system

## 🛠 Tech Stack

### Frontend
- **React Native** 0.81.4
- **Expo** ~54.0 (managed workflow with dev client)
- **TypeScript** 5.9
- **React Navigation** 7.x (bottom tabs + native stack)
- **Reanimated** 4.x (60fps+ animations)
- **Gesture Handler** 2.x
- **FlashList** 2.x (optimized lists)
- **Zustand** 5.x (state management)

### Backend
- **Firebase Functions** (Express.js API)
- **Firebase Auth** (user authentication)
- **Firebase Hosting** (curated decks JSON)
- **OpenAI API** (GPT-5 Nano for AI generation)

### Data & Storage
- **In-Memory Database** (Anki-compatible schema)
- **JSON Persistence** (local file system)
- **expo-file-system** (media storage)
- **expo-sqlite** (ready for future migration)

### Media Processing
- **jszip** (3.10.1 - .apkg extraction)
- **expo-image-picker** (images from camera/library)
- **expo-av** (audio playback)
- **react-native-zip-archive** (7.0.2 - streaming unzip)

## 📂 Project Structure

```
memorize-app/
├── src/
│   ├── app/                    # Feature screens
│   │   ├── Auth/              # Sign-in screen
│   │   ├── Home/              # Dashboard with stats
│   │   ├── Decks/             # Deck management & AI creator
│   │   ├── Study/             # TikTok-style study interface
│   │   ├── Discover/          # Curated deck browser
│   │   ├── Browser/           # Card browser & search
│   │   ├── Editor/            # Rich text note editor
│   │   └── Settings/          # App settings
│   ├── components/            # Shared UI components
│   ├── navigation/            # Navigation configuration
│   ├── services/              # Business logic
│   │   ├── anki/             # Anki-compatible services
│   │   │   ├── InMemoryDb.ts          # Core database
│   │   │   ├── SchedulerV2.ts         # SM-2 algorithm
│   │   │   ├── ApkgParser.ts          # .apkg import
│   │   │   ├── DeckService.ts         # Deck CRUD
│   │   │   ├── NoteService.ts         # Note/card generation
│   │   │   ├── CardService.ts         # Card operations
│   │   │   ├── MediaService.ts        # Media management
│   │   │   ├── ClozeService.ts        # Cloze authoring
│   │   │   ├── StatsService.ts        # Statistics
│   │   │   └── db/                    # Repository pattern
│   │   ├── ai/               # AI deck generation
│   │   ├── cloud/            # Cloud backup
│   │   ├── search/           # Full-text search
│   │   └── discover/         # Curated decks
│   ├── context/              # React contexts
│   │   └── SchedulerProvider.tsx  # Study session state
│   ├── design/               # Design system
│   │   ├── theme.ts          # Colors & theme
│   │   ├── typography.ts     # Text styles
│   │   ├── spacing.ts        # Layout spacing
│   │   └── radii.ts          # Border radii
│   ├── domain/               # Domain models
│   ├── hooks/                # Custom hooks
│   └── utils/                # Utilities
├── firebase/
│   ├── functions/            # Backend API
│   │   └── src/
│   │       ├── handlers/     # API endpoints
│   │       ├── services/     # AI, storage services
│   │       └── middleware/   # Auth, error handling
│   └── hosting/              # Static file hosting
│       └── decks/            # Curated decks JSON
├── assets/                   # Images, fonts, icons
├── ios/                      # iOS native code
├── android/                  # Android native code (future)
└── __tests__/               # Test files

```

## 🚀 Getting Started

### Prerequisites
- **Node.js** 18+ (20+ recommended)
- **npm** or **yarn**
- **Xcode** 15+ (for iOS development)
- **Expo CLI**: `npm install -g expo-cli`
- **Firebase CLI**: `npm install -g firebase-tools`

### Installation

1. **Clone the repository**
   ```bash
   cd /Users/danielrad/Desktop/repos/hefs2/memorize-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Install Firebase functions dependencies**
   ```bash
   cd firebase/functions
   npm install
   cd ../..
   ```

4. **Set up environment variables**
   
   Create `.env.development`:
   ```bash
   API_BASE_URL=http://localhost:5001/YOUR_PROJECT_ID/us-central1/api
   ENABLE_CLOUD_BACKUP=false
   ENABLE_AI_FEATURES=true
   APP_ENV=development
   ```

5. **Configure Firebase**
   
   Update `firebase/.firebaserc`:
   ```json
   {
     "projects": {
       "default": "your-firebase-project-id"
     }
   }
   ```

### Running the App

#### Development Mode (Expo Go - Limited Features)
```bash
npm start
```
Press `i` for iOS simulator or scan QR code.

#### Development Build (Recommended - Full Features)
Required for Reanimated 3 animations:
```bash
npx expo run:ios
```

#### Start Firebase Emulator (for AI & Cloud Features)
```bash
cd firebase/functions
npm run serve
```
Emulator UI: http://localhost:4000

## 🧪 Testing

### Run All Tests
```bash
npm test
```

### Run Tests in Watch Mode
```bash
npm test:watch
```

### Run Tests with Coverage
```bash
npm test:coverage
```

### Run Service Tests Only
```bash
npm run test:services
```

### Current Test Coverage
- **181 passing tests** ✅
- Core services: InMemoryDb, ApkgParser, SchedulerV2, DeckService, NoteService, CardService, MediaService
- Repositories: Card, Note, Deck, Model, Media, Revlog, Stats

## 🏗 Architecture

### Data Flow
```
User Action (UI)
    ↓
Service Layer (business logic)
    ↓
Repository Layer (data access)
    ↓
InMemoryDb (in-memory storage)
    ↓
PersistenceService (JSON file)
```

### Study Session Flow
```
SchedulerProvider (context)
    ↓
SchedulerV2 (SM-2 algorithm)
    ↓
StudyScreen (UI)
    ↓
CardPage (vertical pager)
    ↓
RightRail (difficulty buttons)
    ↓
answer() → Update card intervals
    ↓
PersistenceService.save()
```

### AI Deck Generation Flow
```
AIDeckCreatorScreen (input)
    ↓
AiService.generateDeck()
    ↓
Firebase Functions (/ai/deck/generate)
    ↓
OpenAIProvider (GPT-5 Nano)
    ↓
AIDeckPreviewScreen (edit cards)
    ↓
NoteService.createNote() × N
    ↓
Deck appears in DecksScreen
```

## 🎨 Design System

### Colors
- **Brand**: Purple (`#8B5CF6`)
- **Themes**: Light & Dark mode support
- **Semantic colors**: success, error, warning, info

### Typography
- **Font**: System (San Francisco on iOS)
- **Sizes**: xs (12px) to xxl (32px)
- **Weights**: regular (400), medium (500), semibold (600), bold (700)

### Spacing
- **Scale**: xs (4px), s (8px), m (12px), l (16px), xl (20px), xxl (24px)
- **Consistent throughout app**

## 📱 Key Screens

### Home Screen
- Today's review count, accuracy, time spent
- Current & longest streak
- Weekly activity grid (last 7 days)
- Due cards CTA
- Card breakdown (new, learning, review)

### Decks Screen
- Hierarchical deck list with expand/collapse
- Due counts per deck
- Create, rename, delete decks
- Import .apkg files
- Folder management modal

### Study Screen
- TikTok-style vertical pager
- Card front/back reveal with animations
- Difficulty rail (Again, Hard, Good, Easy)
- Progress indicator
- Next card preview

### Discover Screen
- Browse 12+ curated decks
- Filter by category, difficulty, language
- Deck detail modal with metadata
- One-tap download & import

### AI Deck Creator
- Generate decks from topics or notes
- Basic or Cloze note types
- 1-1000 cards per generation
- Preview and edit before saving
- Uses GPT-5 Nano (~$0.001 per 50 cards)

### Card Browser
- Full-text search
- Filter by deck, tag, flag, status
- Bulk operations (suspend, delete, move)
- Multi-select mode

### Note Editor
- Rich text formatting (bold, italic, underline, highlight, code)
- Image insertion (camera or library)
- Audio insertion (file picker)
- Cloze deletion tools
- Tag management

## 🔑 Key Services

### SchedulerV2
Anki-compatible SM-2 spaced repetition algorithm:
- Calculates intervals and ease factors
- Handles new, learning, and review cards
- Supports learning steps (1m, 10m)
- Graduating interval: 1 day
- Easy interval: 4 days
- Max interval: 36500 days (100 years)

### ApkgParser
Full .apkg import with streaming:
- Extracts SQLite database from zip
- Imports notes, cards, decks, models, media
- Handles large files (100MB+)
- Progress reporting
- Maintains Anki compatibility

### InMemoryDb
Anki-compatible in-memory database:
- Repository pattern (Card, Note, Deck, Model, Media, Revlog, Stats)
- JSON persistence to file system
- Ready for SQLite migration
- ~5ms read/write performance

### MediaService
Media file management:
- SHA1-based deduplication
- Stores in `FileSystem.documentDirectory/media/`
- Resolves Anki-style references (`[sound:...]`, `<img src="...">`)
- Garbage collection for unused files

### StatsService
Real-time statistics calculation:
- Today's reviews, accuracy, time spent
- Streak calculation (current & longest)
- Weekly activity grid
- Card breakdown (new, learning, review)
- All calculated from revlog data (no mock data)

## 🔐 Environment Setup

### Development
- `.env.development` - Local development with emulator
- Uses `http://localhost:5001` for backend

### Production
- `.env.production` - Production with deployed functions
- Uses `https://your-region-your-project.cloudfunctions.net`

### Environment Variables
```bash
API_BASE_URL=           # Backend API URL
ENABLE_CLOUD_BACKUP=    # Enable cloud backup (true/false)
ENABLE_AI_FEATURES=     # Enable AI generation (true/false)
APP_ENV=                # Environment (development/production)
```

## 🚢 Deployment

### Build iOS App
```bash
npx expo run:ios --configuration Release
```

### Deploy Firebase Functions
```bash
cd firebase
firebase deploy --only functions
```

### Deploy Hosting (Curated Decks)
```bash
cd firebase
firebase deploy --only hosting
```

## 🤝 Contributing

### Development Workflow
1. Create feature branch: `git checkout -b feature/name`
2. Make changes
3. Run tests: `npm test`
4. Run linter: `npm run lint`
5. Type check: `npm run typecheck`
6. Commit changes
7. Push and create PR

### Code Style
- **ESLint**: React Native rules
- **Prettier**: Code formatting
- **TypeScript**: Strict mode enabled
- **File naming**: PascalCase for components, camelCase for utilities

### Testing Guidelines
- Write tests for all services
- Mock external dependencies (Firebase, file system)
- Aim for >80% coverage on business logic
- Use React Native Testing Library for components

## 📝 License

Private project - All rights reserved

## 🙏 Acknowledgments

- **Anki**: Inspiration and algorithm
- **Expo**: Best React Native framework
- **Firebase**: Backend infrastructure
- **OpenAI**: AI deck generation

## 📞 Support

For questions or issues, please contact the development team.

---

Built with ❤️ using React Native and Expo
