#!/bin/bash
# Rebuild iOS app with proper configuration
# Run this script whenever you need to rebuild from scratch

set -e  # Exit on error

echo "🧹 Cleaning and rebuilding iOS app..."

# 1. Clean prebuild
echo "Step 1/4: Running expo prebuild --clean..."
npx expo prebuild --clean

# 2. Install pods
echo "Step 2/4: Installing CocoaPods..."
cd ios && pod install && cd ..

# 3. Add use_modular_headers if needed (for Firebase)
if ! grep -q "use_modular_headers!" ios/Podfile; then
  echo "Step 3/4: Adding use_modular_headers! to Podfile..."
  sed -i '' '23 a\
  use_modular_headers!
' ios/Podfile
  cd ios && pod install && cd ..
else
  echo "Step 3/4: use_modular_headers! already present, skipping..."
fi

# 4. Build and run
echo "Step 4/4: Building and deploying to device..."
npx expo run:ios --device

echo "✅ Done! App should be running on your device."
