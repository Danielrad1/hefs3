#!/bin/bash
# Post-prebuild script: Copy GoogleService-Info.plist to iOS project
# This runs automatically after expo prebuild

echo "📋 Copying GoogleService-Info.plist to iOS project..."

if [ -f "GoogleService-Info.plist" ]; then
  cp GoogleService-Info.plist ios/enqode/GoogleService-Info.plist
  echo "✅ GoogleService-Info.plist copied successfully"
else
  echo "⚠️  GoogleService-Info.plist not found in project root"
  echo "   Download it from Firebase Console and place it in the project root"
fi
