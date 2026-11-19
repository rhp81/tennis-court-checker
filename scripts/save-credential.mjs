// macOS 입력창으로 아이디/비밀번호를 받아 로그인 키체인에 저장 (자동 재로그인용)
// 사용법: node scripts/save-credential.mjs nowon   (또는 jungnang)
// 입력값은 화면·로그에 출력하지 않습니다.
import { execFileSync } from 'node:child_process';
import { SITES } from './autologin.mjs';

const site = process.argv[2];
if (!SITES[site]) { console.error('사용법: node scripts/save-credential.mjs nowon|jungnang'); process.exit(1); }
const label = { nowon: '노원 체육시설', jungnang: '중랑 시설대관' }[site];
const service = `tennis-court-checker.${site}`;

function ask(prompt, hidden) {
  const script = `display dialog "${prompt}" default answer "" ${hidden ? 'with hidden answer ' : ''}with title "테니스 빈자리 — ${label}" buttons {"취소", "확인"} default button "확인" cancel button "취소"
text returned of result`;
  try { return execFileSync('osascript', ['-e', script], { encoding: 'utf8' }).replace(/\n$/, ''); }
  catch { console.log('취소됨'); process.exit(1); }
}

const account = ask(`${label} 사이트 아이디`, false);
const password = ask(`${label} 사이트 비밀번호`, true);
if (!account || !password) { console.log('빈 값 — 저장 안 함'); process.exit(1); }

// -U: 같은 항목이 있으면 갱신. -T: security 도구가 묻지 않고 읽을 수 있게 허용
execFileSync('security', ['add-generic-password', '-U', '-s', service, '-a', account, '-l', service,
  '-T', '/usr/bin/security', '-w', password]);
console.log(`키체인 저장 완료: ${service} (계정 ${account.slice(0, 2)}***)`);
