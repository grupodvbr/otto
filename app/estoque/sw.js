const CACHE_NAME = "estoque-pwa-v3";

const FILES = [
  "./",
  "./contagem_de_estoque.html",
  "./manifest.json",
  "./icon-192-2.png",
  "./icon-512-2.png"
];

/* INSTALL */

self.addEventListener("install", event => {

  self.skipWaiting();

  event.waitUntil(

    caches
    .open(CACHE_NAME)
    .then(cache => cache.addAll(FILES))

  );

});

/* ACTIVATE */

self.addEventListener("activate", event => {

  event.waitUntil(

    caches.keys().then(keys => {

      return Promise.all(

        keys.map(key => {

          if(key !== CACHE_NAME){
            return caches.delete(key);
          }

        })

      );

    })

  );

  self.clients.claim();

});

/* FETCH */

self.addEventListener("fetch", event => {

  if(event.request.method !== "GET") return;

  event.respondWith(

    caches.match(event.request)
    .then(response => {

      return response || fetch(event.request)
      .then(networkResponse => {

        const cloned = networkResponse.clone();

        caches.open(CACHE_NAME)
        .then(cache => {
          cache.put(event.request, cloned);
        });

        return networkResponse;

      });

    })
    .catch(() => {

      return caches.match("./contagem_de_estoque.html");

    })

  );

});
