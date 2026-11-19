// 세션 만료 시 macOS 키체인에 저장된 본인 계정으로 자동 재로그인.
// 키체인 항목(일반 암호): 이름(서비스) = tennis-court-checker.<site>, 계정 = 아이디, 암호 = 비밀번호
// 비밀번호는 키체인에서 읽어 로그인 폼에만 넣고, 로그·파일 어디에도 남기지 않습니다.
// 로그인에 실패하면 auth/<site>.loginfail 을 만들고 다시 시도하지 않습니다(노원은 5회 오류 시 계정 잠김).
// → 원인 해결 후 `npm run login` 으로 직접 로그인하면 표시가 지워집니다.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, STATE_PATH } from './config.mjs';

export const SITES = {
  nowon: {
    loginUrl: 'https://reservation.nowonsc.kr/member/login',
    isLoginPage: url => url.includes('/member/login'),
    user: '#memberId', pass: '#memberPassword',
  },
  jungnang: {
    loginUrl: 'https://jnrent2.jungnangimc.or.kr/bbs/login.php',
    isLoginPage: url => url.includes('/bbs/login.php'),
    // 점검 중이라 아직 폼 확인 전 → 비밀번호 칸과 같은 폼의 텍스트 칸을 자동으로 찾음
    user: null, pass: null,
  },
};

const failFlag = site => path.join(ROOT, 'auth', `${site}.loginfail`);
export const clearLoginFail = site => fs.rmSync(failFlag(site), { force: true });

function readKeychain(site) {
  const service = `tennis-court-checker.${site}`;
  try {
    const attrs = execFileSync('security', ['find-generic-password', '-s', service], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const account = attrs.match(/"acct"<blob>="([^"]*)"/)?.[1];
    const password = execFileSync('security', ['find-generic-password', '-s', service, '-w'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).replace(/\n$/, '');
    return account && password ? { account, password } : null;
  } catch {
    return null;
  }
}

// 성공 시 true. 키체인 항목이 없거나 이전에 실패했으면 시도하지 않고 사유를 던짐.
export async function autoLogin(context, site) {
  const cfg = SITES[site];
  if (fs.existsSync(failFlag(site))) throw new Error(`${site} 자동로그인 중지됨(이전 실패) — npm run login 으로 직접 로그인 필요`);
  const cred = readKeychain(site);
  if (!cred) throw new Error(`키체인에 tennis-court-checker.${site} 항목 없음`);

  const page = await context.newPage();
  page.on('dialog', d => d.accept().catch(() => {}));
  try {
    await page.goto(cfg.loginUrl, { waitUntil: 'networkidle' });
    const pass = page.locator(cfg.pass || 'input[type="password"]').first();
    const form = pass.locator('xpath=ancestor::form[1]');
    const user = cfg.user ? page.locator(cfg.user)
      : form.locator('input[type="text"], input[type="email"], input:not([type])').first();
    await user.fill(cred.account);
    await pass.fill(cred.password);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {}),
      pass.press('Enter'),
    ]);
    if (cfg.isLoginPage(page.url())) {
      fs.writeFileSync(failFlag(site), new Date().toISOString());
      throw new Error(`${site} 자동로그인 실패 — 아이디/비밀번호 확인 후 npm run login`);
    }
    await context.storageState({ path: STATE_PATH });
    fs.chmodSync(STATE_PATH, 0o600);
    return true;
  } finally {
    await page.close();
  }
}
