# Media Filename Handling Fix

## 🐛 The Problem

**Critical Bug:** Inconsistent media filename encoding across the app caused missing images and audio files.

### What Was Broken:

1. **ImageCache** was normalizing filenames by replacing special characters with underscores: `photo #1.jpg` → `photo__1.jpg`
2. **MediaService** was writing files with encoded names: `photo #1.jpg` → `photo%20%231.jpg`
3. **Renderers** were encoding filenames separately with `encodeURIComponent()`
4. **WYSIWYG Editor** was using yet another path construction method

**Result:** Files saved as `photo%20%231.jpg` couldn't be found when ImageCache looked for `photo__1.jpg` → **Missing media in cards!**

---

## ✅ The Solution

### Canonical Media URI Helper

Created a **single source of truth** for media file paths in `src/utils/mediaHelpers.ts`:

```typescript
export function getMediaUri(filename: string): string {
  // ALWAYS encode the filename to handle spaces and special characters
  return `${MEDIA_DIR}${encodeURIComponent(filename)}`;
}
```

### What Changed:

#### **1. Created Shared Helper** (`src/utils/mediaHelpers.ts`)
- `getMediaUri(filename)` - Canonical URI builder
- `sanitizeMediaFilename(filename)` - Path traversal protection
- `MEDIA_DIR` - Single source of truth for media directory

#### **2. Updated MediaService** (`src/services/anki/MediaService.ts`)
- ✅ Uses `getMediaUri()` for ALL file operations
- ✅ Uses `sanitizeMediaFilename()` for security (no character replacement)
- ✅ Stores original filenames in database (no mangling)

#### **3. Updated ImageCache** (`src/utils/ImageCache.ts`)
- ❌ **REMOVED** `normalizeFilename()` that replaced characters
- ✅ Uses `getMediaUri()` directly with original filenames
- ✅ Cache keys are now original filenames (consistent with DB)

#### **4. Updated Renderers** (`src/components/CardContentRendererV2.tsx`)
- ❌ **REMOVED** manual `encodeURIComponent()` calls
- ✅ Uses `getMediaUri()` for images and audio

#### **5. Updated WYSIWYG Editor** (`src/components/WYSIWYGEditor.tsx`)
- ❌ **REMOVED** manual path construction with `MEDIA_DIR`
- ✅ Uses `getMediaUri()` for file access

---

## 🎯 The Key Principle

**NEVER manually construct media file paths!**

### ❌ Wrong (Before):
```typescript
// Different places doing different things:
const path = `${MEDIA_DIR}${filename.replace(/[^A-Za-z0-9._-]/g, '_')}`;
const path = `${MEDIA_DIR}${encodeURIComponent(filename)}`;
const path = MEDIA_DIR + filename;
```

### ✅ Correct (After):
```typescript
// ONE way, everywhere:
const path = getMediaUri(filename);
```

---

## 📝 Filename Flow

### During Import (.apkg):
1. Extract file from zip: `photo #1.jpg`
2. Sanitize for security: `photo #1.jpg` (unchanged - spaces and # are safe)
3. Write to disk: `{mediaDir}/photo%20%231.jpg` (encodeURIComponent)
4. Store in DB: `filename: "photo #1.jpg"` (original name)

### During Rendering:
1. Get filename from DB: `photo #1.jpg`
2. Build URI: `getMediaUri("photo #1.jpg")` → `{mediaDir}/photo%20%231.jpg`
3. Load file: ✅ **Found!**

### During Preloading (ImageCache):
1. Extract from HTML: `photo #1.jpg`
2. Build URI: `getMediaUri("photo #1.jpg")` → `{mediaDir}/photo%20%231.jpg`
3. Cache with key: `photo #1.jpg` (original)
4. Lookup: ✅ **Cache hit!**

---

## 🔒 Security

The `sanitizeMediaFilename()` function provides path traversal protection:

```typescript
// ✅ Allowed:
"photo #1.jpg"      → "photo #1.jpg"
"北京.jpg"          → "北京.jpg"
"file (copy).png"   → "file (copy).png"

// ❌ Blocked:
"../../etc/passwd"  → Error (path traversal)
"/absolute/path"    → Error (path separator)
"../sneaky.jpg"     → "sneaky.jpg" (.. removed)
```

**Key Point:** We preserve characters (spaces, #, unicode) but block path attacks.

---

## ✅ Testing

All 181 tests pass with the new implementation:
- ✅ MediaService tests validate file writing with encoded paths
- ✅ ImageCache tests verify preloading and dimension caching
- ✅ Integration tests confirm end-to-end media flow

---

## 🚀 Impact

### Before Fix:
- ❌ Images with spaces: **BROKEN**
- ❌ Images with #: **BROKEN**
- ❌ Images with unicode: **BROKEN**
- ❌ Audio files: **BROKEN**
- ❌ Preloading: **BROKEN** (cache misses)

### After Fix:
- ✅ All filenames work correctly
- ✅ Consistent behavior across import, render, preload
- ✅ Single source of truth prevents future drift
- ✅ All 181 tests passing

---

## 📚 For Future Developers

**Golden Rule:** If you need a media file path, use `getMediaUri(filename)`.

**Never:**
- Manually construct paths with `MEDIA_DIR + filename`
- Call `encodeURIComponent()` yourself
- Replace characters in filenames
- Import `MEDIA_DIR` directly

**Always:**
```typescript
import { getMediaUri } from '../utils/mediaHelpers';

// Get file path
const uri = getMediaUri(filename);

// That's it!
```

---

## 🔍 Files Changed

1. ✅ `src/utils/mediaHelpers.ts` - **NEW** canonical helpers
2. ✅ `src/services/anki/MediaService.ts` - Uses `getMediaUri()`
3. ✅ `src/utils/ImageCache.ts` - Removed `normalizeFilename()`, uses `getMediaUri()`
4. ✅ `src/components/CardContentRendererV2.tsx` - Uses `getMediaUri()`
5. ✅ `src/components/WYSIWYGEditor.tsx` - Uses `getMediaUri()`

---

**Status:** ✅ **FIXED - Production Ready**
**Tests:** ✅ **181/181 Passing**
**Impact:** 🎯 **High - Fixes missing media bug**
