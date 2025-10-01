# Version Alignment Issues

## Current State
The project has version mismatches that may cause build/runtime issues:

- **React**: 19.1.0 (explicitly pinned)
- **React Native**: 0.81.4 (explicitly pinned)
- **Expo SDK**: ~54.0.10
- **Reanimated**: ~4.1.1
- **Jest**: ^30.2.0
- **New Architecture**: Enabled in app.json

## Issues

### 1. React/RN Version Mismatch with Expo SDK
Expo SDK 54 manages React and React Native versions automatically. Explicitly pinning React 19.1.0 and RN 0.81.4 in package.json may conflict with Expo's expected versions.

**Impact**: Build errors, runtime crashes, dependency conflicts

**Recommendation**: Remove explicit `react` and `react-native` version pins from package.json and let Expo SDK 54 manage these versions via `expo install`.

### 2. New Architecture Compatibility
`newArchEnabled: true` is set in app.json but not all native dependencies may support it yet, especially with version mismatches.

**Impact**: Native module crashes, Reanimated issues

**Recommendation**: Verify Expo SDK 54 compatibility matrix for new architecture. Consider disabling until all versions are aligned.

### 3. expo-file-system Legacy Imports
The codebase uses `expo-file-system/legacy` imports which are deprecated.

**Impact**: Will break in future Expo versions

**Current Status**: Kept for now as the new API requires migration
**Future Action**: Migrate to new expo-file-system API when versions are aligned

### 4. Jest Version Stability
Using Jest ^30.2.0 with jest-expo ^54.0.12 is cutting-edge and may be unstable.

**Recommendation**: Lock to versions recommended by jest-expo documentation

## Concrete Action Plan

### Step 1: Remove RN/React Pins and Realign
```bash
# 1. Edit package.json: remove "react" and "react-native" from dependencies
# 2. Run alignment:
npx expo install --fix
npx expo-doctor --fix

# 3. Clear caches:
rm -rf node_modules
npm ci
npx expo start -c
```

**Verify**: `npx expo config --json` shows no extraneous react/react-native resolutions

### Step 2: Reanimated Compatibility
```bash
# Ensure installed via Expo (gets correct version for SDK 54)
npx expo install react-native-reanimated

# Verify Babel plugin is last in babel.config.js (already is)
# Run app once to compile Reanimated
npx expo run:ios
```

**Verify**: No Metro warnings about Reanimated, animations work smoothly

### Step 3: New Architecture Toggle
If you encounter native module crashes after alignment:

```json
// app.json
{
  "expo": {
    "newArchEnabled": false  // Disable until all deps verified
  }
}
```

Then rebuild: `npx expo run:ios --clean`

**Revert path**: Commit before disabling, re-enable after all deps are aligned

### Step 4: Lock Jest to jest-expo Guidance
```bash
# Install jest-expo that matches SDK 54
npx expo install jest-expo

# Lock Jest to what jest-expo requires (check its package.json)
# Avoid floating ^ versions for stability
```

**Verify**: `npm test` runs green

### Step 5: Migrate expo-file-system (After Alignment)
Once versions are stable, plan migration from `/legacy`:

**Files to update**:
- `src/services/anki/ApkgParser.ts`
- `src/services/anki/MediaService.ts`
- `src/services/anki/PersistenceService.ts`
- `src/components/CardContentRenderer.tsx`
- `src/app/Settings/SettingsScreen.tsx`

**API changes needed**:
- `FileSystem.documentDirectory` → Check new API
- `FileSystem.EncodingType.Base64` → Check new API
- `writeAsStringAsync`, `getInfoAsync`, `copyAsync`, `deleteAsync` → Verify signatures

**Test thoroughly** after migration with real .apkg imports and media files

## Verification Checklist

After completing the steps above, verify:

- [ ] `npx expo-doctor` reports no issues
- [ ] `npx expo config --json` shows no extraneous react/react-native resolutions
- [ ] App boots on iOS simulator without Reanimated/runtime warnings
- [ ] `npm run typecheck` passes with no errors
- [ ] `npm test` runs green under jest-expo
- [ ] Study screen animations work smoothly (Reanimated working)
- [ ] Import .apkg file works (file system APIs working)
- [ ] Review progress persists after closing app

## Priority
**Medium-High** - These issues won't immediately break the app but should be addressed before:
- Production deployment
- Adding new native dependencies
- Upgrading Expo SDK versions
- When build/runtime issues arise

## Notes
- **All critical bugs already fixed** (incrementNextPos, persistence, atob/btoa, permissions, etc.)
- Legacy imports currently work fine and were kept to avoid breaking changes during bug fixes
- Version alignment should be done in a dedicated session with thorough testing
- Create a branch for version migration: `git checkout -b version-alignment`
- Commit before each major step for easy rollback
