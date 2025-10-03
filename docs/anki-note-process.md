# Anki Note Creation Process (For .apkg Export)

## Overview

This document explains EXACTLY how Anki creates notes and cards, so we can replicate it perfectly and export valid .apkg files.

---

## The Anki Data Model

### **1. Note (notes table)**

A note contains the RAW DATA (fields like Front, Back, etc.)

```typescript
{
  id: "1609459200000",           // Timestamp in milliseconds
  guid: "Abc123XyZ",             // Random 10-char string (base91)
  mid: 1609459200,               // Model ID (numeric timestamp)
  mod: 1609459200,               // Last modified (epoch seconds)
  usn: -1,                       // Update sequence (-1 = not synced)
  tags: " tag1 tag2 ",           // Space-separated WITH surrounding spaces
  flds: "Front text\x1FBack text", // Fields separated by \x1F
  sfld: 0,                       // Sort field (usually 0)
  csum: 123456789,               // Checksum of first field (sha1)
  flags: 0,
  data: ""
}
```

### **2. Cards (cards table)**

Each note generates 1+ cards based on its Model's templates

```typescript
{
  id: "1609459200001",           // Timestamp in milliseconds
  nid: "1609459200000",          // Note ID (parent)
  did: "1",                      // Deck ID
  ord: 0,                        // Template ordinal (0, 1, 2...)
  mod: 1609459200,               // Last modified (epoch seconds)
  usn: -1,
  type: 0,                       // 0=new, 1=learning, 2=review
  queue: 0,                      // 0=new, 1=learning, 2=review
  due: 0,                        // For new cards: order position
  ivl: 0,                        // Interval (0 for new)
  factor: 0,                     // Ease factor (0 for new, 2500 for studied)
  reps: 0,                       // Review count
  lapses: 0,                     // Lapse count
  left: 0,                       // Steps left (reps*1000 + steps)
  odue: 0,                       // Original due (filtered decks)
  odid: "0",                     // Original deck ID
  flags: 0,
  data: ""
}
```

---

## Step-by-Step Note Creation Process

### **STEP 1: User Fills Fields**

```
User Input:
- Field 0 (Front): "What is the capital of France?"
- Field 1 (Back): "Paris"
- Tags: ["geography", "europe"]
- Deck: "My Deck" (id: "1")
- Model: "Basic" (id: 1609459200, type: 0)
```

### **STEP 2: Generate Note ID**

```typescript
const noteId = Date.now().toString(); // "1609459200000"
```

### **STEP 3: Generate GUID**

```typescript
// Random 10-character string using base91 encoding
const guid = generateBase91(10); // "Abc123XyZ"
```

### **STEP 4: Process Fields**

```typescript
const fields = ['What is the capital of France?', 'Paris'];

// Join with field separator
const flds = fields.join('\x1F'); // "What is the capital of France?\x1FParis"
```

### **STEP 5: Process Tags**

```typescript
const tags = ['geography', 'europe'];

// Space-separated WITH surrounding spaces
const tagsString = ' ' + tags.join(' ') + ' '; // " geography europe "
```

### **STEP 6: Calculate Checksum**

```typescript
import { createHash } from 'crypto';

const firstField = fields[0]; // "What is the capital of France?"
const sha1 = createHash('sha1').update(firstField).digest('hex');
const csum = parseInt(sha1.substring(0, 8), 16); // First 8 hex chars as int
```

### **STEP 7: Create Note Record**

```typescript
const note = {
  id: noteId, // "1609459200000"
  guid: guid, // "Abc123XyZ"
  mid: 1609459200, // Model ID
  mod: Math.floor(Date.now() / 1000), // Current time in seconds
  usn: -1, // Not synced
  tags: ' geography europe ', // WITH spaces!
  flds: 'What is the capital of France?\x1FParis',
  sfld: 0, // Sort field index
  csum: csum, // Calculated above
  flags: 0,
  data: '',
};
```

### **STEP 8: Generate Cards from Templates**

For each template in the model:

```typescript
const model = {
  id: 1609459200,
  name: 'Basic',
  type: 0, // 0=standard, 1=cloze
  tmpls: [
    {
      name: 'Card 1',
      ord: 0,
      qfmt: '{{Front}}', // Question format
      afmt: "{{FrontSide}}<hr id='answer'>{{Back}}", // Answer format
    },
  ],
  flds: [
    { name: 'Front', ord: 0 },
    { name: 'Back', ord: 1 },
  ],
};

// For each template, create a card
for (let i = 0; i < model.tmpls.length; i++) {
  const cardId = (Date.now() + i).toString();

  const card = {
    id: cardId,
    nid: noteId,
    did: '1', // Deck ID
    ord: i, // Template ordinal
    mod: Math.floor(Date.now() / 1000),
    usn: -1,
    type: 0, // New card
    queue: 0, // New queue
    due: getNextDuePosition(), // Position in new queue
    ivl: 0,
    factor: 0, // Ease not set yet
    reps: 0,
    lapses: 0,
    left: 0,
    odue: 0,
    odid: '0',
    flags: 0,
    data: '',
  };

  // Save card to database
  db.insertCard(card);
}
```

### **STEP 9: Get Next Due Position**

```typescript
// For new cards, 'due' is their order position
function getNextDuePosition(): number {
  const maxDue = db.query('SELECT MAX(due) FROM cards WHERE queue = 0');
  return (maxDue || 0) + 1;
}
```

---

## Critical Details for Export

### **Field Separator**

```typescript
const FIELD_SEPARATOR = '\x1F'; // ASCII 31 (Unit Separator)
```

### **Tag Format**

```typescript
// WRONG: "geography europe"
// CORRECT: " geography europe "
// Must have spaces at start AND end!
```

### **IDs Must Be Unique**

```typescript
// Use millisecond timestamps
const noteId = Date.now().toString();
const cardId = (Date.now() + offset).toString();
```

### **GUIDs Must Be Unique**

```typescript
// 10-character base91 string
// Characters: 0-9, a-z, A-Z, and some symbols
function generateGuid() {
  const chars =
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+,-./:;<=>?@[]^_`{|}~';
  let result = '';
  for (let i = 0; i < 10; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}
```

### **Update Sequence Number (usn)**

```typescript
// -1 = Local changes not synced to AnkiWeb
// 0+ = Synced changes
// For new notes/cards: always use -1
```

---

## Cloze Cards (Special Case)

For cloze deletion cards, the process is different:

### **Example Input**

```
Text: "Paris is the capital of {{c1::France}} and {{c2::Italy::wrong!}}"
Model Type: 1 (cloze)
```

### **Card Generation**

```typescript
// Extract all cloze numbers
const clozes = extractClozeNumbers(fields[0]); // [1, 2]

// Create ONE card per cloze number
for (const clozeNum of clozes) {
  const card = {
    ...baseCard,
    ord: clozeNum - 1, // 0-indexed ordinal
  };
  db.insertCard(card);
}
```

### **Cloze Format**

```
Syntax: {{c1::answer::hint}}
- c1, c2, c3... = cloze number
- answer = the hidden text
- hint = optional hint (after ::)
```

---

## .apkg Export Format

### **File Structure**

```
myDeck.apkg (ZIP file)
├── collection.anki2  (SQLite database)
├── media               (JSON mapping: {"0": "image.jpg", "1": "audio.mp3"})
└── 0                   (image.jpg - actual file)
└── 1                   (audio.mp3 - actual file)
```

### **collection.anki2 Tables**

```sql
CREATE TABLE col (
  id INTEGER PRIMARY KEY,
  crt INTEGER NOT NULL,
  mod INTEGER NOT NULL,
  scm INTEGER NOT NULL,
  ver INTEGER NOT NULL,
  dty INTEGER NOT NULL,
  usn INTEGER NOT NULL,
  ls INTEGER NOT NULL,
  conf TEXT NOT NULL,
  models TEXT NOT NULL,    -- JSON
  decks TEXT NOT NULL,     -- JSON
  dconf TEXT NOT NULL,     -- JSON
  tags TEXT NOT NULL       -- JSON
);

CREATE TABLE notes (
  id INTEGER PRIMARY KEY,
  guid TEXT NOT NULL,
  mid INTEGER NOT NULL,
  mod INTEGER NOT NULL,
  usn INTEGER NOT NULL,
  tags TEXT NOT NULL,
  flds TEXT NOT NULL,
  sfld INTEGER NOT NULL,
  csum INTEGER NOT NULL,
  flags INTEGER NOT NULL,
  data TEXT NOT NULL
);

CREATE TABLE cards (
  id INTEGER PRIMARY KEY,
  nid INTEGER NOT NULL,
  did INTEGER NOT NULL,
  ord INTEGER NOT NULL,
  mod INTEGER NOT NULL,
  usn INTEGER NOT NULL,
  type INTEGER NOT NULL,
  queue INTEGER NOT NULL,
  due INTEGER NOT NULL,
  ivl INTEGER NOT NULL,
  factor INTEGER NOT NULL,
  reps INTEGER NOT NULL,
  lapses INTEGER NOT NULL,
  left INTEGER NOT NULL,
  odue INTEGER NOT NULL,
  odid INTEGER NOT NULL,
  flags INTEGER NOT NULL,
  data TEXT NOT NULL
);

CREATE TABLE revlog (
  id INTEGER PRIMARY KEY,
  cid INTEGER NOT NULL,
  usn INTEGER NOT NULL,
  ease INTEGER NOT NULL,
  ivl INTEGER NOT NULL,
  lastIvl INTEGER NOT NULL,
  factor INTEGER NOT NULL,
  time INTEGER NOT NULL,
  type INTEGER NOT NULL
);

CREATE TABLE graves (
  usn INTEGER NOT NULL,
  oid INTEGER NOT NULL,
  type INTEGER NOT NULL
);
```

---

## Your Implementation Status

### ✅ **What You Have**

- `AnkiNote` type matching Anki's schema
- `AnkiCard` type matching Anki's schema
- Field separator constant (`\x1F`)
- Model/NoteType support
- GUID generation
- Checksum calculation

### ⚠️ **What Needs Verification**

1. **Tag format** - Are you adding surrounding spaces?
2. **Card generation** - Are you creating cards for each template?
3. **Due position** - Are new cards getting sequential due numbers?
4. **USN values** - Should be -1 for local notes

### 📝 **For Export**

You'll need to:

1. Create SQLite database with correct schema
2. Insert all notes, cards, models, decks into col table
3. Package as ZIP with media files
4. Rename to .apkg

---

## Implementation Checklist

- [ ] Generate unique note IDs (timestamp)
- [ ] Generate unique GUIDs (10-char base91)
- [ ] Join fields with `\x1F`
- [ ] Format tags with surrounding spaces
- [ ] Calculate SHA1 checksum of first field
- [ ] Create card for EACH template in model
- [ ] Assign sequential due positions to new cards
- [ ] Set USN to -1 for local changes
- [ ] For cloze: detect cloze numbers and create cards
- [ ] Export to SQLite .anki2 format
- [ ] Package with media as ZIP → .apkg
