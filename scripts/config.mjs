import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const STATE_PATH = path.join(ROOT, 'auth', 'state.json');
export const OUT_PATH = path.join(ROOT, 'docs', 'data.json');

// 며칠 앞까지 볼지
export const DAYS_AHEAD = 21;

export const NOWON_COURTS = [
  { id: 'nowon-madeul', name: '노원 마들', url: 'https://reservation.nowonsc.kr/sports/courtReserve_date?cate1=1&cate2=16' },
  { id: 'nowon-buram', name: '노원 불암산', url: 'https://reservation.nowonsc.kr/sports/courtReserve_date?cate1=1&cate2=15' },
];

// 자동 수집 안 하는 바로가기 타일 (봇 차단 사이트)
export const LINKS = [
  { name: '장충', note: 'l4t 빈자리 (중구 선택)', url: 'https://l4t.kr/' },
  { name: '광나루', note: 'l4t 빈자리 (광진구 선택)', url: 'https://l4t.kr/' },
  { name: '수내', note: '성남 isdc', url: 'https://res.isdc.co.kr/index.do' },
  { name: '양지', note: '성남 isdc', url: 'https://res.isdc.co.kr/index.do' },
  { name: '서울 공공예약', note: '장충·광나루 예약', url: 'https://yeyak.seoul.go.kr/' },
];

export const JUNGNANG = {
  id: 'jungnang', name: '중랑구립',
  url: 'https://jnrent2.jungnangimc.or.kr/page/rent/s01.od.list.php',
};
