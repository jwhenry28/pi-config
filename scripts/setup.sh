#!/usr/bin/env bash
set -euo pipefail

repo="$1"

if [[ -z "$repo" ]]; then
  echo "Usage: ./setup.sh <path-to-repo>"
  exit 1
fi

# Resolve paths
repo="$(cd "$repo" && pwd)"
pi_config_dir="$(cd "$(dirname "$0")/.." && pwd)"

# Create .pi symlink
ln -sfn "$pi_config_dir" "$repo/.pi"
echo "Created symlink: $repo/.pi -> $pi_config_dir"

# Update .gitignore
gitignore="$repo/.gitignore"
touch "$gitignore"

entries=(
  "# pi-config"
  ".pi"
  ".pi-config/*"
)

for entry in "${entries[@]}"; do
  if ! grep -qxF "$entry" "$gitignore"; then
    echo "$entry" >> "$gitignore"
  fi
done

echo "Updated $gitignore"
