#!/bin/bash
set -e

# Navigate to the project root
cd /opt/render/project

# Ensure we're in the right place
if [ ! -f "package.json" ]; then
  echo "Error: package.json not found in /opt/render/project"
  exit 1
fi

# Check if the dist directory exists
if [ ! -f "packages/server/dist/index.js" ]; then
  echo "Error: packages/server/dist/index.js not found"
  echo "Current directory: $(pwd)"
  echo "Contents of /opt/render/project:"
  ls -la /opt/render/project || true
  echo "Contents of packages/server:"
  ls -la /opt/render/project/packages/server || true
  exit 1
fi

# Run the server
node packages/server/dist/index.js
