#!/bin/bash
set -e

echo "📦 Installing dependencies..."
npm install

echo "🔨 Building server..."
npm run build --workspace=@makati-report/server

echo "✅ Build complete!"
