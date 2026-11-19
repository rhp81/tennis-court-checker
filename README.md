# 테니스 빈자리 알리미

맥북에서 노원(마들·불암산)·중랑 예약 사이트의 빈자리를 수집해 `docs/data.json`으로 발행하고,
아이폰 홈화면 웹앱(`docs/index.html`, GitHub Pages)이 그 표를 읽어 보여줍니다.

| 명령 | 설명 |
|---|---|
| `npm run login` | 노원+중랑 직접 로그인 → 세션 쿠키 저장 (`auth/`, git 제외) |
| `npm run login -- jungnang` | 중랑만 재로그인 (노원 세션 유지) |
| `npm run scrape` | 1회 수집 → `docs/data.json` (`DEBUG=1`로 상세 로그) |
| `./scripts/run.sh` | 수집 + git push (launchd가 07~23시 매시 정각 실행) |
| `./scripts/install-schedule.sh` / `uninstall` | launchd 등록 / 제거 (로그: `run.log`) |
| `node scripts/screenshot.mjs` | 웹앱을 아이폰 크기로 렌더링해 `preview.png` |

## 자동 재로그인 (키체인)
노원 세션은 1시간도 안 돼 끊기므로, 끊기면 키체인에 저장된 본인 계정으로 자동 재로그인합니다.
저장: `node scripts/save-credential.mjs nowon` (중랑은 `jungnang`) → macOS 입력창에 아이디/비밀번호 입력 → 로그인 키체인 `tennis-court-checker.<site>`에 저장.
로그인 실패 시 `auth/<site>.loginfail`을 만들고 재시도하지 않습니다(노원은 5회 오류 시 잠김). `npm run login`으로 직접 로그인하면 해제됩니다.
로그인이 필요하면 맥 알림센터에 알림이 뜨고, 웹앱에도 표시됩니다.
