# 🆓 Removed Paid Features - Free Version

This document tracks all premium/subscription features that were removed in the `free-everything` branch and how to restore them later.

---

## 📋 Overview

**Branch:** `free-everything`  
**Purpose:** Create a completely free version with no paywalls, subscriptions, or usage limits  
**Date:** November 4, 2025

### What Was Removed
- ❌ RevenueCat integration (in-app purchases)
- ❌ Premium subscriptions
- ❌ Free tier usage quotas/limits
- ❌ Model selection (basic vs advanced AI)
- ❌ Premium upsell modals
- ❌ Usage tracking UI
- ❌ "Restore Purchases" functionality
- ❌ Premium theme locks

### What's Now Free
- ✅ Unlimited AI deck generation (uses basic model)
- ✅ Unlimited AI hints (uses advanced model)
- ✅ All color themes unlocked
- ✅ No monthly quotas
- ✅ Everyone is "premium"

---

## 🔧 Changes Made

### 1. Server Changes (Firebase Functions)

#### `firebase/functions/src/middleware/auth.ts`
**What Changed:**
- Force `premium: true` for all authenticated users
- Made `requirePremium()` middleware a no-op

**Original Code:**
```typescript
const user: DecodedToken = {
  uid: decodedToken.uid,
  email: decodedToken.email,
  premium: decodedToken.premium === true, // Custom claim
} as DecodedToken;

export function requirePremium(req, res, next) {
  const user = (req as AuthenticatedRequest).user;
  if (!user?.premium) {
    res.status(403).json({
      success: false,
      error: {
        code: errorCodes.FORBIDDEN,
        message: 'Premium subscription required',
      },
    });
    return;
  }
  next();
}
```

**Free Version:**
```typescript
const user: DecodedToken = {
  uid: decodedToken.uid,
  email: decodedToken.email,
  premium: true, // Free version: everyone is premium
} as DecodedToken;

export function requirePremium(req, res, next) {
  // Free version: everyone is premium, just continue
  next();
}
```

**To Restore:**
- Revert to checking `decodedToken.premium === true`
- Restore the 403 check in `requirePremium()`

---

#### `firebase/functions/src/middleware/quota.ts`
**What Changed:**
- Short-circuited `withQuota()` to bypass all quota checks

**Original Code:**
```typescript
export function withQuota(config: QuotaConfig) {
  return async (req, res, next) => {
    const user = (req as AuthenticatedRequest).user;
    
    // Premium users bypass quota
    if (user.premium) {
      next();
      return;
    }
    
    // Check and enforce quota limits...
  };
}
```

**Free Version:**
```typescript
export function withQuota(config: QuotaConfig) {
  return async (req, res, next) => {
    // Free version: no quotas, everyone is unlimited
    next();
    return;
    // ... rest of code unreachable
  };
}
```

**To Restore:**
- Remove the early `next(); return;`
- Restore quota checking logic for free users

---

#### `firebase/functions/src/index.ts`
**What Changed:**
- Removed RevenueCat webhook route

**Original Code:**
```typescript
import { revenueCatWebhook } from './handlers/revenuecat';
// ...
app.post('/iap/revenuecat/webhook', revenueCatWebhook);
```

**Free Version:**
```typescript
// import { revenueCatWebhook } from './handlers/revenuecat'; // Free version: removed
// ...
// app.post('/iap/revenuecat/webhook', revenueCatWebhook); // Removed
```

**To Restore:**
- Uncomment the import
- Uncomment the webhook route

---

### 2. Client Changes

#### `src/context/PremiumContext.tsx`
**What Changed:**
- Set `isPremiumEffective` to always `true`
- Made `subscribe()` and `restore()` no-ops
- Set unlimited limits (999999)
- Disabled RevenueCat initialization

**Key Changes:**
```typescript
// Original
const [isPremiumEffective, setIsPremiumEffective] = useState(false);

// Free version
const [isPremiumEffective, setIsPremiumEffective] = useState(true);

// Original checkPremiumStatus
const checkPremiumStatus = useCallback(async () => {
  // Complex logic checking Firebase claims and RC entitlements
}, [user, rcInitialized]);

// Free version
const checkPremiumStatus = useCallback(async () => {
  setIsPremiumEffective(true);
}, [user, rcInitialized]);

// Original limits
limits: {
  deck: 3,
  basicDecks: 3,
  advancedDecks: 1,
  basicHints: 3,
  advancedHints: 1,
}

// Free version
limits: {
  deck: 999999,
  basicDecks: 999999,
  advancedDecks: 999999,
  basicHints: 999999,
  advancedHints: 999999,
}
```

**To Restore:**
1. Revert `isPremiumEffective` initial state to `false`
2. Restore full `checkPremiumStatus()` logic
3. Restore RevenueCat initialization in `useEffect`
4. Restore actual limit values (3 for basic, 1 for advanced)
5. Restore `subscribe()` and `restore()` implementations

---

#### `src/app/Settings/SettingsScreen.tsx`
**What Changed:**
- Removed premium upgrade banner
- Removed "Premium Active" banner
- Removed usage display
- Removed "Restore Purchases" button
- Removed PremiumUpsellModal

**Removed UI Elements:**
```typescript
// Premium upgrade banner (lines 297-349)
{!isPremiumEffective && (
  <Pressable onPress={handleSubscription} style={styles.premiumBanner}>
    <LinearGradient colors={['#7C3AED', '#9333EA', '#A855F7']}>
      {/* Premium upgrade UI */}
    </LinearGradient>
  </Pressable>
)}

// Premium active banner (lines 351-380)
{isPremiumEffective && (
  <View style={styles.premiumActiveBanner}>
    {/* Premium active UI */}
  </View>
)}

// Usage display (lines 382-398)
{!isPremiumEffective && usage && (
  <View style={styles.usageBanner}>
    {/* Usage stats */}
  </View>
)}

// Restore purchases button (lines 472-479)
{Platform.OS === 'ios' && (
  <SettingItem 
    icon="refresh" 
    title="Restore Purchases"
    onPress={handleRestorePurchases} 
  />
)}

// Premium modal (lines 618-621)
<PremiumUpsellModal
  visible={showPremiumModal}
  onClose={() => setShowPremiumModal(false)}
/>
```

**To Restore:**
1. Add back all removed UI sections
2. Restore `handleSubscription()` and `handleRestorePurchases()` functions
3. Restore `showPremiumModal` state
4. Re-import `PremiumUpsellModal`

---

#### `src/app/Settings/ThemeSelectionScreen.tsx`
**What Changed:**
- Removed premium checks for theme selection
- Removed lock badges on premium themes
- Made all themes free

**Original Code:**
```typescript
const handleThemeSelect = (themeId: ColorScheme) => {
  const freeThemes: ColorScheme[] = ['sunset', 'ocean', 'forest', 'neon'];
  const isThemeFree = freeThemes.includes(themeId);
  
  if (!isPremiumEffective && !isThemeFree) {
    setShowPremiumModal(true);
    return;
  }
  
  theme.setColorScheme(themeId);
};

// Lock badge on premium themes
{!isPremiumEffective && !['sunset', 'ocean', 'forest', 'neon'].includes(themeOption.id) && (
  <View style={styles.lockBadge}>
    <Ionicons name="lock-closed" size={12} color="#fff" />
  </View>
)}
```

**Free Version:**
```typescript
const handleThemeSelect = (themeId: ColorScheme) => {
  // Free version: all themes are available
  theme.setColorScheme(themeId);
};

// Lock badge removed
```

**To Restore:**
1. Restore premium check in `handleThemeSelect()`
2. Add back lock badge UI for non-free themes
3. Restore `showPremiumModal` state and modal

---

#### `src/app/Decks/AIDeckCreatorScreen.tsx`
**What Changed:**
- Removed model selection step
- Default to `basic` model for deck generation
- Skip model selection, go directly to generation

**Original Flow:**
```
Choice → Files → Settings → Instructions → Model Selection → Generate
```

**Free Version Flow:**
```
Choice → Files → Settings → Instructions → Generate (basic model)
```

**Key Changes:**
```typescript
// Added constant
const DEFAULT_MODEL_TIER: ModelTier = 'basic';

// Removed from imports
import ModelSelectionStep from './components/ModelSelectionStep';

// Removed from state
const [selectedModelTier, setSelectedModelTier] = useState<ModelTier>('basic');
const [showPremiumModal, setShowPremiumModal] = useState(false);

// Modified handleNext to skip model selection
} else if (currentStep === 'settings') {
  if (useFiles) {
    setCurrentStep('instructions');
  } else {
    handleGenerate(); // Skip model selection
  }
}

// Use default model
navigation.navigate('AIGenerating', {
  // ...
  modelTier: DEFAULT_MODEL_TIER, // Instead of selectedModelTier
});
```

**To Restore:**
1. Re-import `ModelSelectionStep`
2. Restore `selectedModelTier` state
3. Restore model selection step in flow
4. Update `handleNext()` to navigate to model selection
5. Pass `selectedModelTier` to generation screen

---

#### `src/app/Decks/AIHintsConfigScreen.tsx`
**What Changed:**
- Default to `advanced` model for hints
- Skip model selection, navigate directly to generation
- Removed usage bar display

**Original Code:**
```typescript
// Navigate to model selection
navigation.navigate('AIHintsModelSelection', {
  deckId,
  deckName,
  totalCards: cards.length,
  items,
});

// Usage bar
{!isPremiumEffective && (
  <View style={styles.usageBar}>
    <Text>Free hints: {usage?.basicHintGenerations || 0}/{usage?.limits?.basicHints || 3} Basic • ...</Text>
  </View>
)}
```

**Free Version:**
```typescript
// Added constant
const DEFAULT_HINTS_MODEL_TIER: 'basic' | 'advanced' = 'advanced';

// Skip model selection
navigation.navigate('AIHintsGenerating', {
  deckId,
  deckName,
  totalCards: cards.length,
  items,
  modelTier: DEFAULT_HINTS_MODEL_TIER,
});

// Usage bar removed
```

**To Restore:**
1. Remove `DEFAULT_HINTS_MODEL_TIER` constant
2. Navigate to `AIHintsModelSelection` instead of `AIHintsGenerating`
3. Restore usage bar UI
4. Restore `showPremiumModal` state and modal

---

#### `src/app/Decks/ManageHintsScreen.tsx`
**What Changed:**
- Default to `advanced` model for hint regeneration
- Skip model selection when regenerating

**To Restore:**
- Navigate to `AIHintsModelSelection` instead of directly to `AIHintsGenerating`

---

#### `src/navigation/DecksStack.tsx`
**What Changed:**
- Removed model selection screen imports and routes

**Original Code:**
```typescript
import AIDeckModelSelectionScreen from '../app/Decks/AIDeckModelSelectionScreen';
import AIHintsModelSelectionScreen from '../app/Decks/AIHintsModelSelectionScreen';

<Stack.Screen name="AIDeckModelSelection" component={AIDeckModelSelectionScreen} />
<Stack.Screen name="AIHintsModelSelection" component={AIHintsModelSelectionScreen} />
```

**Free Version:**
```typescript
// Imports removed
// Routes removed
```

**To Restore:**
1. Re-import both model selection screens
2. Add back both `<Stack.Screen>` entries

---

### 3. Configuration Changes

#### `package.json`
**What Changed:**
- Removed `react-native-purchases` dependency

**Original:**
```json
"react-native-purchases": "^9.6.0",
```

**Free Version:**
```json
// Removed
```

**To Restore:**
1. Add back to dependencies: `"react-native-purchases": "^9.6.0"`
2. Run `npm install`
3. Run `npx pod-install` (iOS)

---

#### `app.config.js`
**What Changed:**
- Removed RevenueCat configuration
- Set `enableIAP: false`

**Original:**
```javascript
// RevenueCat Configuration
rcPublicKey: process.env.RC_PUBLIC_API_KEY,
enableIAP: process.env.ENABLE_IAP !== 'false',
enableRcEntitlementFallback: process.env.ENABLE_RC_ENTITLEMENT_FALLBACK === 'true',
```

**Free Version:**
```javascript
// Free version: RevenueCat and IAP disabled
enableIAP: false,
```

**To Restore:**
1. Add back `rcPublicKey` configuration
2. Restore `enableIAP` logic
3. Restore `enableRcEntitlementFallback` configuration

---

## 🔄 Complete Restoration Guide

### Step 1: Revert Server Changes
```bash
cd firebase/functions/src

# Restore auth middleware
git checkout main -- middleware/auth.ts

# Restore quota middleware
git checkout main -- middleware/quota.ts

# Restore index with webhook
git checkout main -- index.ts
git checkout main -- handlers/revenuecat.ts
```

### Step 2: Revert Client Changes
```bash
cd src

# Restore premium context
git checkout main -- context/PremiumContext.tsx

# Restore settings screens
git checkout main -- app/Settings/SettingsScreen.tsx
git checkout main -- app/Settings/ThemeSelectionScreen.tsx

# Restore AI generation flows
git checkout main -- app/Decks/AIDeckCreatorScreen.tsx
git checkout main -- app/Decks/AIHintsConfigScreen.tsx
git checkout main -- app/Decks/ManageHintsScreen.tsx

# Restore navigation
git checkout main -- navigation/DecksStack.tsx

# Restore model selection screens
git checkout main -- app/Decks/AIDeckModelSelectionScreen.tsx
git checkout main -- app/Decks/AIHintsModelSelectionScreen.tsx

# Restore premium modal
git checkout main -- components/premium/PremiumUpsellModal.tsx
```

### Step 3: Restore Dependencies
```bash
# Restore package.json
git checkout main -- package.json

# Install dependencies
npm install

# iOS: Install pods
npx pod-install
```

### Step 4: Restore Configuration
```bash
# Restore app config
git checkout main -- app.config.js

# Set environment variables
# Add RC_PUBLIC_API_KEY to .env
# Set ENABLE_IAP=true
```

### Step 5: Rebuild
```bash
# Clear cache
npx expo start --clear

# Rebuild native
npx expo run:ios
```

---

## 📊 Model Tier Defaults (Free Version)

| Feature | Free Version Model | Original (Paid) |
|---------|-------------------|-----------------|
| Deck Generation | `basic` | User choice (basic/advanced) |
| Hints Generation | `advanced` | User choice (basic/advanced) |
| Hints Regeneration | `advanced` | User choice (basic/advanced) |

---

## 🎯 Quick Reference

### Files Modified (20 total)

**Server (3):**
- `firebase/functions/src/middleware/auth.ts`
- `firebase/functions/src/middleware/quota.ts`
- `firebase/functions/src/index.ts`

**Client (14):**
- `src/context/PremiumContext.tsx`
- `src/app/Settings/SettingsScreen.tsx`
- `src/app/Settings/ThemeSelectionScreen.tsx`
- `src/app/Decks/AIDeckCreatorScreen.tsx`
- `src/app/Decks/AIHintsConfigScreen.tsx`
- `src/app/Decks/ManageHintsScreen.tsx`
- `src/navigation/DecksStack.tsx`
- `src/components/premium/PremiumUpsellModal.tsx` (usage removed)
- `src/app/Decks/AIDeckModelSelectionScreen.tsx` (removed from nav)
- `src/app/Decks/AIHintsModelSelectionScreen.tsx` (removed from nav)
- `src/app/Decks/components/ModelSelectionStep.tsx` (usage removed)

**Config (3):**
- `package.json`
- `app.config.js`
- `.env` (RC keys removed)

---

## 💡 Tips for Restoration

1. **Test incrementally** - Restore one feature at a time
2. **Check environment variables** - Ensure RC keys are set
3. **Rebuild native** - IAP requires native rebuild
4. **Test on device** - StoreKit only works on real devices
5. **Verify webhooks** - Ensure RC webhook is configured
6. **Check Firebase claims** - Premium status syncs via custom claims

---

## 📝 Notes

- All removed code is preserved in the `main` branch
- The `free-everything` branch is a complete working version
- Model selection screens still exist in codebase, just not used
- RevenueCat handler still exists, just not routed
- Premium context still tracks usage, just with unlimited limits

This free version can coexist with the paid version - just maintain both branches!
