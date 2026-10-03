// Service worker: 앱 파일을 미리 캐시해 오프라인에서도 열리게 한다.
// 앱 파일을 바꾸면 CACHE 버전을 올린다. 같은 출처 요청만 다루고 외부 요청은 하지 않는다.
// DOM 타입 기준으로 검사되므로 ServiceWorkerGlobalScope 대신 any로 다룬다
/** @type {any} */
const sw = self;
const CACHE = 'workcal-v18';
const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'js/app.js',
  'js/calc.js',
  'js/date.js',
  'js/holidays.js',
  'js/settings.js',
  'js/sheet.js',
  'js/store.js',
  'js/validate.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

sw.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => sw.skipWaiting()));
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => sw.clients.claim()),
  );
});

// 네트워크 우선, 실패하면 캐시. 온라인일 때 받은 최신 파일로 캐시를 갱신한다.
sw.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== sw.location.origin) return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request, { ignoreSearch: true })
        .then((hit) => hit ?? caches.match('index.html'))),
  );
});
