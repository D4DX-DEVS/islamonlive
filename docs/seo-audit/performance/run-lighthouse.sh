#!/usr/bin/env bash
set -uo pipefail
OUT="D:/Projects/islamonlive/frontend/docs/seo-audit/performance"
CHROME="C:/Users/moham/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe"
LOG="$OUT/lh-progress.log"
: > "$LOG"

names="home culture-mosque malayalam-article category-news search-quran"
get_url() {
  case "$1" in
    home) echo "http://localhost:3686/" ;;
    culture-mosque) echo "http://localhost:3686/culture/the-great-mosque-of-damascus/" ;;
    malayalam-article) echo "http://localhost:3686/shariah/allah-knows-what-is-truly-within-your-heart/" ;;
    category-news) echo "http://localhost:3686/category/news/" ;;
    search-quran) echo "http://localhost:3686/search/?q=quran" ;;
  esac
}

for name in $names; do
  url=$(get_url "$name")
  for run in 1 2; do
    f="$OUT/${name}-desktop-run${run}.json"
    t0=$(date +%s)
    npx --yes lighthouse@latest "$url" --preset=desktop --output=json --output-path="$f" --chrome-flags="--headless=new" --chrome-path="$CHROME" --quiet > "$OUT/${name}-desktop-run${run}.log" 2>&1 || true
    t1=$(date +%s)
    sz=$(stat -c%s "$f" 2>/dev/null || echo 0)
    echo "$(date -Iseconds) desktop $name run$run size=$sz dur=$((t1-t0))s" >> "$LOG"
  done
  for run in 1 2; do
    f="$OUT/${name}-mobile-run${run}.json"
    t0=$(date +%s)
    npx --yes lighthouse@latest "$url" --form-factor=mobile --screenEmulation.mobile --output=json --output-path="$f" --chrome-flags="--headless=new" --chrome-path="$CHROME" --quiet > "$OUT/${name}-mobile-run${run}.log" 2>&1 || true
    t1=$(date +%s)
    sz=$(stat -c%s "$f" 2>/dev/null || echo 0)
    echo "$(date -Iseconds) mobile $name run$run size=$sz dur=$((t1-t0))s" >> "$LOG"
  done
done
echo "ALL_DONE" >> "$LOG"
