#!/bin/bash
set -e

# Try to find the correct dist location
echo "Checking possible dist locations..."
echo "PWD: $(pwd)"
echo ""

# List what's actually in the project
echo "=== Contents of /opt/render/project ==="
ls -la /opt/render/project/ || echo "Cannot access /opt/render/project"
echo ""

# Check if there's a src subdirectory (Render might have added it)
if [ -d "/opt/render/project/src" ]; then
  echo "=== Found /src subdirectory ==="
  ls -la /opt/render/project/src/
  echo ""
fi

# Determine the actual project root
PROJECT_ROOT="/opt/render/project"
if [ ! -f "$PROJECT_ROOT/package.json" ]; then
  # Maybe Render put us in src/
  if [ -f "/opt/render/project/src/package.json" ]; then
    PROJECT_ROOT="/opt/render/project/src"
  fi
fi

echo "Using PROJECT_ROOT: $PROJECT_ROOT"
echo ""

# Find and run the dist/index.js
if [ -f "$PROJECT_ROOT/packages/server/dist/index.js" ]; then
  echo "Found dist at $PROJECT_ROOT/packages/server/dist/index.js"
  cd "$PROJECT_ROOT"
  node packages/server/dist/index.js
elif [ -f "$PROJECT_ROOT/dist/index.js" ]; then
  echo "Found dist at $PROJECT_ROOT/dist/index.js"
  cd "$PROJECT_ROOT"
  node dist/index.js
else
  echo "ERROR: Cannot find dist/index.js"
  echo ""
  echo "=== Full directory tree ==="
  find /opt/render/project -name "index.js" -type f 2>/dev/null || echo "No index.js files found"
  exit 1
fi
