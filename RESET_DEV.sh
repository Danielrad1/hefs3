#!/bin/bash

echo ""
echo "🔄 RESETTING DEVELOPMENT ENVIRONMENT"
echo "===================================="
echo ""

# Clear all caches
echo "🧹 Clearing caches..."
rm -rf node_modules/.cache 2>/dev/null || true
rm -rf .expo 2>/dev/null || true
rm -rf ios/build 2>/dev/null || true

echo "✅ Caches cleared"
echo ""
echo "📋 NEXT STEPS:"
echo ""
echo "1. STOP Expo if running (Ctrl+C)"
echo ""
echo "2. START Expo:"
echo "   npx expo start --clear"
echo ""
echo "3. COMPLETELY CLOSE the app in iOS Simulator:"
echo "   - Press Cmd+Shift+H (go to home screen)"
echo "   - Swipe up from bottom"
echo "   - Swipe the app up to close it"
echo ""
echo "4. REOPEN the app from the home screen"
echo ""
echo "✅ You should see one of these:"
echo "   🔧 LOCAL EMULATOR MODE"
echo "   ☁️  PRODUCTION CLOUD MODE"
echo ""
echo "💡 To switch modes, edit ENV_CONFIG.js and change CURRENT_MODE"
echo ""
