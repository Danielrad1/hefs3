# Offline Mode Implementation

## Summary
Implemented graceful offline handling across the entire app to provide clear feedback when network features are unavailable.

## Changes Made

### 1. **Network Detection Service**
- **File**: `src/services/network/NetworkService.ts`
- Centralized service for checking connectivity using `@react-native-community/netinfo`
- Provides `isOnline()` async check
- Supports subscriptions for real-time connectivity changes

### 2. **API Service Enhanced**
- **File**: `src/services/cloud/ApiService.ts`
- Added network check before all API requests
- Improved error messages:
  - `NETWORK_OFFLINE` → "No internet connection. Please check your network and try again."
  - `AbortError` → "Request timed out..."
  - Fetch failures → "Unable to connect to the server..."

### 3. **Global Offline Banner**
- **File**: `src/components/OfflineBanner.tsx`
- Animated banner that slides in when offline
- Positioned at top of screen with safe area insets
- Auto-hides when connection restored
- **Integrated in**: `src/index.tsx` (rendered at root level)

### 4. **AI Features - Offline Checks**
Added network validation before navigation to AI screens:

#### Deck Generation
- **File**: `src/app/Decks/AIDeckCreatorScreen.tsx`
- Checks connectivity before starting generation
- Shows alert: "AI deck generation requires an internet connection..."

#### Hints Generation  
- **File**: `src/app/Decks/AIHintsConfigScreen.tsx`
- Checks connectivity before generating hints
- Shows alert: "AI hints generation requires an internet connection..."

- **File**: `src/app/Decks/ManageHintsScreen.tsx`
- Checks connectivity before regenerating hints
- Same offline alert messaging

### 5. **Cloud Backup - Offline Checks**
- **File**: `src/app/Settings/components/BackupSection.tsx`
- Added checks before upload: "Cloud backup requires an internet connection..."
- Added checks before restore: "Restoring from cloud requires an internet connection..."

### 6. **React Hook for Components**
- **File**: `src/hooks/useNetworkStatus.ts`
- Simple hook: `const { isOnline } = useNetworkStatus()`
- For components that need reactive offline state

## Dependencies Added
```json
"@react-native-community/netinfo": "^11.4.1"
```

## How It Works

### Core Functionality
1. **Study/Review** - Works 100% offline (local database)
2. **Browse Decks** - Works 100% offline
3. **Manual Card Creation** - Works 100% offline
4. **Statistics** - Works 100% offline

### Network-Required Features
1. **AI Deck Generation** - Blocked with clear message
2. **AI Hints Generation** - Blocked with clear message
3. **Cloud Backup/Restore** - Blocked with clear message
4. **Premium Status Refresh** - Degrades gracefully with cache

### User Experience
- **Banner**: Persistent visual indicator when offline
- **Pre-checks**: Network validated before expensive operations
- **Clear Alerts**: Specific messages explaining why features are unavailable
- **Graceful Degradation**: App never crashes, just disables network features

## Testing

### Manual Testing
1. Enable airplane mode
2. Open app → Banner appears at top
3. Try to generate deck → Alert: "No internet connection"
4. Try to generate hints → Alert: "No internet connection"
5. Try to backup → Alert: "Cloud backup requires internet"
6. Study cards → Works perfectly offline
7. Disable airplane mode → Banner disappears

### Edge Cases Handled
- Slow/unstable connections → Timeout errors with helpful messages
- Connection lost mid-request → Caught and explained
- No origin header (mobile apps) → Allowed by CORS

## Future Improvements (Optional)
- [ ] Queue operations for when back online
- [ ] Show last successful sync timestamp
- [ ] Offline-first sync strategy for premium status
- [ ] Retry failed requests automatically
- [ ] Show data staleness warnings

## Files Modified
```
src/services/network/NetworkService.ts          (NEW)
src/components/OfflineBanner.tsx                (NEW)
src/hooks/useNetworkStatus.ts                   (NEW)
src/services/cloud/ApiService.ts                (MODIFIED)
src/index.tsx                                   (MODIFIED)
src/app/Decks/AIDeckCreatorScreen.tsx          (MODIFIED)
src/app/Decks/AIHintsConfigScreen.tsx          (MODIFIED)
src/app/Decks/ManageHintsScreen.tsx            (MODIFIED)
src/app/Settings/components/BackupSection.tsx   (MODIFIED)
package.json                                    (MODIFIED)
```

## Migration Notes
No breaking changes. All changes are additive and backward compatible.
