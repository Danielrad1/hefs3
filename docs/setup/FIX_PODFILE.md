# Fix Podfile for iOS 17.0

## The Problem
The `ios/Podfile` has a hardcoded platform version that doesn't match your `app.json` setting of 17.0.

## Manual Fix

1. **Open the Podfile in Xcode or any text editor:**
   ```bash
   open ios/Podfile
   ```

2. **Find this line near the top:**
   ```ruby
   platform :ios, '13.4'
   ```
   or
   ```ruby
   platform :ios, min_ios_version_supported
   ```

3. **Change it to:**
   ```ruby
   platform :ios, '17.0'
   ```

4. **Save the file**

5. **Run pod install:**
   ```bash
   cd ios && pod install
   ```

6. **Then build:**
   ```bash
   cd .. && npx expo run:ios --device
   ```

## Alternative: Quick Command
Run this to see what's in your Podfile:
```bash
head -20 ios/Podfile
```

Look for the `platform :ios` line and note what version it says.

## Why This Happens
- Expo prebuild generates the Podfile from templates
- Sometimes the platform version doesn't sync properly with `app.json`
- The `react-native-zip-archive` pod checks the platform version and rejects if it's too low
- Manual editing of the Podfile fixes this

## After Fixing
The app will build with bundle ID `com.enqode.app` and show as "enqode" on your device!
