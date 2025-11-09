#!/bin/bash
set -e

# Render puts everything in /opt/render/project/src/
# So the actual paths are:
# /opt/render/project/src/packages/server/dist/index.js

cd /opt/render/project/src

# Verify we're in the right place
if [ ! -f "packages/server/dist/index.js" ]; then
  echo "ERROR: Cannot find packages/server/dist/index.js"
  echo "Current directory: $(pwd)"
  echo "Directory contents:"
  ls -la
  exit 1
fi

# Run the server from here
node packages/server/dist/index.js
