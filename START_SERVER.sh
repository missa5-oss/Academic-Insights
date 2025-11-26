#!/bin/bash

echo "Starting Academic-Insights Backend Server..."
echo "============================================"
echo ""

cd "$(dirname "$0")/server"

echo "Checking environment..."
if [ ! -f .env ]; then
    echo "❌ ERROR: server/.env file not found!"
    echo "Please create it with your Neon DATABASE_URL"
    exit 1
fi

echo "✓ Environment file found"
echo ""

echo "Starting server..."
node index.js
