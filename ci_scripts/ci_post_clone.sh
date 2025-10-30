#!/bin/sh

# Xcode Cloud Post-Clone Script
# This script runs after Xcode Cloud clones the repository
# It regenerates the iOS native folder and installs dependencies

set -e  # Exit on any error

echo "🚀 Starting Xcode Cloud post-clone setup..."

# Script runs from memorize-app/ci_scripts/
# Navigate to the app root (one level up)
cd "$(dirname "$0")/.."

# Install Node dependencies
echo "📦 Installing Node dependencies..."
npm ci || npm install

# Regenerate native iOS folder using Expo prebuild
echo "🔨 Running Expo prebuild to generate iOS folder..."
npx expo prebuild --platform ios --no-install

# Copy GoogleService-Info.plist if it exists in root
if [ -f "GoogleService-Info.plist" ]; then
  echo "📋 Copying GoogleService-Info.plist to iOS project..."
  cp GoogleService-Info.plist ios/Enqode/GoogleService-Info.plist
fi

# Navigate to iOS directory
cd ios

# Install/Update CocoaPods
echo "💎 Installing CocoaPods..."
gem install cocoapods --no-document || true

# Update CocoaPods repo
echo "🔄 Updating CocoaPods repo..."
pod repo update || true

# Install pod dependencies
echo "📲 Installing pod dependencies..."
pod install --repo-update

echo "✅ Post-clone setup complete!"
echo "📁 Workspace location: memorize-app/ios/Enqode.xcworkspace"

# List the workspace to confirm it exists
ls -la Enqode.xcworkspace/

exit 0
