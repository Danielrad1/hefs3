# Onboarding & UX Fixes Needed

## ✅ COMPLETED
1. **StudyGoalScreen Layout** - Fixed title/subtitle visibility by removing flex: 1 from optionsContainer

## 🔧 TO FIX

### 1. **Profile Screen Skipping** (Test Issue)
- **Status:** Likely hot reload state persistence
- **Fix:** User should fully restart app after `npx expo start --clear`
- **Flow should be:** Tutorial → Profile → Study Goal → Theme → Notifications

### 2. **Theme Selection Consistency**
- **Issue:** Onboarding theme screen doesn't match Settings theme screen
- **Fix Needed:**
  - Check SettingsScreen theme picker UI
  - Update ThemeSelectionScreen to match same style
  - Ensure both use same components/styling

### 3. **Home Screen Dynamic Greeting**
- **Issue:** Greeting should change based on time of day
- **Fix Needed:**
  - Add time-based greeting function
  - "Good Morning" (5 AM - 12 PM)
  - "Good Afternoon" (12 PM - 5 PM)
  - "Good Evening" (5 PM - 9 PM)
  - "Good Night" (9 PM - 5 AM)

### 4. **Home Screen Personalization**
- **Issue:** Should show user's name from profile
- **Fix Needed:**
  - Load user profile from AsyncStorage
  - Display: "Good Morning, [Name]"
  - Fallback to "Good Morning" if no name

### 5. **Settings - Edit Profile/Preferences**
- **Issue:** Users should be able to change onboarding info
- **Fix Needed:**
  - Add Profile settings section (edit name)
  - Add Study Goal preference
  - Theme picker already exists
  - Notifications toggle

---

## Implementation Plan

### Step 1: Home Screen Greeting ✅
File: `src/app/Home/HomeScreen.tsx`

Add:
```typescript
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Good Morning';
  if (hour >= 12 && hour < 17) return 'Good Afternoon';
  if (hour >= 17 && hour < 21) return 'Good Evening';
  return 'Good Night';
};
```

### Step 2: Load User Profile
```typescript
const [userName, setUserName] = useState<string | null>(null);

useEffect(() => {
  const loadProfile = async () => {
    if (user?.uid) {
      const profile = await UserPrefsService.getUserProfile(user.uid);
      setUserName(profile?.firstName || null);
    }
  };
  loadProfile();
}, [user]);
```

### Step 3: Display Personalized Greeting
```typescript
<Text style={styles.greeting}>
  {userName ? `${getGreeting()}, ${userName}` : getGreeting()}
</Text>
```

### Step 4: Settings Screen Updates
Add sections:
- **Profile** - Edit name
- **Study Preferences** - Daily goal
- **Appearance** - Theme (already exists)
- **Notifications** - Daily reminder toggle

---

## Priority Order

1. ✅ **Fix StudyGoalScreen layout** - DONE
2. **Home screen greeting + name** - HIGH PRIORITY
3. **Settings screen enhancements** - HIGH PRIORITY
4. **Theme consistency** - MEDIUM PRIORITY
5. **Test full flow** - After fixes

---

## Files to Modify

1. `src/app/Home/HomeScreen.tsx` - Add greeting + name
2. `src/app/Settings/SettingsScreen.tsx` - Add profile/preferences editing
3. `src/app/Onboarding/ThemeSelectionScreen.tsx` - Match Settings style (if needed)
