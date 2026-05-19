#!/bin/bash
# Double-click this file on Mac to open Connect Intel in your browser.
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  osascript -e 'display alert "Node.js is required" message "Install Node from https://nodejs.org then double-click this file again."'
  exit 1
fi

PORT=4173
echo "Starting Connect Intel at http://localhost:$PORT"
echo "Close this window or press Ctrl+C to stop."
echo ""

npx --yes serve . -l "$PORT" &
SERVER_PID=$!
sleep 2
open "http://localhost:$PORT"

trap "kill $SERVER_PID 2>/dev/null" EXIT
wait $SERVER_PID
