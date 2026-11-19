#!/bin/zsh
# launchd 등록: 매일 07:00~23:00 매시 정각 실행. 제거는  ./scripts/install-schedule.sh uninstall
set -e
LABEL=com.tennis-court-checker
PLIST=~/Library/LaunchAgents/$LABEL.plist
ROOT="${0:A:h}/.."; ROOT="${ROOT:A}"

launchctl bootout gui/$UID/$LABEL 2>/dev/null || true
if [ "${1:-}" = uninstall ]; then rm -f "$PLIST"; echo "제거됨"; exit 0; fi

{
  echo '<?xml version="1.0" encoding="UTF-8"?>'
  echo '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">'
  echo '<plist version="1.0"><dict>'
  echo "  <key>Label</key><string>$LABEL</string>"
  echo "  <key>ProgramArguments</key><array><string>/bin/zsh</string><string>$ROOT/scripts/run.sh</string></array>"
  echo "  <key>StandardOutPath</key><string>$HOME/Library/Logs/tennis-court-checker.log</string>"
  echo "  <key>StandardErrorPath</key><string>$HOME/Library/Logs/tennis-court-checker.log</string>"
  echo '  <key>StartCalendarInterval</key><array>'
  for h in {7..23}; do echo "    <dict><key>Hour</key><integer>$h</integer><key>Minute</key><integer>0</integer></dict>"; done
  echo '  </array>'
  echo '</dict></plist>'
} > "$PLIST"

launchctl bootstrap gui/$UID "$PLIST"
echo "등록 완료: $PLIST (07~23시 매시 정각, 로그: ~/Library/Logs/tennis-court-checker.log)"
