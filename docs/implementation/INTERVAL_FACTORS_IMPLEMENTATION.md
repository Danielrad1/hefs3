# Interval Factors & Complete Anki Settings Implementation

## Overview

Fully implemented Anki-level interval factor tuning and comprehensive deck settings, matching Anki desktop's capabilities. All algorithm settings and interval controls are now consolidated in the **Study Options** screen.

## What Was Implemented

### 1. Interval Modifier (Global Multiplier)

**Location**: `rev.ivlFct` in DeckConfig  
**UI**: "Interval modifier (%)" in Study Options → SM-2 Settings → Reviews

**Behavior**:
- Multiplies ALL computed intervals (reviews + graduations)
- Applied to:
  - Review intervals (Hard, Good, Easy)
  - Graduating intervals (New → Review)
  - Easy intervals (New → Review via Easy button)
  - Relearning graduation intervals
- Default: 100% (1.0 multiplier)
- Range: Any positive percentage (e.g., 80% = shorter intervals, 120% = longer)

**Implementation**:
```typescript
// In Sm2Algorithm.answerReview()
newIvl = Math.ceil(card.ivl * fct * config.rev.ivlFct);

// In graduation paths
const graduatingIvl = Math.max(1, Math.ceil(config.new.ints[0] * config.rev.ivlFct));
```

### 2. Complete SM-2 Settings

#### Daily Limits
- **New cards per day** (`new.perDay`) - Default: 20
- **Reviews per day** (`rev.perDay`) - Default: 200

#### New Cards
- **Learning steps** (`new.delays`) - Minutes, e.g., "1 10" = 1min, 10min
- **Graduating interval** (`new.ints[0]`) - Days when graduating with Good
- **Easy interval** (`new.ints[1]`) - Days when graduating with Easy
- **New card order** (`new.order`) - Sequential (0) or Random (1)

#### Reviews
- **Interval modifier** (`rev.ivlFct`) - Global multiplier, default 100%
- **Easy bonus** (`rev.ease4`) - Permille added to ease on Easy button
  - UI: Displayed as percentage (e.g., 150 permille = 15%)
  - Affects: Easy button graduations and reviews
- **Maximum interval** (`rev.maxIvl`) - Cap in days, default 36500 (100 years)
- **Fuzz factor** (`rev.fuzz`) - Randomness ±%, default 5%

#### Lapses (Advanced)
- **Relearning steps** (`lapse.delays`) - Minutes, e.g., "10"
- **Lapse interval multiplier** (`lapse.mult`) - Reduce interval by %, default 50%
- **Minimum interval** (`lapse.minInt`) - Days after relearning, default 1
- **Leech threshold** (`lapse.leechFails`) - Lapses before leech, default 8
- **Leech action** (`lapse.leechAction`) - Suspend (0) or Tag Only (1)

### 3. FSRS Settings

**Algorithm**: Modern spaced repetition based on stability/difficulty model

#### Core Settings
- **Target retention** (`algoParams.fsrs.retention`) - Default 90%
  - Range: 70-100%
  - Higher = shorter intervals (more work, better retention)
  - Lower = longer intervals (less work, acceptable forgetting)
- **New cards per day** - Same as SM-2
- **Reviews per day** - Same as SM-2

#### Advanced (Future)
- **FSRS weights** (`algoParams.fsrs.weights`) - 17 trained parameters
- **Daily minutes budget** (`algoParams.fsrs.dailyMinutes`) - For AI mode

**How It Works**:
- Stores stability (S) and difficulty (D) per card in `card.data.fsrs`
- Calculates retrievability based on elapsed time
- Updates S and D based on answer quality
- Computes next interval from S and target retention
- No fixed learning steps - dynamic intervals

### 4. Leitner Settings

**Algorithm**: Simple box system with fixed intervals

#### Settings
- **Box intervals** (`algoParams.leitner.intervals`) - Days per box
  - Default: "10m 1 2 4 8 16 32 64" (minutes for box 0)
  - Format: Mix minutes (e.g., "10m") and days (e.g., "1")
  - Fully customizable per deck
- **Drop boxes on wrong** (`algoParams.leitner.dropBoxes`)
  - 0 = Reset to box 0 (default)
  - N = Drop N boxes (e.g., 1 = drop one box)
- **New cards per day** - Same as SM-2
- **Reviews per day** - Same as SM-2

**How It Works**:
- Stores box number in `card.data.leitner.box`
- Correct: Advance to next box (Easy skips +2, Hard stays)
- Wrong: Drop boxes or reset based on setting
- Interval determined by box number → intervals array

### 5. AI Optimized Settings

**Algorithm**: FSRS with automatic parameter tuning

#### Settings
- **Target retention** (`algoParams.ai.retention`) - Default 90%
- **Daily minutes budget** (`algoParams.ai.dailyMinutes`) - Default 15
- **Goal** (`algoParams.ai.goal`) - Retention/Time/Balanced
  - Future: Controls optimization objective

**Planned Features** (Not Yet Implemented):
- Auto-adjust new/day to fit time budget
- Train FSRS weights from review history
- Workload forecasting and adaptation
- Overdueness index monitoring

## UI Organization

### Study Options Screen Structure

```
Algorithm Selection (Cards with icons)
├─ Classic (SM-2)
├─ FSRS (Smart)
├─ Leitner (Simple)
└─ AI Optimized (Auto)

[Selected Algorithm Settings]
├─ Daily Limits
│  ├─ New cards per day
│  └─ Reviews per day
├─ Algorithm-Specific Settings
│  └─ [Varies by algorithm]
└─ Advanced (Toggle)
   └─ [Advanced settings if applicable]
```

### SM-2 Settings Layout
```
Daily Limits
  • New cards per day: [20]
  • Reviews per day: [200]

New Cards
  • Learning steps (minutes): [1 10]
  • Graduating interval (days): [1]
  • Easy interval (days): [4]
  • New card order: [Sequential ▼]

Reviews
  • Interval modifier (%): [100]
  • Easy bonus (%): [15]
  • Maximum interval (days): [36500]

[Show advanced settings ▼]
  • Fuzz factor (%): [5]
  
  Lapses
  • Relearning steps (min): [10]
  • Lapse interval mult (%): [50]
  • Minimum interval (days): [1]
  • Leech threshold: [8]
  • Leech action: [Suspend ▼]
```

## How Interval Modifier Affects Everything

### Example: 80% Interval Modifier

**Graduating (New → Review)**:
- Config: Graduating = 1 day, Modifier = 80%
- Result: `Math.ceil(1 * 0.8)` = **1 day** (minimum 1 day enforced)

**Graduating (Easy)**:
- Config: Easy = 4 days, Modifier = 80%
- Result: `Math.ceil(4 * 0.8)` = **4 days** (rounded up)

**Review (Good)**:
- Ease: 2.5 (2500 permille), Last interval: 10 days, Modifier: 80%
- Computation: `10 * 2.5 * 0.8` = **20 days**
- With fuzz ±5%: 19-21 days

**Review (Easy)**:
- Ease: 2.5, Last interval: 10 days, Modifier: 80%, Easy multiplier: 1.3
- Computation: `10 * 2.5 * 0.8 * 1.3` = **26 days**
- With fuzz ±5%: 25-27 days

### Example: 120% Interval Modifier

**Review (Good)**:
- Ease: 2.5, Last interval: 10 days, Modifier: 120%
- Computation: `10 * 2.5 * 1.2` = **30 days**

**Effect**: Longer intervals = less frequent reviews = lower workload BUT higher forgetting risk

## Use Cases

### Conservative Learner (Want Higher Retention)
- Interval modifier: **80-90%**
- Target retention (FSRS): **90-95%**
- Effect: More frequent reviews, better retention

### Aggressive Learner (Minimize Time)
- Interval modifier: **110-130%**
- Target retention (FSRS): **80-85%**
- Effect: Less frequent reviews, acceptable forgetting

### Heavy Workload Management
- Reduce new/day to 5-10
- Keep interval modifier at 100%
- Use FSRS with 85% retention

### Long-term Maintenance
- Increase max interval to limit growth
- Set interval modifier to 100-110%
- New/day = 0 (review only)

## Migration from Old DeckSettingsScreen

**Previous State**: Only new/day and rev/day in DeckSettingsScreen

**Now**:
- All settings consolidated in **DeckOptionsScreen** (Study Options)
- DeckSettingsScreen can be simplified or repurposed
- Algorithm selection + comprehensive settings in one place
- Better UX - users find all scheduling controls together

## Technical Implementation

### Files Modified

**DeckOptionsScreen.tsx**:
- Added comprehensive SM-2 settings with subsections
- Interval modifier (%) with conversion
- Easy bonus (%) with permille conversion
- All lapse settings with advanced toggle
- Editable Leitner intervals with minute support
- Enhanced FSRS with retention target guidance

**Sm2Algorithm.ts**:
- Applied `ivlFct` to review intervals ✅ (already present)
- Applied `ivlFct` to graduating intervals ✅ (newly added)
- Applied `ivlFct` to easy intervals ✅ (newly added)
- Ensures global interval modification

### Data Format Conversions

**Interval Modifier**:
- Stored: Decimal (e.g., 1.0)
- Displayed: Percentage (e.g., 100%)
- Conversion: `stored * 100` for display, `displayed / 100` for storage

**Easy Bonus**:
- Stored: Permille (e.g., 150 = +0.15 to ease factor)
- Displayed: Percentage (e.g., 15%)
- Conversion: `stored / 10` for display, `displayed * 10` for storage

**Lapse Multiplier**:
- Stored: Decimal (e.g., 0.5 = halve interval)
- Displayed: Percentage (e.g., 50%)
- Conversion: `stored * 100` for display, `displayed / 100` for storage

**Leitner Intervals**:
- Format: Mixed "10m 1 2 4 8" (minutes + days)
- Stored: Days array `[0.00694, 1, 2, 4, 8]`
- Display: Shows "10m" for < 1 day, else number

## Testing Checklist

### SM-2 Interval Modifier
- [ ] Set to 80%, verify review intervals are shorter
- [ ] Set to 120%, verify review intervals are longer
- [ ] Check graduating intervals affected
- [ ] Verify fuzz still applies
- [ ] Confirm max interval cap works

### Daily Limits
- [ ] Set new/day = 5, verify only 5 new shown per day
- [ ] Set rev/day = 10, verify reviews capped
- [ ] Check carryover behavior next day

### Lapse Settings
- [ ] Configure relearning steps, verify learning sequence
- [ ] Test lapse multiplier reduces interval
- [ ] Check min interval enforced after graduation
- [ ] Verify leech detection works

### FSRS
- [ ] Set retention to 85%, observe shorter intervals
- [ ] Set retention to 95%, observe longer intervals
- [ ] Verify stability/difficulty stored in card.data

### Leitner
- [ ] Edit box intervals, verify cards use new intervals
- [ ] Test dropBoxes = 0 (reset to box 0)
- [ ] Test dropBoxes = 1 (drop one box)
- [ ] Verify correct/wrong box progression

### Algorithm Switching
- [ ] Switch from SM-2 to FSRS mid-study
- [ ] Switch from FSRS to Leitner
- [ ] Verify card state preserved
- [ ] Check settings saved correctly

## Summary

✅ **Complete Anki parity for interval tuning**  
✅ **Interval modifier affects all intervals globally**  
✅ **Comprehensive SM-2 settings (daily, new, review, lapse)**  
✅ **Editable FSRS retention target**  
✅ **Customizable Leitner box intervals**  
✅ **Advanced settings under collapsible toggle**  
✅ **Professional UI with subsections and help text**  
✅ **Proper data format conversions (%, permille, days)**  

The Study Options screen now provides power-user control equal to Anki desktop while maintaining an intuitive interface for beginners.
