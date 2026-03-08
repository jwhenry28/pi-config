#!/usr/bin/env bash
set -euo pipefail

repo="$1"

if [[ -z "$repo" ]]; then
  echo "Usage: ./remove.sh <path-to-repo>"
  exit 1
fi

repo="$(cd "$repo" && pwd)"

# Remove .pi symlink
if [[ -L "$repo/.pi" ]]; then
  rm "$repo/.pi"
  echo "Removed symlink: $repo/.pi"
fi

# Remove .pi-config directory
if [[ -d "$repo/.pi-config" ]]; then
  rm -rf "$repo/.pi-config"
  echo "Removed directory: $repo/.pi-config"
fi

# Clean .gitignore
gitignore="$repo/.gitignore"
if [[ -f "$gitignore" ]]; then
  sed -i '' '/^# pi-config$/d;/^\.pi$/d;/^\.pi-config\/\*$/d;/^!\.pi-config\/configs$/d' "$gitignore"
  # Remove file if empty
  if [[ ! -s "$gitignore" ]]; then
    rm "$gitignore"
    echo "Removed empty $gitignore"
  else
    echo "Cleaned $gitignore"
  fi
fi
