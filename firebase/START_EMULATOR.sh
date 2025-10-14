#!/bin/bash

# Start Firebase emulator with full cleanup
# Usage: ./START_EMULATOR.sh

cd "$(dirname "$0")"

echo "🧹 Cleaning up old processes..."

# Kill any existing Firebase emulator processes
pkill -f "firebase emulators:start" 2>/dev/null || true
pkill -f "firebase-tools" 2>/dev/null || true

# Kill processes on emulator ports
lsof -ti:5001 | xargs kill -9 2>/dev/null || true
lsof -ti:4400 | xargs kill -9 2>/dev/null || true
lsof -ti:4500 | xargs kill -9 2>/dev/null || true
lsof -ti:9299 | xargs kill -9 2>/dev/null || true
lsof -ti:9499 | xargs kill -9 2>/dev/null || true

# Remove old PID file
rm -f .emulator.pid

# Wait for ports to be released
sleep 2

echo "🔨 Building functions..."
cd functions && npm run build && cd ..

echo "🔥 Starting Firebase Emulator..."
firebase emulators:start --only functions &

# Save the process ID
EMULATOR_PID=$!
echo $EMULATOR_PID > .emulator.pid

# Wait for emulator to start
sleep 3

echo ""
echo "✅ Emulator started (PID: $EMULATOR_PID)"
echo "📍 API URL: http://127.0.0.1:5001/hefs-b3e45/us-central1/api"
echo "📍 Local IP: http://10.0.0.58:5001/hefs-b3e45/us-central1/api"
echo ""
echo "To stop: ./STOP_EMULATOR.sh"
echo ""
