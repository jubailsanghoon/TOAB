const CACHE_NAME = 'toa-beta-v05-offline-v1';
const CORE_ASSETS = [
  './',
  './index.html',
  './manual.html',
  './manifest.json',
  './favicon.ico',
  './icons/toa-logo.png',
  './icons/toa-logo-192.png',
  './icons/toa-logo-512.png',
  './kakao-channel-qr.svg',
  './shared-header-kit/header-kit.css',
  './shared-header-kit/header-kit.js',
  './shared-header-kit/icons/app-logo.png',
  './shared-header-kit/icons/flag_ko.png',
  './shared-header-kit/icons/flag_en.png',
  './shared-header-kit/icons/flag_zh.png',
  './shared-header-kit/icons/flag_ja.png',
  './shared-header-kit/icons/flag_es.png',
  './css/style.css',
  './js/engine.js',
  './js/i18n.js',
  './js/data_store.js',
  './js/license.js',
  './js/diagram.js',
  './js/manual.js',
  './js/main.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(key => (key !== CACHE_NAME ? caches.delete(key) : null))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then(res => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
