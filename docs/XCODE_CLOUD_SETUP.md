# Xcode Cloud Setup Guide

## Overview

This app uses **Expo with prebuild**, which means the native `ios/` folder is **not committed** to git (it's in `.gitignore`). Xcode Cloud needs this folder to exist, so we use a **post-clone script** to regenerate it during CI builds.

## How It Works

1. **Xcode Cloud clones the repo** → No `ios/` folder exists yet
2. **Runs `ci_post_clone.sh`** → Generates the iOS folder via `expo prebuild`
3. **Installs CocoaPods** → Creates the `.xcworkspace` file
4. **Xcode Cloud builds** → Using `memorize-app/ios/Enqode.xcworkspace`

## Xcode Cloud Configuration

### Workflow Settings

- **Project/Workspace Path**: `memorize-app/ios/Enqode.xcworkspace`
- **Scheme**: `Enqode` (must be shared)
- **Branch**: Your main/master branch
- **Post-clone Script**: Automatically runs `ci_scripts/ci_post_clone.sh`

### Required Files in Git

✅ **These files MUST be committed:**
- `/memorize-app/ci_scripts/ci_post_clone.sh` (executable)
- `/memorize-app/GoogleService-Info.plist`
- `/memorize-app/package.json` & `package-lock.json`
- `/memorize-app/app.json` (Expo config)

❌ **These files are NOT committed (auto-generated):**
- `/memorize-app/ios/` (entire folder)
- `/memorize-app/android/` (entire folder)

## Post-Clone Script (`ci_post_clone.sh`)

The script performs these steps:

1. **Navigate to app directory** (from `ci_scripts/` up to `memorize-app/`)
2. **Install npm dependencies** (`npm ci`)
3. **Run Expo prebuild** (`npx expo prebuild --platform ios`)
   - Generates the entire `ios/` folder
   - Applies all Expo plugins and config from `app.json`
4. **Copy GoogleService-Info.plist** to `ios/Enqode/`
5. **Install CocoaPods** (`pod install`)
   - Creates `Enqode.xcworkspace`
   - Links all native dependencies

## Troubleshooting

### Build fails: "Workspace not found"

**Cause**: Post-clone script didn't run or failed.

**Fix**:
1. Verify script is executable: `chmod +x memorize-app/ci_scripts/ci_post_clone.sh`
2. Check Xcode Cloud logs for script errors
3. Ensure Node.js version is compatible (18+)

### Build fails: "Pod install failed"

**Cause**: CocoaPods dependency conflict or network issue.

**Fix**:
1. Update Podfile.lock locally: `cd ios && pod install`
2. Commit updated `Podfile.lock`
3. Retry build

### Build fails: "GoogleService-Info.plist not found"

**Cause**: File not committed or path is wrong.

**Fix**:
1. Verify file exists: `ls memorize-app/GoogleService-Info.plist`
2. Ensure it's not in `.gitignore`
3. Commit and push the file

### Build fails: "Scheme not found"

**Cause**: Xcode scheme is not shared.

**Fix**:
1. Open project locally: `open memorize-app/ios/Enqode.xcworkspace`
2. In Xcode: Product → Scheme → Manage Schemes
3. Check "Shared" checkbox for `Enqode` scheme
4. Commit the scheme file: `git add memorize-app/ios/Enqode.xcodeproj/xcshareddata/`

## Environment Variables

### For Development
The app uses `ENV_CONFIG.js` to switch between local and cloud modes:
- `CURRENT_MODE = 'local'` → Uses Firebase emulator
- `CURRENT_MODE = 'cloud'` → Uses production Firebase

### For Xcode Cloud
The build currently uses whatever is committed in `ENV_CONFIG.js`. To use environment-specific configs:

1. Add environment variables in Xcode Cloud workflow settings
2. Modify `ci_post_clone.sh` to replace values:
   ```bash
   # Example: Set production mode for CI
   sed -i '' 's/CURRENT_MODE = .*/CURRENT_MODE = '\''cloud'\'';/' ENV_CONFIG.js
   ```

## Local Testing

To test the post-clone script locally:

```bash
# Navigate to app directory
cd /Users/danielrad/Desktop/repos/hefs2/memorize-app

# Remove existing ios folder
rm -rf ios

# Run the script
./ci_scripts/ci_post_clone.sh

# Verify workspace was created
ls ios/Enqode.xcworkspace/
```

## Maintenance

### Updating Native Dependencies

When you add new native dependencies (e.g., new Expo modules):

1. Update `package.json`
2. Run `npx expo prebuild --clean` locally
3. Test the build
4. Commit only `package.json`, `package-lock.json`, and `app.json`
5. The post-clone script will handle regeneration in CI

### Updating CocoaPods

When pod dependencies change:

1. Update locally: `cd memorize-app/ios && pod update`
2. Commit updated `Podfile.lock`
3. CI will use the updated lock file

## Architecture Notes

This setup follows Expo's **continuous native generation (CNG)** pattern:
- Native code is treated as a build artifact
- `app.json` is the source of truth for native configuration
- Keeps the repo clean and merge conflicts minimal
- Ensures iOS and Android configs stay in sync

## References

- [Expo Prebuild Documentation](https://docs.expo.dev/workflow/prebuild/)
- [Xcode Cloud Post-Clone Scripts](https://developer.apple.com/documentation/xcode/writing-custom-build-scripts)
- [CocoaPods Installation](https://guides.cocoapods.org/using/getting-started.html)
