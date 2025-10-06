# Tinder-Style Card Transitions: Solving Flicker & Smoothness

## Problem Overview

The goal was to implement seamless Tinder-style card transitions where:
1. The next card is visible behind the current card during swipes
2. Cards scale up smoothly as they transition to the foreground
3. No flickering or image disappearing/reappearing
4. Buttery smooth reveal animations

## Root Causes Identified

### 1. **React Reconciliation Issue** 
**Problem**: Cards were unmounting and remounting when transitioning from `next` to `current`.

**Why it happened**: Cards were rendered in different wrapper components with conditional rendering:
```tsx
// BROKEN - Different parent containers
{next && (
  <Animated.View>
    <CardPage key={next.id} />  // Position in tree changes
  </Animated.View>
)}

<View>
  <CardPage key={current.id} />
</View>
```

When `next` became `current`, React saw different parent components and **unmounted/remounted** the CardPage, causing images to reload.

**Solution**: Render all cards in a **single flat array**:
```tsx
// FIXED - Stable tree position
{cards.map(({ card }) => (
  <Animated.View key={card.id}>
    <CardPage card={card} />
  </Animated.View>
))}
```

### 2. **Image Flickering**
**Problem**: Images disappeared and reappeared during card transitions.

**Why it happened**: Multiple causes:
- `RenderHtml` receiving new object references every render
- CardContentRenderer re-rendering unnecessarily
- Prop changes triggering component updates

**Solutions**:
```tsx
// Memoize object props to prevent re-renders
const htmlSource = React.useMemo(() => ({ html: contentHtml }), [contentHtml]);
const defaultTextProps = React.useMemo(() => ({ selectable: false }), []);

// Aggressive image caching
defaultImageProps: {
  fadeDuration: 0,           // No fade animation
  cache: 'force-cache',      // Force browser-style cache
  recyclingKey: cardId,      // Keep images in memory per card
}

// Stable keys on CardContentRenderer
<CardContentRenderer key={`front-${card.id}`} ... />
<CardContentRenderer key={`back-${card.id}`} ... />
```

### 3. **Shadow Animation Jank**
**Problem**: Animated shadows caused performance issues and flicker.

**Why it happened**: Shadow properties are NOT GPU-accelerated, causing layout recalculations.

**Solution**: Use **static shadows** only:
```tsx
// REMOVED: Animated shadow
shadowProgress.value = withTiming(1, { duration: 1000 });

// FIXED: Static shadow
style={[..., sh.card]}  // No animation
```

### 4. **Gesture Handler Conflicts**
**Problem**: Cards got stuck after 3 swipes, gestures stopped working.

**Why it happened**: 
- Background card's gesture handler was still active
- When `disabled` prop changed, memo prevented re-render so gesture stayed disabled

**Solutions**:
```tsx
// Disable gestures on background cards
const panGesture = Gesture.Pan()
  .enabled(!disabled)  // Explicit disable

// Re-render when disabled changes (gestures need update)
const shouldSkip = cardIdSame && disabledSame;
```

### 5. **Choppy Reveal Animation**
**Problem**: First flip was choppy, subsequent flips were smooth.

**Why it happened**: Back content wasn't rendered until first flip, causing layout work during animation.

**Solutions**:
```tsx
// Always render both sides (no conditional mounting)
<Animated.View style={[frontOpacity, ...]}>
  <CardContentRenderer key={`front-${card.id}`} ... />
</Animated.View>

<Animated.View style={[backOpacity, ...]}>
  <CardContentRenderer key={`back-${card.id}`} ... />
</Animated.View>

// Smooth easing curve
easing: Easing.out(Easing.cubic)  // Natural deceleration

// Simple crossfade
[0, 0.5, 1] → [1, 0, 0]  // Front fades out
[0, 0.5, 1] → [0, 0, 1]  // Back fades in
```

## Key Tinder Principles Applied

### 1. **Stable Component Identity**
- Use stable keys based on content ID, not position
- Render all cards in the same array/container
- React recognizes components across renders and keeps them mounted

### 2. **Transform-Only Animations**
- Only use `translate`, `scale`, `rotate` (GPU-accelerated)
- Avoid animating shadows, layout properties
- Use opacity for show/hide

### 3. **Pre-rendered Content**
- All cards exist in DOM simultaneously
- Layout work happens on mount, not during animation
- Images preloaded and cached before transition

### 4. **Memoization Strategy**
```tsx
// CardPage: Only re-render if card ID or disabled changes
const shouldSkip = cardIdSame && disabledSame;

// CardContentRenderer: Only re-render if cardId or revealed changes  
const shouldSkip = cardIdSame && revealedSame;
```

## Final Architecture

### StudyScreen (Card Stack Management)
```tsx
// Flat array with stable keys
const cards = React.useMemo(() => {
  const cardList = [];
  if (next) cardList.push({ card: next, zIndex: 1, isCurrent: false });
  if (current) cardList.push({ card: current, zIndex: 10, isCurrent: true });
  return cardList;
}, [next, current, nextCardStyle]);

// Single render loop
{cards.map(({ card, zIndex, isCurrent, style }) => (
  <Animated.View key={card.id} style={[..., { zIndex }, style]}>
    <CardPage 
      card={card}
      disabled={!isCurrent}
      onAnswer={handleAnswer}
      onSwipeChange={handleSwipeChange}
      onReveal={handleReveal}
    />
  </Animated.View>
))}
```

### CardPage (Reveal Animation)
```tsx
// Both sides always rendered
const frontOpacity = useAnimatedStyle(() => ({
  opacity: interpolate(revealProgress.value, [0, 0.5, 1], [1, 0, 0])
}));

const backOpacity = useAnimatedStyle(() => ({
  opacity: interpolate(revealProgress.value, [0, 0.5, 1], [0, 0, 1])
}));

// Smooth easing
revealProgress.value = withTiming(1, {
  duration: 350,
  easing: Easing.out(Easing.cubic),
});
```

### CardContentRenderer (Image Stability)
```tsx
// Memoized props prevent unnecessary re-renders
const htmlSource = React.useMemo(() => ({ html: contentHtml }), [contentHtml]);

// Aggressive memo comparison
const shouldSkip = prevProps.cardId === nextProps.cardId && 
                   prevProps.revealed === nextProps.revealed;

// Image caching
defaultImageProps: {
  fadeDuration: 0,
  cache: 'force-cache',
  recyclingKey: cardId,
}
```

## Performance Optimizations

1. **GPU Acceleration**: All animations use transform/opacity
2. **Memo Strategy**: Prevent unnecessary re-renders at every level
3. **Static Rendering**: Remove dynamic z-index, shadow animations
4. **Stable References**: Memoize all object props
5. **Pre-rendering**: Both card sides always exist in DOM

## Testing Checklist

- [x] No flicker when cards transition
- [x] Images stay stable (no disappear/reappear)
- [x] Can swipe through unlimited cards
- [x] First reveal is smooth (no choppiness)
- [x] Subsequent reveals are smooth
- [x] Background card scales up during swipe
- [x] No gestures active on background cards
- [x] 60fps animations throughout

## Result

✅ Seamless Tinder-style card stack with:
- Zero flickering
- Stable images throughout transitions
- Buttery smooth 60fps animations
- No re-render performance issues
- Premium feel and polish
