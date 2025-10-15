# Design Token Usage Matrix

**Brand**: Purple 500 (#8B5CF6) - Single unified voice  
**Last Updated**: 2025-10-15

---

## Token → Component Mapping

### 🎨 Brand Tokens

| Token | Usage | Do | Don't |
|-------|-------|-----|-------|
| `primary` | Hero CTAs, active states, key actions | Use for "Start Now", active toggles | Don't use alongside other saturated colors |
| `primaryGradient` | Hero cards, premium features | Apply to main CTA backgrounds | Don't use on multiple cards per screen |
| `primaryHover` | Hover/pressed states | Button interactions | Don't use as default state |
| `onPrimary` | Text/icons over brand | White text on purple backgrounds | Don't use on neutral surfaces |
| `secondary` | AI/hints ONLY | Fuchsia for AI-powered features | Don't use as second primary |

### 🎭 Surface Tokens

| Token | Usage | Components |
|-------|-------|------------|
| `bg` | App background | SafeAreaView, root containers |
| `surface1` | Page containers | ScrollView contentContainer |
| `surface2` | **Cards** (primary) | Stats cards, deck cards, settings cards |
| `surface3` | Nested cards | Cards within cards, elevated modals |
| `border` | Dividers, outlines | Horizontal rules, toggle borders |

### 📝 Text Tokens

| Token | Usage | Font Size | Weight |
|-------|-------|-----------|--------|
| `textHigh` | Headings, key values | 16-32px | 800 |
| `textMed` | Labels, secondary info | 11-14px | 600-700 |
| `textLow` | Helper text, captions | 11-13px | 500-600 |

### 🎯 Status Tokens

| Token | Usage | When to Use |
|-------|-------|-------------|
| `success` | Retention %, completed states | Positive metrics, achievements |
| `warning` | Streaks, learning phase | Attention-needed, learning cards |
| `danger` | Errors, lapsed cards | Failed reviews, critical alerts |
| `info` | Helper tips, neutral info | Info cards, documentation |

### 🌈 Overlay Tokens (12% alpha tints)

| Token | Usage | Example |
|-------|-------|---------|
| `overlay.primary` | Purple chips, brand badges | Streak badges, premium features |
| `overlay.success` | Success chips, retention cards | "All caught up", retention backgrounds |
| `overlay.warning` | Warning chips, due cards | Streak fire badge, due soon alerts |
| `overlay.danger` | Error chips, lapsed cards | Failed review badges |
| `overlay.info` | Info chips, help cards | Info card backgrounds |

**Rule**: NEVER use `color + '15'` or `color + '10'` strings. Always use `overlay.*`

### 📊 Data Viz Tokens

| Token | Concept | Usage |
|-------|---------|-------|
| `dataViz.new` | New cards | Fuchsia (#EC4899) - unused/fresh content |
| `dataViz.young` | Young/learning | Purple (#8B5CF6) - brand-aligned learning |
| `dataViz.mature` | Mature/mastered | Emerald (#10B981) - success/completion |
| `dataViz.time` | Time metrics | Amber (#F59E0B) - complementary to purple |
| `dataViz.reviews` | Review counts | Cyan (#06B6D4) - neutral data metric |

---

## Component-Specific Rules

### HomeScreen Hero CTA

```
Background: primaryGradient
Icon: onPrimary
Text: onPrimary
Shadow: Subtle (opacity 0.06)
```

**Do**: Single focal gradient card at top  
**Don't**: Mix multiple gradient cards or competing hues

### Stats Cards

```
Background: surface2
Title: textHigh (16-18px, weight 800)
Values: textHigh (28-32px, weight 800)
Labels: textMed (11px, weight 700, uppercase)
```

**Hierarchy**: 1 focal value per card; use size + weight, not color

### Toggles (Time Windows, Filters)

```
Active:
  Background: primary
  Text: onPrimary (weight 700)

Inactive:
  Background: transparent
  Text: textMed (weight 600)
  Border: border
```

### Chips & Badges

```
Background: overlay.{status}
Text: {status} color (weight 700)
Icon: {status} color
```

**Example**: Streak badge = `overlay.warning` bg + `warning` text/icon

### Deck Distribution Bar

```
New: dataViz.new
Young: dataViz.young
Mature: dataViz.mature
Suspended/Issues: danger or textMed
```

**Max 3 primary segments**; issues secondary

### Charts (SurvivalCurves, TrendMiniChart)

```
Series:
  - Primary line: dataViz.young (purple)
  - Secondary line: dataViz.mature (emerald)

Grid:
  - Lines: border at 40% alpha
  - Labels: textLow (11px, weight 600)

Dots/markers: Match series color, 6-8px
```

**Max 2-3 series per chart**

### Calendar/Streak Heatmap

```
Empty: border (neutral)
Low activity: overlay.primary (12% alpha)
Medium activity: primary at 50% opacity
High activity: primary (full saturation)
```

**Single-hue heat ramp** (no mixed colors)

---

## Typography Scale

| Role | Size | Weight | Usage |
|------|------|--------|-------|
| Display values | 28-32px | 800 | Hero stats, focal metrics |
| Card titles | 16-18px | 800 | Section headers |
| Body text | 14-15px | 600 | Secondary info, descriptions |
| Labels (uppercase) | 11px | 700 | Stat labels, tags |
| Captions | 11-13px | 500-600 | Helper text |

**Reduce 900 weights** → Use 800 max; let color/spacing create hierarchy

---

## Implementation Checklist

### Phase 1: Token Consolidation ✅
- [x] Define all tokens in `theme.tsx`
- [x] Add overlay.* tokens (12% alpha)
- [x] Add dataViz.* tokens
- [x] Set primary to Purple 500

### Phase 2: Component Migration 🚧
- [x] HomeScreen hero → primaryGradient + onPrimary
- [x] DeckStatsScreen toggles → primary + onPrimary
- [x] DeckCountsBar → dataViz.* tokens
- [x] Info cards → overlay.info
- [ ] StreakCalendar → Single-hue heat ramp
- [ ] TrendMiniChart → dataViz tokens + consistent grid
- [ ] SurvivalCurves → dataViz tokens + consistent grid
- [ ] All remaining `+ '15'` strings → overlay.*

### Phase 3: Lint Enforcement
- [ ] Add ESLint rule: block raw hex in `src/app/**` and `src/components/**`
- [ ] Exception: `src/design/theme.tsx` only
- [ ] CI check: fail on non-token colors

### Phase 4: Typography Pass
- [ ] Replace all `fontWeight: '900'` with `'800'`
- [ ] Ensure 1 focal metric per card (largest size)
- [ ] Uppercase labels: 11px, weight 700, letterSpacing 0.5

---

## Success Metrics

### Visual Consistency
- **0 raw hex** in UI components (verified by lint)
- **≤ 6 hues** visible across app (purple, fuchsia, emerald, amber, cyan, red)
- **1 brand voice**: Purple dominates; fuchsia only on AI features

### Accessibility
- **WCAG AA**: Body text ≥ 4.5:1 contrast
- **WCAG AA**: Large text (18px+) ≥ 3:1 contrast
- **Test**: Run contrast checker on all text/bg pairs

### Behavioral (Analytics)
- **CTA tap-through**: Measure Home "Start Now" clicks (target: +15% lift)
- **Time-to-first-action**: Measure time from app open to first review
- **10-second glance test**: 5 users answer 3 questions about stats without scrolling

---

## Design Principles

1. **One primary hue**: Purple leads; other colors support
2. **Consistent overlays**: Always 12% alpha for tints
3. **Data viz stability**: Fixed token per concept (no ad hoc choices)
4. **Hierarchy through scale**: Use size + weight, not color overload
5. **Whitespace**: Let content breathe; reduce shadows, increase padding
6. **Token-only**: Never raw hex in UI code

---

## Quick Reference

**Most Common Patterns:**

```typescript
// Hero CTA
<LinearGradient colors={theme.colors.primaryGradient}>
  <Ionicons color={theme.colors.onPrimary} />
  <Text style={{ color: theme.colors.onPrimary }}>Start Now</Text>
</LinearGradient>

// Stats Card
<View style={{ backgroundColor: theme.colors.surface2 }}>
  <Text style={{ color: theme.colors.textHigh, fontSize: 18, fontWeight: '800' }}>
    Retention
  </Text>
  <Text style={{ color: theme.colors.textHigh, fontSize: 32, fontWeight: '800' }}>
    89%
  </Text>
  <Text style={{ color: theme.colors.textMed, fontSize: 11, fontWeight: '700' }}>
    7-DAY AVERAGE
  </Text>
</View>

// Chip/Badge
<View style={{ backgroundColor: theme.colors.overlay.success }}>
  <Ionicons color={theme.colors.success} />
  <Text style={{ color: theme.colors.success, fontWeight: '700' }}>All Caught Up</Text>
</View>

// Distribution Bar
segments.map(seg => (
  <View style={{ backgroundColor: theme.colors.dataViz[seg.type] }} />
))
```

---

**Questions?** Refer to this matrix before implementing. All UI decisions should trace back to these tokens and rules.
