#!/bin/bash
set -e

echo "📦 Installing dependencies for monorepo..."
npm ci --prefer-offline

echo "🔨 Building server..."
npm run build --workspace=@makati-report/server

echo "✅ Build complete!"
