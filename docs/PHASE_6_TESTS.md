# Phase 6 Premium Analytics - Test Suite

**Date**: 2025-02-18  
**Status**: ✅ **COMPLETE**

---

## 📋 Test Coverage Summary

### Test Files Created (3)

1. **StatsService Unit Tests**
   - File: `src/services/anki/__tests__/StatsService.test.ts`
   - Lines: ~320 new test cases
   - Coverage: All Phase 6 methods

2. **HomeScreen Component Tests**
   - File: `src/app/Home/__tests__/HomeScreen.premium.test.tsx`
   - Lines: ~380
   - Coverage: Premium Insights section, guards, performance

3. **DeckStatsScreen Component Tests**
   - File: `src/app/Decks/__tests__/DeckStatsScreen.premium.test.tsx`
   - Lines: ~440
   - Coverage: Answer distribution, window toggle, leeches, forecast, survival curves

---

## 🧪 StatsService Tests (Unit)

### Phase 6 Methods Tested

#### `getBestHours`
- ✅ Filters hours with < minReviews (default 20)
- ✅ Sorts by retention × ln(reviews)
- ✅ Returns empty array when no hours meet threshold
- ✅ Handles DST boundaries (timezone-aware)

#### `getForecast`
- ✅ Returns correct number of days (7 vs 30)
- ✅ Respects new card daily limit from collection config
- ✅ Shows learning carry-over in first week
- ✅ Calculates estMinutesP50 correctly

#### `getLeeches`
- ✅ Includes only cards with lapses >= threshold (default 8)
- ✅ Sorts by lapses descending
- ✅ Respects limit parameter
- ✅ Trims question text to first field

#### `getAddsTimeline`
- ✅ Returns 30 entries sorted by date
- ✅ Counts cards with numeric nid (epoch ms)
- ✅ Falls back to mod for non-numeric nid
- ✅ Omits future-dated nid
- ✅ Handles zero-activity days

#### `getRecentDailyAverage`
- ✅ Averages over N days including zero days
- ✅ Spreads spike day across window
- ✅ Calculates minutes per day correctly

#### Time Boundaries
- ✅ Respects 4:00 AM rollover boundary
- ✅ Reviews at 03:59 → "yesterday"
- ✅ Reviews at 04:00 → "today"

### Test Conventions
```typescript
beforeAll(() => {
  process.env.TZ = 'America/Los_Angeles';
  fixedNow = new Date('2025-02-18T15:30:00-08:00').getTime();
  jest.useFakeTimers();
  jest.setSystemTime(fixedNow);
});
```

---

## 🏠 HomeScreen Tests (Component)

### Premium Insights Visibility Guards

#### BestHoursCard
- ✅ Shows when `totalReviewsAllTime > 50` and data exists
- ✅ Hides when `totalReviewsAllTime ≤ 50`
- ✅ Hides when no hour has >= minReviews

#### AddsTimelineMini
- ✅ Shows when `addsTimeline.reduce((sum, p) => sum + p.count, 0) > 0`
- ✅ Hides when sum == 0

#### BacklogClearByCard
- ✅ Shows when `backlogCount > 0` AND `avgReviewsPerDay > 0`
- ✅ Hides when backlog == 0
- ✅ Hides when avgReviewsPerDay == 0

### Collapsible Section Behavior
- ✅ Collapsed by default
- ✅ Expands when header pressed
- ✅ Toggles between expanded/collapsed
- ✅ Shows Premium star badge

### Performance
- ✅ Single StatsService instance via `useRef`
- ✅ No multiple instantiations on re-render
- ✅ Calculations cached in state
- ✅ Refresh recomputes all stats

### Layout
- ✅ Core cards render in correct order:
  - Today Row
  - Efficiency
  - Streak Calendar
  - Backlog Pressure
  - Premium Insights (collapsible)
  - Weekly Coach Report

---

## 📊 DeckStatsScreen Tests (Component)

### Answer Distribution Classification (CRITICAL)

#### Correct Mapping
- ✅ Learn = `type === 0` (Learn) OR `type === 2` (Relearn)
- ✅ Young = `type === 1` (Review) AND `lastIvl < 21`
- ✅ Mature = `type === 1` (Review) AND `lastIvl >= 21`
- ✅ Filtered (`type === 3`) → **IGNORED**
- ✅ **NO "New" state** in UI

#### Edge Cases
- ✅ Boundary test: lastIvl=20 → Young, lastIvl=21 → Mature
- ✅ Subtitle shows "By state (Learn, Young, Mature)"
- ✅ Type 0 and Type 2 both map to Learn bucket

### Window Toggle (7 vs 30 days)
- ✅ Defaults to 7 days
- ✅ Toggles to 30 days
- ✅ Updates all dependent cards:
  - Retention grid
  - Answer distribution
  - Forecast bars
  - Survival curves

### LeechesList (NO Nested Scroll)
- ✅ Renders without nested `ScrollView`
- ✅ Uses `<View>` for list (parent handles scroll)
- ✅ Shows "No problem cards" when lapses < 8
- ✅ Sorts by lapses descending
- ✅ Color codes: red (≥15), orange (≥10)
- ✅ Displays rank (#1, #2, etc.)

### ForecastChart
- ✅ Bar count matches window days (7 or 30)
- ✅ Colored segments by card type (new/learn/review)
- ✅ Shows legend
- ✅ Date labels formatted correctly
- ✅ Handles zero totals (min 4px bar height)

### SurvivalCurves
- ✅ Shows header with "Estimated (heuristic model)"
- ✅ Displays half-life definition: "Days until 50% retention"
- ✅ Renders young and mature curves when data exists
- ✅ Shows half-life values > 0

### DeckHealthCard
- ✅ Displays difficulty index
- ✅ Shows retention percentage
- ✅ Shows reviews per minute (RPM)
- ✅ Shows seconds per review
- ✅ Estimates time to complete

### Edge Cases
- ✅ Empty deck shows gracefully (no crash)
- ✅ AddsTimeline with many zero days renders without gaps
- ✅ Forecast with zero cards shows structure (no labels)

---

## 🚀 Running Tests

### All Tests
```bash
npm test
```

### Single File
```bash
# StatsService
npx jest src/services/anki/__tests__/StatsService.test.ts

# HomeScreen
npx jest src/app/Home/__tests__/HomeScreen.premium.test.tsx

# DeckStatsScreen
npx jest src/app/Decks/__tests__/DeckStatsScreen.premium.test.tsx
```

### Watch Mode
```bash
npm test -- --watch
```

### Coverage
```bash
npm test -- --coverage
```

### Specific Test
```bash
npx jest -t "should show ONLY Learn, Young, Mature"
```

---

## 📁 Test File Structure

```
memorize-app/
├── src/
│   ├── services/
│   │   └── anki/
│   │       └── __tests__/
│   │           ├── StatsService.test.ts (+320 lines Phase 6)
│   │           └── helpers/
│   │               └── factories.ts (existing)
│   └── app/
│       ├── Home/
│       │   └── __tests__/
│       │       └── HomeScreen.premium.test.tsx (NEW)
│       └── Decks/
│           └── __tests__/
│               └── DeckStatsScreen.premium.test.tsx (NEW)
```

---

## ✅ Test Checklist

### StatsService
- [x] getBestHours filters and sorts correctly
- [x] getForecast respects limits and shows learning
- [x] getLeeches includes threshold, sorts, limits
- [x] getAddsTimeline handles nid/mod fallback
- [x] getRecentDailyAverage includes zero days
- [x] Time boundaries respect 4AM rollover

### HomeScreen
- [x] BestHours shows when totalReviews > 50
- [x] AddsTimeline shows when sum > 0
- [x] BacklogClearBy shows when backlog > 0 AND avg > 0
- [x] Premium Insights collapsed by default
- [x] Premium Insights expands on press
- [x] Single StatsService instance (no re-instantiation)
- [x] Refresh recomputes stats

### DeckStatsScreen
- [x] Answer distribution shows Learn/Young/Mature ONLY
- [x] Type 0/2 → Learn, Type 1 splits on lastIvl=21
- [x] Type 3 (Filtered) ignored
- [x] Window toggle updates all cards
- [x] LeechesList uses View (no nested scroll)
- [x] Leeches sorted by lapses desc
- [x] ForecastChart bar count matches window
- [x] SurvivalCurves shows half-life definition
- [x] Edge cases handled (empty, zeros)

---

## 🎯 Key Testing Patterns

### Fixture Setup
```typescript
const today = new Date(fixedNow).setHours(0, 0, 0, 0);

// Create specific revlog types
db.addRevlog({
  id: String(today + i * 1000),
  cid: `card${i}`,
  ease: RevlogEase.Good,
  type: 0, // Learn
  lastIvl: 0,
  // ...
});
```

### Guard Testing
```typescript
// Test visibility condition
await waitFor(() => {
  expect(queryByText('BestHours')).toBeTruthy();
});

// Test hidden condition
await waitFor(() => {
  expect(queryByText('BestHours')).toBeNull();
});
```

### State Mapping Testing
```typescript
// Verify exact classification
const distributions = [
  { state: 'Learn', type: [0, 2] },
  { state: 'Young', type: 1, condition: 'lastIvl < 21' },
  { state: 'Mature', type: 1, condition: 'lastIvl >= 21' },
];
```

---

## 📊 Test Metrics

**Total Tests**: ~35 test cases  
**Total Lines**: ~1,140 (new test code)  
**Coverage Target**: 80%+ on Phase 6 methods  
**Test Suites**: 3  
**Mocked Dependencies**: Navigation, Scheduler, Timers  

---

## 🐛 Known Test Limitations

1. **Visual/Theme Checks**: No pixel-perfect visual regression tests (manual review needed)
2. **Performance Benchmarks**: Micro-benchmarks commented out (run manually, not in CI)
3. **E2E**: These are unit/component tests; full E2E flow requires separate suite
4. **Accessibility**: No explicit `testID` checks yet (add as needed)

---

## 🔄 Continuous Integration

Add to CI pipeline:
```yaml
- name: Run Phase 6 Tests
  run: |
    npm test -- --testPathPattern="(StatsService|HomeScreen.premium|DeckStatsScreen.premium)"
```

---

## 📝 Maintenance

### Adding New Phase 6 Features
1. Add test case to appropriate file
2. Use existing fixtures from `factories.ts`
3. Follow timezone/rollover patterns
4. Test both happy path and guards

### Updating Tests After Code Changes
1. If StatsService API changes, update unit tests first
2. If UI changes, update component snapshots
3. If guards change, update visibility tests

---

## ✅ Sign-Off

**All Tests**: ✅ Written  
**All Guards**: ✅ Covered  
**All Classifications**: ✅ Verified  
**Performance**: ✅ Single instance pattern tested  
**Edge Cases**: ✅ Handled  

**Ready for**: CI integration, manual QA, production deployment

---

**Created**: 2025-02-18  
**Author**: Cascade AI  
**Status**: Complete
