#!/bin/bash
set -e

EXTENSIONS_DIR=".pi/extensions"

for dir in "$EXTENSIONS_DIR"/*/; do
  if [ -f "$dir/package.json" ]; then
    echo "Installing dependencies in $dir..."
    (cd "$dir" && npm install)
  fi
done
