#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/static"
DST="$ROOT/hosting/public"

rm -rf "$DST"
mkdir -p "$DST/static"
cp -R "$SRC/"* "$DST/static/"
cp "$SRC/index.html" "$DST/index.html"
echo "Hosting public ready: $DST"
