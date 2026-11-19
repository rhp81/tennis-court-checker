// 로그인 도우미: 브라우저 창에서 직접 로그인 → 세션 쿠키(storageState) 저장.
// 사용법:  npm run login              (노원 + 중랑)
//          npm run login -- jungnang   (중랑만; 기존 노원 세션은 유지)
// 비밀번호는 이 스크립트가 다루지 않습니다. 쿠키만 auth/ 폴더(.gitignore)에 저장됩니다.
import { chromium } from 'playwright';
import fs from 'node:fs';
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { STATE_PATH } from './config.mjs';
import { clearLoginFail } from './autologin.mjs';

const LOGIN_URLS = {
  nowon: 'https://reservation.nowonsc.kr/member/login',
  jungnang: 'https://jnrent2.jungnangimc.or.kr/bbs/login.php',
};
const sites = process.argv.slice(2).filter(s => LOGIN_URLS[s]);
const targets = sites.length ? sites : Object.keys(LOGIN_URLS);

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({
  locale: 'ko-KR',
  ...(fs.existsSync(STATE_PATH) ? { storageState: STATE_PATH } : {}),
});
for (const s of targets) await (await context.newPage()).goto(LOGIN_URLS[s]);

console.log(`\n열린 브라우저 탭(${targets.join(', ')})에서 직접 로그인하세요.`);
const rl = readline.createInterface({ input: stdin, output: stdout });
await rl.question('로그인을 마쳤으면 여기서 Enter ⏎ ');
rl.close();

fs.mkdirSync(new URL('../auth/', import.meta.url), { recursive: true });
await context.storageState({ path: STATE_PATH });
fs.chmodSync(STATE_PATH, 0o600);
targets.forEach(clearLoginFail); // 자동로그인 중지 표시 해제
console.log(`세션 저장 완료 → ${STATE_PATH}`);
await browser.close();
