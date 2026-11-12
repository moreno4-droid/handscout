// HandScout V1 – Service Worker (Moreno Rossi): App-Hülle offline verfügbar. Daten laufen nie über den Zwischenspeicher des Service Workers.
const CACHE = 'handscout-v1-hülle';
const HUELLE = ['./', 'index.html', 'config.js', 'manifest.webmanifest', 'css/app.css', 'icons/icon-192.png', 'icons/icon-512.png',
  'js/app.js', 'js/api.js', 'js/util.js', 'js/state.js', 'js/ui.js', 'js/charts.js', 'js/filters.js', 'js/version.js',
  'js/views/suche.js', 'js/views/rankings.js', 'js/views/profil.js', 'js/views/team.js', 'js/views/vergleich.js', 'js/views/watchlist.js', 'js/views/stafa.js', 'js/views/einstellungen.js'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(HUELLE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return; // Datenbank-Anfragen und Schriften gehen direkt ins Netz
  e.respondWith(fetch(r).then((res) => { if (res.ok) { const k = res.clone(); caches.open(CACHE).then((c) => c.put(u.pathname === '/' ? './' : r, k)); } return res; })
    .catch(() => caches.match(r, { ignoreSearch: true }).then((m) => m || caches.match('index.html'))));
});
