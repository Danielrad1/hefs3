# Testing Guide: Premium Statistics Features

## Quick Verification Steps

### Home Screen Tests

#### 1. BestHoursCard (Premium)
**Prerequisites**: Need 50+ total reviews with data across different hours

**Test Steps**:
1. Navigate to Home screen
2. Scroll down past EfficiencyCard
3. **Expected**: Should see "Best Study Hours" card with:
   - 24-hour grid (00-23)
   - Colored cells based on retention
   - Top Hours section showing 2-3 best times
   - Info message about scheduling

**Edge Cases**:
- [ ] Less than 50 reviews → Component should not appear
- [ ] No hours with 20+ reviews → Component should not appear
- [ ] All reviews in same hour → Should show single highlighted hour

---

#### 2. AddsTimelineMini (Free)
**Prerequisites**: Need cards added within last 30 days

**Test Steps**:
1. Navigate to Home screen
2. Scroll to middle section
3. **Expected**: Should see "Learning Velocity" card with:
   - Sparkline chart showing 30-day history
   - Total and Avg/Day stats
   - Trend indicator (↗️ increasing, ↘️ decreasing, — steady)
   - Contextual message

**Edge Cases**:
- [ ] No cards added → Component should not appear
- [ ] All adds on same day → Should show spike on that day
- [ ] Increasing velocity → Green trend arrow

---

#### 3. BacklogClearByCard (Premium)
**Prerequisites**: Need overdue cards (backlog > 0) AND review history

**Test Steps**:
1. Navigate to Home screen
2. Scroll to Insights section
3. **Expected**: Should see "Backlog Clear-By" card with:
   - Large number of days to clear
   - Target date
   - Best/Worst case range
   - Stats grid (Overdue, Daily Avg)
   - Motivational message

**Edge Cases**:
- [ ] No backlog → Shows "All caught up!" version
- [ ] No review history → Component should not appear
- [ ] Large backlog (100+ days) → Should show realistic projection

---

### Deck Stats Screen Tests

#### 4. AnswerButtonsDistribution (Premium)
**Prerequisites**: Deck with review history

**Test Steps**:
1. Navigate to any deck → View Statistics
2. Select 7 days or 30 days window
3. Scroll to Card Distribution section
4. **Expected**: Should see "Answer Distribution" card with:
   - Rows for each state (New, Learn, Young, Mature)
   - Stacked horizontal bars
   - Tap any row → Expands to show detailed breakdown
   - Each button (Again/Hard/Good/Easy) with percentage and count

**Edge Cases**:
- [ ] No review history → Component should not appear
- [ ] Only one state has data → Shows single row
- [ ] Tap to expand → Details appear smoothly
- [ ] Tap again → Collapses back

---

#### 5. LeechesList (Premium)
**Prerequisites**: Deck with cards having 8+ lapses

**Test Steps**:
1. Navigate to deck with difficult cards → View Statistics
2. Scroll below Survival Curves
3. **Expected**: Should see "Leeches" card with:
   - Ranked list of top 10 problem cards
   - Each showing: question text, lapses, ease, reviews
   - Color-coded severity (red for 15+, orange for 10+)
   - Scrollable if more than 3-4 cards

**Edge Cases**:
- [ ] No leeches → Shows "No problem cards" success state
- [ ] Less than 10 leeches → Shows all available
- [ ] Long question text → Truncates properly
- [ ] Ease factor displays as percentage (250% format)

---

#### 6. ForecastChart (Premium)
**Prerequisites**: Deck with cards and review history

**Test Steps**:
1. Navigate to any deck → View Statistics
2. Toggle between 7 days and 30 days
3. Scroll to bottom (after Leeches)
4. **Expected**: Should see "Workload Forecast" card with:
   - Stacked bars for each day
   - New (pink), Learn (purple), Review (blue) segments
   - Avg Daily and Total stats
   - Horizontal scroll for 30-day view
   - "Estimated" disclaimer

**Edge Cases**:
- [ ] Toggle 7→30 days → Chart expands to 30 bars
- [ ] Toggle 30→7 days → Chart contracts to 7 bars
- [ ] No upcoming cards → Shows minimal bars
- [ ] Large forecast → Scales bars proportionally

---

## Data Scenarios

### Scenario 1: New User (Minimal Data)
**Setup**: Fresh install with sample cards

**Expected Visibility**:
- ❌ BestHoursCard (need 50+ reviews)
- ✅ AddsTimelineMini (sample cards counted as adds)
- ❌ BacklogClearByCard (no backlog yet)
- ✅ AnswerButtonsDistribution (will show after first study session)
- ❌ LeechesList (no leeches yet)
- ✅ ForecastChart (shows future due cards)

---

### Scenario 2: Active User (Medium Data)
**Setup**: 200+ reviews over 2 weeks, some overdue

**Expected Visibility**:
- ✅ BestHoursCard (sufficient data)
- ✅ AddsTimelineMini (shows adding pattern)
- ✅ BacklogClearByCard (projects clearance)
- ✅ AnswerButtonsDistribution (rich data)
- ⚠️ LeechesList (may or may not have leeches)
- ✅ ForecastChart (accurate projections)

---

### Scenario 3: Power User (Rich Data)
**Setup**: 1000+ reviews, multiple decks, some leeches

**Expected Visibility**:
- ✅ All components visible
- BestHours shows clear peak times
- BacklogClearBy shows realistic timeline
- Leeches identified across decks
- Forecast shows workload patterns

---

## Performance Checks

### Load Times
- [ ] Home screen stats calculate in < 500ms
- [ ] Deck Stats screen loads in < 1s
- [ ] Window toggle (7↔30 days) updates in < 300ms
- [ ] Component scroll is smooth (60fps)

### Memory Usage
- [ ] No memory leaks when navigating between screens
- [ ] Large datasets (1000+ cards) don't freeze UI
- [ ] Inline calculations don't block render

---

## Visual Regression Checks

### Theme Compatibility
- [ ] Dark mode: All components readable
- [ ] Light mode: All components readable
- [ ] Color scheme changes apply correctly
- [ ] Premium badges visible in all themes

### Layout Tests
- [ ] iPhone SE (small): Components don't overflow
- [ ] iPhone 15 Pro Max (large): No awkward spacing
- [ ] iPad: Components scale appropriately
- [ ] Landscape: Cards maintain readability

### Typography
- [ ] All text uses design system fonts
- [ ] Number formatting consistent (1,234 vs 1234)
- [ ] Percentages always show % symbol
- [ ] Dates formatted consistently

---

## Integration Tests

### Navigation Flow
1. [ ] Home → Deck Detail → Deck Stats (all components visible)
2. [ ] Pull-to-refresh on Home updates BestHours/BacklogClearBy
3. [ ] Study session → Return to Home (stats update correctly)
4. [ ] Delete all cards → Components hide appropriately

### Data Consistency
- [ ] BestHours data matches actual review times
- [ ] BacklogClearBy projection is reasonable
- [ ] Forecast totals match actual due cards
- [ ] Leeches list matches cards with high lapses
- [ ] AddsTimeline matches card creation dates

---

## Accessibility Checks

- [ ] All components have readable contrast ratios
- [ ] Tap targets are 44×44pt minimum
- [ ] Info messages provide context
- [ ] Premium badges are clear but not obtrusive

---

## Bug Scenarios

### Common Edge Cases to Test

1. **Zero State**
   - [ ] No reviews → Components hide
   - [ ] No backlog → BacklogClearBy shows success state
   - [ ] No leeches → LeechesList shows success state

2. **Extreme Values**
   - [ ] 1000+ day backlog → Displays correctly
   - [ ] 100+ lapses on card → UI doesn't break
   - [ ] 1000+ cards in deck → Performance OK

3. **Data Quality**
   - [ ] Corrupted revlog entries → Gracefully skipped
   - [ ] Missing card references → Handled safely
   - [ ] Invalid timestamps → Filtered out

---

## Automated Test Recommendations

### Unit Tests (Recommended)
```typescript
// BestHoursCard.test.tsx
describe('BestHoursCard', () => {
  it('renders 24-hour grid', () => {});
  it('shows top 3 hours', () => {});
  it('hides cells without data', () => {});
});

// BacklogClearByCard.test.tsx
describe('BacklogClearByCard', () => {
  it('calculates days correctly', () => {});
  it('shows sensitivity range', () => {});
  it('handles zero backlog', () => {});
});
```

### Integration Tests (Recommended)
```typescript
// HomeScreen.test.tsx
describe('HomeScreen Premium Stats', () => {
  it('shows BestHours when criteria met', () => {});
  it('hides components without data', () => {});
  it('updates on pull-to-refresh', () => {});
});

// DeckStatsScreen.test.tsx
describe('DeckStats Premium Features', () => {
  it('respects window toggle', () => {});
  it('calculates distributions correctly', () => {});
});
```

---

## Sign-off Checklist

Before marking as complete:

- [ ] All 6 components render without errors
- [ ] Conditional logic works correctly
- [ ] No console errors or warnings
- [ ] Performance is acceptable on all devices
- [ ] TypeScript has no errors
- [ ] Design system guidelines followed
- [ ] Documentation is complete
- [ ] Premium gating is clear

---

**Status**: Ready for testing  
**Last Updated**: 2025-10-15  
**Tester**: _____________  
**Date Tested**: _____________  
**Issues Found**: _____________
