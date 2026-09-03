#!/usr/bin/env bash
set -euo pipefail

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
version=$(node -p "require('$root/manifest.json').version")
output=${1:-"$root/dist/native-html-preview-for-github-$version.zip"}

if [[ -n $(git -C "$root" status --porcelain) ]]; then
  printf 'Refusing to package a dirty working tree.\n' >&2
  exit 1
fi

mkdir -p "$(dirname "$output")"
rm -f "$output"
git -C "$root" archive \
  --format=zip \
  --output="$output" \
  HEAD \
  manifest.json src sidepanel assets/icons
unzip -tq "$output" >/dev/null
shasum -a 256 "$output"
