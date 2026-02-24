const CACHE_NAME = 'eps-english-cache-v4';
const urlsToCache = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './data.js',
    './manifest.json'
];

self.addEventListener('install', (event) => {
    // 새 SW 설치 즉시 활성화 (기존 SW 대기 없이)
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(urlsToCache))
    );
});

self.addEventListener('activate', (event) => {
    // 즉시 모든 클라이언트(탭) 제어권 획득
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((name) => {
                    if (name !== CACHE_NAME) return caches.delete(name);
                })
            );
        }).then(() => self.clients.claim())
    );
});

// 네트워크 우선(Network-first) 전략: 항상 최신 파일 우선 로드, 실패 시에만 캐시 사용
self.addEventListener('fetch', (event) => {
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // 네트워크 성공 → 캐시에도 업데이트 저장
                const clone = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                return response;
            })
            .catch(() => {
                // 네트워크 실패(오프라인) → 캐시에서 서빙
                return caches.match(event.request);
            })
    );
});
