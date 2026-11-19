// 빈자리 수집 → docs/data.json
// 노원(마들·불암산), 중랑구립. 저장된 로그인 세션(auth/state.json) 사용, 개인정보(예약자명 등)는 수집하지 않음.
import { chromium } from 'playwright';
import fs from 'node:fs';
import { STATE_PATH, OUT_PATH, DAYS_AHEAD, NOWON_COURTS, JUNGNANG, LINKS } from './config.mjs';
import { autoLogin } from './autologin.mjs';

const DEBUG = process.env.DEBUG === '1';
const log = (...a) => console.log(new Date().toTimeString().slice(0, 8), ...a);
const kstToday = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);

class LoginRequired extends Error {}
class Maintenance extends Error {}

// slots: [{date, time, court}] → days: [{date, slots:[{time, courts:[...]}]}]
function groupSlots(free) {
  const byDate = new Map();
  const nowKst = new Date(Date.now() + 9 * 3600e3).toISOString();
  const [today, nowHM] = [nowKst.slice(0, 10), nowKst.slice(11, 16)];
  for (const s of free) {
    if (s.date === today && s.time.slice(0, 5).padStart(5, '0') <= nowHM) continue; // 이미 지난 시간
    if (!byDate.has(s.date)) byDate.set(s.date, new Map());
    const m = byDate.get(s.date);
    if (!m.has(s.time)) m.set(s.time, []);
    m.get(s.time).push(s.court);
  }
  return [...byDate.keys()].sort().map(date => ({
    date,
    slots: [...byDate.get(date)].sort(([a], [b]) => a.localeCompare(b)).map(([time, courts]) => ({ time, courts })),
  }));
}

// ───────── 노원 (마들 / 불암산) ─────────
async function scrapeNowon(page, court) {
  const today = kstToday(), last = addDays(today, DAYS_AHEAD);
  await page.goto(court.url, { waitUntil: 'networkidle' });
  if (page.url().includes('/member/login')) throw new LoginRequired('노원 로그인 만료');

  const free = [];
  const seen = new Set();
  for (let month = 0; month < 2; month++) {
    // 이번 달 칸 중 '예약가능'(=예약 오픈된 날)만. 슬롯이 실제로 비었는지는 클릭해서 확인.
    const dates = await page.$$eval('td[id^="td-"]:not(.adjacent-month)', tds =>
      tds.filter(td => td.innerText.includes('예약가능')).map(td => td.id.slice(3)));
    const shownMonth = await page.$eval('.clndr .month', el => `${el.dataset.nowyear}-${String(el.dataset.nowmonth).padStart(2, '0')}`);
    for (const date of dates) {
      if (date < today || date > last || seen.has(date)) continue;
      seen.add(date);
      // 이전 날짜 시간표가 남아 잘못 읽히지 않도록 비우고 클릭
      await page.$$eval('input[name="time_chk"]', els => els.forEach(e => e.remove()));
      await page.click(`#td-${date}`).catch(() => {});
      const loaded = await page.waitForSelector('input[name="time_chk"]', { timeout: 3000 }).catch(() => null);
      if (!loaded) continue; // 예약 오픈 안 된 날
      await page.waitForTimeout(300);
      const slots = await page.$$eval('input[name="time_chk"]', els =>
        els.map(e => ({ v: e.value, disabled: e.disabled })));
      for (const { v, disabled } of slots) {
        if (disabled) continue;
        const [from, to, , name] = v.split('~');
        free.push({ date, time: `${from}~${to}`, court: name });
      }
      if (DEBUG) log(court.name, date, `${slots.filter(s => !s.disabled).length}/${slots.length} free`);
      await page.waitForTimeout(400); // 서버 부담 줄이기
    }
    if (last.slice(0, 7) <= shownMonth) break;
    // 다음달 버튼 → 달력 월 표시가 바뀔 때까지 대기
    await page.click('.clndr-next-button');
    await page.waitForFunction(m => {
      const el = document.querySelector('.clndr .month');
      return el && `${el.dataset.nowyear}-${String(el.dataset.nowmonth).padStart(2, '0')}` !== m;
    }, shownMonth, { timeout: 5000 });
    await page.waitForLoadState('networkidle');
  }
  return groupSlots(free);
}

// ───────── 중랑구립 ─────────
async function scrapeJungnang(page) {
  const today = kstToday(), last = addDays(today, DAYS_AHEAD);
  try {
    await page.goto(JUNGNANG.url, { waitUntil: 'networkidle' });
  } catch (e) {
    if (/ERR_CONNECTION|ERR_TIMED_OUT|Timeout/.test(e.message)) throw new Maintenance('중랑 사이트 접속 불가 (점검 중일 수 있음)');
    throw e;
  }
  const bodyText = await page.locator('body').innerText().catch(() => '');
  if (/점검/.test(bodyText) && !/fn_(wait_)?cote_odchk1/.test(await page.content())) throw new Maintenance('중랑 시스템 점검 중');
  if (page.url().includes('/bbs/login.php')) throw new LoginRequired('중랑 로그인 만료');

  const links = page.locator('[onclick*="cote_odchk1"], [href*="cote_odchk1"]');
  const n = await links.count();
  if (DEBUG) log('중랑 시간확인 링크', n);
  const free = [];
  for (let i = 0; i < n; i++) {
    const respP = page.waitForResponse(r => r.url().includes('ajax.rent_one.od.proc.php'), { timeout: 8000 }).catch(() => null);
    await links.nth(i).click().catch(() => {});
    const resp = await respP;
    if (!resp) continue;
    const text = await resp.text();
    const [flag, , , html = ''] = text.split('|');
    if (flag !== 'y') {
      if (text.includes('로그인')) throw new LoginRequired('중랑 로그인 만료');
      continue;
    }
    // 응답 HTML 안에서 각 슬롯의 시간 라벨을 찾아 빈자리만 추림
    const slots = await page.evaluate(h => {
      const doc = new DOMParser().parseFromString(h, 'text/html');
      return [...doc.querySelectorAll('input[name="cote_seq_arr[]"]')].map(inp => {
        const [, courtNo, ymd] = inp.value.split('||');
        const rented = inp.disabled || inp.checked || !!inp.closest('label, td, li')?.querySelector('.rented');
        const ctx = (inp.closest('label') || inp.parentElement)?.textContent || '';
        const rowCtx = inp.closest('tr')?.textContent || '';
        const m = (ctx.match(/\d{1,2}:\d{2}\s*[~-]\s*\d{1,2}:\d{2}/) || rowCtx.match(/\d{1,2}:\d{2}\s*[~-]\s*\d{1,2}:\d{2}/) || [''])[0];
        return { courtNo, ymd, rented, time: m.replace(/\s/g, '').replace('-', '~') };
      });
    }, html);
    for (const s of slots) {
      const date = `${s.ymd.slice(0, 4)}-${s.ymd.slice(4, 6)}-${s.ymd.slice(6, 8)}`;
      if (s.rented || date < today || date > last) continue;
      free.push({ date, time: s.time || '시간미상', court: `${s.courtNo}코트` });
    }
    if (DEBUG) log('중랑', slots[0]?.ymd, `${slots.filter(s => !s.rented).length}/${slots.length} free`);
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(500);
  }
  return groupSlots(free);
}

// ───────── main ─────────
const prev = fs.existsSync(OUT_PATH) ? JSON.parse(fs.readFileSync(OUT_PATH, 'utf8')) : { courts: [] };
const browser = await chromium.launch({ headless: !process.env.HEADED });
const context = await browser.newContext({
  locale: 'ko-KR',
  ...(fs.existsSync(STATE_PATH) ? { storageState: STATE_PATH } : {}),
});
const page = await context.newPage();
page.on('dialog', d => d.dismiss().catch(() => {}));

const jobs = [
  ...NOWON_COURTS.map(c => ({ c, site: 'nowon', bookUrl: c.url, run: () => scrapeNowon(page, c) })),
  { c: JUNGNANG, site: 'jungnang', bookUrl: JUNGNANG.url, run: () => scrapeJungnang(page) },
];
const courts = [];
const loginTried = new Map(); // site → 이번 실행에서 자동로그인 결과(성공 true / 실패 메시지)
async function runWithRelogin(site, run) {
  try {
    return await run();
  } catch (e) {
    if (!(e instanceof LoginRequired)) throw e;
    if (!loginTried.has(site)) {
      try { await autoLogin(context, site); loginTried.set(site, true); log(site, '자동로그인 성공'); }
      catch (le) { loginTried.set(site, le.message); log(site, le.message); }
    }
    if (loginTried.get(site) !== true) throw new LoginRequired(loginTried.get(site));
    return await run(); // 재로그인 후 1회만 재시도
  }
}
for (const { c, site, bookUrl, run } of jobs) {
  const base = { id: c.id, name: c.name, bookUrl };
  try {
    const days = await runWithRelogin(site, run);
    courts.push({ ...base, status: 'ok', checkedAt: new Date().toISOString(), days });
    log(c.name, 'ok', days.reduce((n, d) => n + d.slots.length, 0), '개 시간대');
  } catch (e) {
    const old = prev.courts.find(p => p.id === c.id);
    const status = e instanceof LoginRequired ? 'login_required' : e instanceof Maintenance ? 'maintenance' : 'error';
    // 실패 시 직전 데이터는 유지(언제 기준인지 checkedAt으로 표시)
    courts.push({ ...base, status, error: e.message, checkedAt: old?.checkedAt || null, days: old?.days || [] });
    log(c.name, status, e.message);
  }
}
await browser.close();

fs.writeFileSync(OUT_PATH, JSON.stringify({ updatedAt: new Date().toISOString(), courts, links: LINKS }, null, 1));
log('저장 →', OUT_PATH);
if (courts.some(c => c.status === 'login_required')) {
  // 세션 만료 알림 (macOS 알림센터)
  const { execFileSync } = await import('node:child_process');
  const why = courts.find(c => c.status === 'login_required').error.replace(/"/g, "'");
  try { execFileSync('osascript', ['-e', `display notification "${why}" with title "테니스 빈자리: 로그인 필요"`]); } catch {}
}
