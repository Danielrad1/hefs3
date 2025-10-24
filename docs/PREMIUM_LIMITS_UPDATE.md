# Premium Limits Update

## Changes Made

### 1. Dynamic Limits Based on Premium Status

**File**: `src/context/PremiumContext.tsx`

- **Free users**: 3 deck generations, 1 hint generation per month
- **Premium users**: 999,999 deck generations, 999,999 hint generations (effectively unlimited)
- Limits update automatically when premium status changes

### 2. Re-enabled Quota Checks

#### AI Deck Creator (`src/app/Decks/AIDeckCreatorScreen.tsx`)
- ✅ Quota check before generation (line 188-193)
- ✅ Premium check for >25 cards (line 247-250)
- ✅ Lock badges on 50/75/100 count options
- ✅ Lock badge on Custom option
- ✅ Premium check when selecting higher counts

#### AI Hints Config (`src/app/Decks/AIHintsConfigScreen.tsx`)
- ✅ Quota check before generation (line 37-42)
- ✅ Usage bar shows remaining hints for free users

### 3. Premium Feature Access

The following features already check `isPremiumEffective` and unlock for premium users:

#### Advanced Statistics (`src/app/Decks/DeckStatsScreen.tsx`)
- ✅ Time window toggle (7/30/90 days)
- ✅ Full detailed stats
- ✅ Hint effectiveness metrics
- ✅ Card distribution charts
- ✅ Review timeline
- ✅ Difficulty breakdown
- Free users see blurred preview with upgrade prompt

#### Premium Themes (`src/app/Settings/ThemeSelectionScreen.tsx`)
- ✅ Lock badges on premium themes
- ✅ Free themes: sunset, ocean, forest, neon
- ✅ Premium themes: All others (15+ additional themes)

#### Settings Screen (`src/app/Settings/SettingsScreen.tsx`)
- ✅ Premium badge in settings
- ✅ Restore Purchases button (iOS only)

### 4. How Premium Unlocks Features

When a user subscribes:

1. **Purchase Flow**:
   - User taps "Subscribe Now" → RevenueCat processes payment
   - Webhook fires → Firebase Function receives event
   - Function sets custom claim: `{ premium: true }`
   - App refreshes token → `isPremiumEffective` becomes `true`

2. **Immediate Effects**:
   - Limits change from `{deck: 3, hints: 1}` to `{deck: 999999, hints: 999999}`
   - All locked features unlock (stats, themes, unlimited AI)
   - Lock badges disappear
   - Usage bars show "Unlimited" status

3. **Persistent**:
   - Premium status stored in Firebase custom claims
   - Survives app restarts, device changes
   - Synced across all user's devices
   - Restore Purchases available if needed

## Testing Checklist

### Free User Experience
- [ ] Deck generation blocked after 3 attempts
- [ ] Hint generation blocked after 1 attempt
- [ ] Lock badges visible on 50/75/100/Custom card counts
- [ ] Premium themes show lock badges
- [ ] Stats screen shows blurred preview with upgrade prompt
- [ ] Paywall opens when hitting limits

### Premium User Experience
- [ ] Unlimited deck generation (no blocking)
- [ ] Unlimited hint generation (no blocking)
- [ ] All card count options unlocked
- [ ] All themes unlocked
- [ ] Full stats visible (no blur, no upgrade prompt)
- [ ] Usage display shows high limits

### Purchase Flow
- [ ] Subscribe → Premium activates immediately
- [ ] Restore Purchases → Premium restored
- [ ] All features unlock after subscription
- [ ] Premium persists after app restart

## Configuration

### Free User Limits
```typescript
limits: { deck: 3, hints: 1 }
```

### Premium User Limits
```typescript
limits: { deck: 999999, hints: 999999 }
```

To change limits, edit `src/context/PremiumContext.tsx`:
- Line 157: Default limits on error
- Line 185: Limits when creating new usage data

## Notes

- Usage resets monthly (based on `monthKey`)
- Premium users bypass all quota checks
- Limits update instantly when premium status changes
- No backend changes required - all client-side
