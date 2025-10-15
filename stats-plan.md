# Stats Plan - Memorize App

## Goals

- Ship Anki-parity stats first, then add premium differentiators that are genuinely actionable
- Keep compute on-device and fast via daily aggregates; only simulate/forecast when needed
- Leverage existing repos: `RevlogRepository.ts`, `CardRepository.ts`, `DeckRepository.ts`, `StatsService.ts`

---

## Placement & Pricing

### Home (Free)

- **Today's load**: due now, learning, new limits; p50 time estimate
- **Retention snapshot (7/30-day)**: young vs mature retention% and again rate
- **Reviews/time**: reviews today, minutes today, rolling 7/30 trend line
- **Backlog pressure**: total overdue, median days overdue, overdueness index
- **Streak**: current streak days and best streak
- **Adds over time**: cards added today/this week/this month

### Home (Premium)

- **Future due forecast**: stacked new/learn/review next 7/30 days
- **Best hours**: accuracy and speed by hour and day-of-week
- **Burnout risk meter**: projected backlog vs capacity, clear-by date
- **Ease drift trend**: 30-day average ease with drift direction
- **What-if simulator**: change limits/steps and preview due/retention/time
- **Calendar heatmap**: reviews and minutes over the last 12 months

### Deck (Free)

- **Deck size and states**: new/young/mature; suspended/buried; leeches count
- **Deck load**: due now by type; p50 deck time estimate for today
- **Deck retention (7/30-day)**: again%, retention% (young vs mature)
- **Throughput**: reviews/min, avg seconds/review (by state)
- **Difficulty index**: composite of again rate, lapses/100, average ease

### Deck (Premium)

- **Forecast for this deck**: next 7/30 days (new/learn/review)
- **Interval/ease profile**: median interval, interval histogram, ease drift
- **Tag/model split**: worst tags and note models by again rate and time
- **Leeches radar and fragile items**: repeated lapses, low ease cards
- **Hint analytics**: hint adoption%, avg depth, "success after hint", time delta
- **Survival curves and half-life estimates** for the deck

### Hints (Differentiator)

**Free:**
- Hint adoption% (global)
- Hints shown today
- Avg hint depth

**Premium:**
- Hint effectiveness
- Weak concepts (by tag/field)
- "Too-strong hints" flag
- Cost/benefit (time saved)

---

## Anki-Parity Coverage (Build All)

- Review counts/time
- Answer button distribution by state
- Due forecast
- Interval histogram
- Added over time
- Card state counts
- Lapses
- Leeches

---

## Core Formulas & Definitions

| Metric | Formula |
|--------|---------|
| **Retention%** | `(Good + Easy) / (Again + Hard + Good + Easy)` over window |
| **Again rate** | `Again / Total` |
| **Young vs Mature** | Mature if `card.intervalDays >= 21` (configurable) |
| **Reviews/min** | `Total reviews / (Total seconds / 60)` |
| **Avg seconds/review** | `Total seconds / Total reviews` |
| **Overdueness index** | `sum_over_overdue_cards(min(daysOverdue, cap))` normalized |
| **Difficulty index (0–100)** | z-score weighted: again rate (0.5), lapses/100 (0.3), 1−avgEaseNorm (0.2) |
| **Streak** | Consecutive days with any reviews (use local time midnight boundary) |
| **Best hours** | Group by hour local; compute retention and avg time/review |
| **Session** | Break after ≥10m idle; compute sessions/day, avg length, fatigue (end vs start) |
| **Half-life** | Approximate from interval × ease trajectory; refine with survival fit later |
| **Forecast** | Simulate due counts using current intervals, learning steps, and new limits |

---

## Data & API Shapes

### Types (Stats layer)

```typescript
interface GlobalSnapshot {
  date: string;
  todayDue: number;
  todayLearn: number;
  todayNewLimit: number;
  estTimeP50Sec: number;
  reviewsToday: number;
  minutesToday: number;
  retention7: number;
  retention30: number;
  again7: number;
  again30: number;
  backlogCount: number;
  backlogMedianDays: number;
  overduenessIndex: number;
  streak: number;
  bestStreak: number;
  addsToday: number;
  addsWeek: number;
  addsMonth: number;
}

interface DeckSnapshot {
  deckId: number;
  deckName: string;
  counts: {
    new: number;
    young: number;
    mature: number;
    suspended: number;
    buried: number;
    leeches: number;
  };
  today: {
    due: number;
    learn: number;
    estTimeP50Sec: number;
  };
  retention: {
    young7: number;
    mature7: number;
    young30: number;
    mature30: number;
  };
  throughput: {
    rpm: number;
    secPerReview: number;
  };
  difficultyIndex: number;
  avgEase: number;
  lapsesPer100: number;
}

interface ForecastPoint {
  date: string;
  newCount: number;
  learnCount: number;
  reviewCount: number;
  estMinutesP50: number;
}

interface HintStats {
  adoptionPct: number;
  avgDepth: number;
  successAfterHintPct: number;
  secDeltaAfterHint: number;
  weakTags: Array<{
    tag: string;
    againRate: number;
    hintUsePct: number;
  }>;
}
```

### Service Contracts (add to `StatsService.ts`)

```typescript
getGlobalSnapshot({ windowDays: 7 | 30 }): Promise<GlobalSnapshot>
getDeckSnapshot(deckId: number, opts?: { windowDays: 7 | 30 }): Promise<DeckSnapshot>
getForecast(opts: { days: 7 | 30; deckId?: number }): Promise<ForecastPoint[]>
getBestHours(opts?: { days?: number; deckId?: number }): Promise<Array<{ hour: number; retentionPct: number; secPerReview: number }>>
getHintStats(opts?: { deckId?: number; days?: number }): Promise<HintStats>
```

### Data Sources

- **Reviews/time**: `RevlogRepository.ts`
- **Card states/ease/intervals/lapses**: `CardRepository.ts`
- **Deck hierarchy/limits**: `DeckRepository.ts`, `DeckService.ts`
- **Hints**: instrument via `CardHintsService.ts` and persist to `StatsRepository.ts` or a new local table

---

## Instrumentation (Hints)

### Add lightweight local events to track:

1. **hint_revealed**: `{ cardId, deckId, depth, ts }`
2. **review_answered**: already in revlog (outcome, time); extend join using timestamp proximity or add `hintUsed`/`hintDepth` in a side table keyed by `revlogId` or `(cardId, tsBucket)`

### Where to hook:

- `MultiLevelHintDisplay.tsx`: on reveal
- `CardPage.tsx`: before/after answer, compute pairings for effectiveness

### Persist: `StatsRepository.ts` new tables (local SQLite):

```sql
hint_events(id, cardId, deckId, depth, ts)
hint_review_links(id, revlogId, hintDepth, used)
```

---

## UI Components

### Home

**Free:**
- `StatsCardToday`: due/new/learn + time estimate
- `RetentionCard`: young/mature 7/30
- `TrendMiniChart`: reviews/minutes 7/30

**Premium:**
- `ForecastChart`
- `BestHoursChart`
- `CalendarHeatmap`
- `BurnoutMeter`

### Deck

**Free:**
- `DeckHealthCard`: difficulty, retention, throughput, est time
- `DeckCountsBar`: new/young/mature/suspended/buried/leeches

**Premium:**
- `DeckForecastChart`
- `IntervalHistogram`
- `EaseTrend`
- `TagModelSplit`
- `HintEffectiveness`

### Tie-ins:

- **Home**: `memorize-app/src/app/Home/HomeScreen.tsx`
- **Deck list/summary**: `memorize-app/src/app/Decks/DecksScreen.tsx`, `DeckCard.tsx`
- **Deck detail**: `memorize-app/src/app/Decks/DeckDetailScreen.tsx`

---

## Performance & Caching

### Daily aggregates job on app start and after study session:

- Build and cache yesterday/today 7/30-day aggregates in `StatsRepository.ts`
- Store last build timestamp; invalidate when revlog changes

### Forecast computed on demand and memoized by `(deckId, days)`

### Use constant-time selectors per card/deck by precomputing:

- `deckId -> counts`
- `deckId -> lapses, avgEase`
- `deckId -> dueToday`

---

## Step-by-Step Rollout (What to Build First)

### Phase 0 — Foundation (1–2 days)

**Goal:** Set up data layer and instrumentation

1. Add Stats contracts in `StatsService.ts`
2. Implement revlog queries in `RevlogRepository.ts` to fetch by date range and by deck
3. Implement card state selectors in `CardRepository.ts` (counts, mature/young, lapses, ease)
4. Implement daily aggregator in `StatsService.ts` with a local cache in `StatsRepository.ts`
5. Instrument hint events in `MultiLevelHintDisplay.tsx` and `CardPage.tsx`; create `hint_events` table in `StatsRepository.ts`

**Files to modify:**
- `src/services/anki/StatsService.ts`
- `src/services/anki/db/RevlogRepository.ts`
- `src/services/anki/db/CardRepository.ts`
- `src/services/anki/db/StatsRepository.ts` (new)
- `src/app/Study/CardPage.tsx`
- `src/components/hints/MultiLevelHintDisplay.tsx`

---

### Phase 1 — MVP (Home Free + Deck Free) (3–5 days)

**Goal:** Ship core free stats to Home and Deck screens

#### Home

1. `StatsCardToday`: due/new/learn + p50 time (`StatsService.getGlobalSnapshot`)
2. `RetentionCard`: young/mature 7-day; show 30-day in details
3. `TrendMiniChart`: reviews/minutes 7-day sparkline
4. Streak + backlog pressure indicator

**Files:**
- `src/app/Home/HomeScreen.tsx`
- `src/components/stats/StatsCardToday.tsx` (new)
- `src/components/stats/RetentionCard.tsx` (new)
- `src/components/stats/TrendMiniChart.tsx` (new)

#### Deck

1. Update `DeckCard.tsx` with badge: due today, est time, difficulty index color
2. `DeckDetailScreen.tsx`: `DeckHealthCard`, `DeckCountsBar`, Retention/Throughput rows

**Files:**
- `src/app/Decks/DeckCard.tsx`
- `src/app/Decks/DeckDetailScreen.tsx`
- `src/components/stats/DeckHealthCard.tsx` (new)
- `src/components/stats/DeckCountsBar.tsx` (new)

#### Tests

- Extend `StatsService.test.ts`
- Add snapshot tests for selectors

---

### Phase 2 — Anki Parity Charts (2–4 days)

**Goal:** Match Anki's built-in stats

1. Future due forecast (7/30 days) global and per deck
2. Interval histogram and "added over time"
3. Answer button distribution by state (New/Learn/Young/Mature)

**Files:**
- `src/services/anki/StatsService.ts` (forecast + histograms)
- `src/components/stats/ForecastChart.tsx` (new)
- `src/components/stats/IntervalHistogram.tsx` (new)
- `src/components/stats/AnswerButtonDistribution.tsx` (new)
- `src/components/stats/AddedOverTime.tsx` (new)

---

### Phase 3 — Premium Tier v1 (4–7 days)

**Goal:** Launch premium stats with paywall

1. Best hours (hour/day matrices)
2. Calendar heatmap
3. Burnout risk meter and clear-by date extrapolation
4. Ease drift trend
5. Deck difficulty index refinement (z-scores)
6. Paywall flag in app config and UI gating: premium badge on cards; upsell modal

**Files:**
- `src/app/Home/HomeScreen.tsx`
- `src/app/Decks/DeckDetailScreen.tsx`
- `src/components/stats/BestHoursChart.tsx` (new)
- `src/components/stats/CalendarHeatmap.tsx` (new)
- `src/components/stats/BurnoutMeter.tsx` (new)
- `src/components/stats/EaseDriftTrend.tsx` (new)
- `src/contexts/PremiumContext.tsx` (new)
- `src/components/premium/PremiumUpsellModal.tsx` (new)
- `src/app/Settings/SettingsScreen.tsx` (premium toggle)

---

### Phase 4 — Hint Intelligence (Premium) (4–6 days)

**Goal:** Differentiate with unique hint analytics

1. Hint adoption% and avg depth (global + deck)
2. Hint effectiveness (success after hint vs without), time delta
3. Weak concepts by tag/model
4. "Too-strong hints" detector (sudden easy-after-hint spikes)

**Files:**
- `src/services/anki/CardHintsService.ts` (ensure events)
- `src/services/anki/StatsService.ts` (joins)
- `src/components/stats/HintAdoptionCard.tsx` (new)
- `src/components/stats/HintEffectivenessCard.tsx` (new)
- `src/components/stats/WeakConceptsCard.tsx` (new)

---

### Phase 5 — Simulator & Survival (Premium) (1–2 weeks)

**Goal:** Advanced modeling and planning tools

1. What-if simulator for new limits/steps; quick preview chart
2. Half-life and survival curves (Kaplan-Meier approximation by deck)
3. Weekly "coach" report generation (plain text with links to problem tags/decks)

**Files:**
- `src/services/anki/StatsService.ts` (simulator, survival)
- `src/components/stats/WhatIfSimulator.tsx` (new)
- `src/components/stats/SurvivalCurves.tsx` (new)
- `src/components/stats/WeeklyCoachReport.tsx` (new)

---

## Concrete Implementation Tasks

### Stats service and selectors

**`memorize-app/src/services/anki/StatsService.ts`**
- Add methods: `getGlobalSnapshot`, `getDeckSnapshot`, `getForecast`, `getBestHours`, `getHintStats`
- Add `buildDailyAggregates({date})` and cache layer

**`memorize-app/src/services/anki/db/RevlogRepository.ts`**
- Add query helpers: by date range, by deckId, group by hour/day

**`memorize-app/src/services/anki/db/CardRepository.ts`**
- Add `getCountsByDeck(deckId)`, `getLapsesByDeck(deckId)`, `getAvgEaseByDeck(deckId)`, `getDueTodayByDeck(deckId)`

**`memorize-app/src/services/anki/db/StatsRepository.ts`**
- Add tables for daily aggregates and hint events (local)

### UI scaffolding

- Add `src/components/stats/StatsCardToday.tsx`, `RetentionCard.tsx`, `TrendMiniChart.tsx`, `DeckHealthCard.tsx`, `DeckCountsBar.tsx`
- Wire to `memorize-app/src/app/Home/HomeScreen.tsx` and `DeckDetailScreen.tsx`

### Premium gating

- Add `isPremium` to user state in `AuthContext.tsx` or a small `PremiumContext`
- Wrap premium components in a gate with upsell

---

## Forecast Approach (Practical)

### Input:
- Cards with current intervals, due dates, learning steps, daily new limit

### For each future day:

1. Carry forward cards due that day from intervals
2. Add expected learn card load (based on learning steps and wrong answers average)
3. Add new cards capped by limit; push their learning step load into the next days
4. Compute p50 time using rolling median sec/review over 7 days

### Keep it fast:
- Aggregate counts by interval bucket
- Avoid per-card simulation

---

## Difficulty Index (Deck)

### Compute z-scores over:

1. **Again rate** (higher is worse)
2. **Lapses per 100 reviews** (higher is worse)
3. **1 − normalized avg ease** (lower ease is worse)

### Weighted sum → 0–100

**Color codes:**
- 0–30: easy (green)
- 31–60: moderate (yellow)
- 61–100: hard (red)

---

## Monetization Lines

### Free:
- Core learning health (today's load, retention snapshot, streak, deck basics)

### Premium:
- Forecasts
- Modeling
- Best hours
- Simulations
- Heatmaps
- Hint intelligence
- Weekly coach

**Rationale:** Premium features either save time (forecast/plan) or improve outcomes (best hours/hint tuning), providing a clear value proposition.

---

## Edge Cases & Safeguards

- **New users**: show sample projections with low confidence; suppress difficulty index until N≥50 reviews
- **Heavy decks**: cap histograms at top 99th percentile; bin long intervals
- **Time zone shifts**: compute streak and best hours in user's local TZ; store timestamps UTC with offset handling
- **Offline**: all stats computed locally; optional cloud backup via `CloudBackupService.ts`

---

## Testing

### Unit:
- `StatsService.test.ts` for each metric window
- Synthetic revlog fixtures in `__tests__/helpers/factories.ts`

### Integration:
- Drive study sessions in `study-flow.integration.test.ts` to update aggregates
- Verify snapshots

### Performance:
- Benchmark `getForecast(30)` under 100k cards
- Enforce <100ms on common devices

---

## Detailed Stats Breakdown

### Anki Stats (Cover All)

1. **Review counts/time**: daily reviews and minutes, rolling 7/30/365
2. **Answer buttons**: Again/Hard/Good/Easy distribution by New/Learn/Young/Mature
3. **Intervals histogram**: next interval distribution for cards answered today
4. **Future due forecast**: due counts for 7/30/365 days by type (new/learn/review)
5. **Added over time**: cards added histogram; today/this week/this month
6. **Card counts**: New/Young/Mature; suspended/buried; lapses; leeches

### Home Page (Global)

**Free:**
- Today's load: due now + learning steps + new limit; time estimate (p50/p90)
- Retention snapshot: young/mature again rate and retention% (rolling 7/30)
- Efficiency: reviews/min, correct/min, avg seconds per review, time-to-first-answer
- Backlog pressure: total overdue, median days overdue, "overdueness index"
- Trend lines: 7-day review count trend, average ease drift, streak length

**Premium:**
- Forecast: projected daily due next 7 & 30 days, "clear-by" date at current pace
- Best hours: accuracy and speed by hour-of-day and day-of-week
- Calendar heatmap for reviews/time; streak badges
- Burnout risk: projected backlog growth vs capacity ("risk meter")
- What-if simulator: change limits/steps and preview due/retention/time outcomes

### Deck-Specific

**Free:**
- Deck difficulty index: composite of again rate, average ease, lapses per 100
- Deck load curve: due now + 7/30 days with new/learn/review stack
- Retention by state: young vs mature retention, recent again streaks, leeches
- Time and throughput: minutes/day, reviews/min, avg seconds per state
- Stability/interval profile: median interval, interval histogram, ease drift

**Premium:**
- Model/tag split: performance by note type and top tags (again rate, time)
- Forecast for this deck: next 7/30 days (new/learn/review)
- Interval/ease profile: median interval, interval histogram, ease drift
- Leeches radar and fragile items: repeated lapses, low ease cards
- Hint analytics: hint adoption%, avg depth, "success after hint", time delta
- Survival curves and half-life estimates for the deck

### Habits & Session Quality

**Free:**
- Consistency: rolling adherence (days studied), average daily minutes, variance
- Session shape: session count/day, avg session length, break ratio

**Premium:**
- Best hours: accuracy and speed by hour-of-day and day-of-week
- Focus signals: "ramp-up" lag (first 10 cards vs rest), end-of-session fatigue

### Retention & Memory Modeling (Premium)

- Half-life estimates: per deck and global using answer sequences; median/deciles
- Survival curves: probability of recall over 1/7/30/90 days after review
- Optimal new card rate: recommendation that balances backlog and time budget
- Burnout risk: projected backlog growth vs capacity ("risk meter")
- What-if simulator: change limits/steps and preview due/retention/time outcomes

### AI Hints & Learning Aids (Unique Data)

**Free:**
- Hint adoption: % of cards with hint viewed; average hint depth used

**Premium:**
- Hint effectiveness: success rate after hint vs without; time delta
- Cost/benefit: time spent using hints vs review time saved next 7 days
- Weak concepts: tags/fields with high hint reliance and low retention
- Progressive hint tuning: identify "too strong" hints (easy-after-hint spikes)

### Quality & Maintenance

**Free:**
- Leeches radar: cards flagged as leech, clustering by tag/field/template
- Fragile items: cards with repeated lapses or low ease; auto-throttle suggestions

**Premium:**
- Template/model health: models with outlier again rates or slow review times
- Media checks: missing/broken media count by deck; impact on performance

### Forecasting & Planning (Premium)

- Daily plan: recommended deck order, target new count, time budget to clear due
- SLA-style goals: "keep backlog under X" with progress and breach predictions
- Deck mixing score: interleaving ratio and correlation with retention
- Completion ETA: "when will this deck stabilize?" under current pace

### Team/Pro Differentiators (Charge-Worthy)

- Coach insights: plain-language, actionable weekly report (adds, drops, fixes, goals)
- Adaptive throttle: auto-tune new/learn steps based on fatigue and again spikes
- Personalized best-hours: notify when entering your high-retention window
- Deep tag analytics: concept heatmap with drill-down to problematic fields/cards
- Benchmarking: anonymized percentile bands for users with similar volume (opt-in)
- Cross-device continuity: session quality and drop-off patterns by device

### Visualizations That Sell

- Calendar heatmap for reviews/time; streak badges
- Stacked area forecasts (new/learn/review) for 7/30/365 days
- Interval and ease drift histograms with trend lines
- Hour-of-day radial chart highlighting best time windows
- Deck "health score" cards with color coding and quick actions

---

## Implementation Notes

### Core sources:
- `revlog` for outcomes/time
- `cards` for state/ease/interval
- `notes/tags` for concept splits

### KPIs to compute daily:
- Retention (1 - again%)
- Reviews/min
- Overdueness
- Backlog
- Ease drift

### Deck health index:
- Weighted z-scores of again rate, lapses/100, avg ease, overdue ratio

### Forecast:
- Simulate due using current intervals and new limits
- Compute p50 time from historical seconds/review

### Hint analytics:
- Instrument hint reveal depth and next-answer outcomes
- Store aggregate per day/deck/tag

---

## Summary

This plan delivers a best-in-class stats experience that:

1. **Matches Anki** on core metrics (Phase 0–2)
2. **Exceeds Anki** with forecasting, best hours, and burnout detection (Phase 3)
3. **Differentiates uniquely** with hint intelligence and adaptive coaching (Phase 4–5)
4. **Monetizes clearly** by gating time-saving and outcome-improving features

The phased rollout ensures you ship value early (Phase 1 MVP in ~1 week) while building toward premium features that justify subscription pricing.
