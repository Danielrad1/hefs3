#!/bin/bash

# Stop Firebase emulator and clean up all processes
# Usage: ./STOP_EMULATOR.sh

cd "$(dirname "$0")"

echo "🛑 Stopping Firebase Emulator..."

# Kill by PID file if it exists
if [ -f .emulator.pid ]; then
    PID=$(cat .emulator.pid)
    kill $PID 2>/dev/null || true
    rm .emulator.pid
fi

# Kill all Firebase emulator processes
pkill -f "firebase emulators:start" 2>/dev/null || true
pkill -f "firebase-tools" 2>/dev/null || true

# Kill processes on emulator ports
lsof -ti:5001 | xargs kill -9 2>/dev/null || true
lsof -ti:4400 | xargs kill -9 2>/dev/null || true
lsof -ti:4500 | xargs kill -9 2>/dev/null || true
lsof -ti:9299 | xargs kill -9 2>/dev/null || true
lsof -ti:9499 | xargs kill -9 2>/dev/null || true

# Wait for cleanup
sleep 1

echo "✅ Emulator stopped and ports cleaned"
