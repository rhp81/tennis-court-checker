#!/bin/zsh
# launchd가 매시 정각(07~23시)에 실행: 수집 → data.json → GitHub Pages 발행
set -u
cd "${0:A:h}/.."
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin"

# 수집 시간대(07~23시) 밖이면 건너뜀 — 잠자기 후 깨어나며 밀린 실행이 새벽에 도는 경우 대비
H=$(date +%H)
if (( 10#$H < 7 )); then echo "$(date '+%F %T') skip (off-hours)"; exit 0; fi

echo "=== $(date '+%F %T') scrape ==="
node scripts/scrape.mjs || echo "scrape exited $?"

if [ -d .git ] && git remote get-url origin >/dev/null 2>&1; then
  git add docs/data.json
  if ! git diff --cached --quiet; then
    git commit -q -m "data: $(date '+%F %H:%M')" && git push -q origin HEAD 2>&1 && echo "published"
  fi
fi
