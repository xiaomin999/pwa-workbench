/* 个人全能自律工作台 — Service Worker
 * 作用：缓存应用外壳，实现离线可用 + 后台静默更新。
 * 策略：
 *   - 安装时预缓存核心资源（仅缓存同源资源）
 *   - 导航请求（HTML）：network-first，失败回退到缓存的 index.html
 *   - 同源静态资源：cache-first，命中后后台静默更新
 *   - 跨域请求（外部新闻/电商链接等）：直接放行，不缓存
 */
const CACHE = 'paw-cache-v1';
const APP_SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icon.svg',
  'icon-192.png',
  'icon-512.png',
  'splash-750x1334.png',
  'splash-1125x2436.png',
  'splash-1170x2532.png',
  'splash-1179x2556.png',
  'splash-1206x2622.png',
  'splash-1284x2778.png',
  'splash-1290x2796.png',
  'splash-1640x2360.png',
  'splash-1668x2388.png',
  'splash-2048x2732.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(APP_SHELL).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // 只处理同源请求，外部链接直接放行
  if (url.origin !== self.location.origin) return;

  // 导航请求：network-first，离线时回退缓存
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // 静态资源：cache-first，命中后后台更新
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) {
        fetch(req)
          .then(res => {
            if (res && res.status === 200 && res.type === 'basic') {
              caches.open(CACHE).then(c => c.put(req, res.clone())).catch(() => {});
            }
          })
          .catch(() => {});
        return cached;
      }
      return fetch(req).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      });
    })
  );
});
