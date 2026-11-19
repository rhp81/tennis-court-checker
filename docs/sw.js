// 네트워크 우선, 실패 시 캐시(오프라인에서도 마지막 표 표시)
const CACHE = 'tennis-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const key = e.request.url.split('?')[0];
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(key, copy));
      return res;
    }).catch(() => caches.match(key))
  );
});
