// Service Worker for Beauty Studio PWA
// Handles caching and offline functionality

const CACHE_NAME = 'beauty-studio-v1';
const RUNTIME_CACHE = 'beauty-studio-runtime';

// Assets to cache on install
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/manifest.json',
    'https://cdnjs.cloudflare.com/ajax/libs/tailwindcss/3.3.5/tailwind.min.css',
    'https://cdn.tailwindcss.com'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
    console.log('Service Worker installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Caching core assets');
            return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
                console.log('Some assets failed to cache:', err);
                // Continue even if some assets fail to cache
                return Promise.resolve();
            });
        }).then(() => {
            return self.skipWaiting();
        })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker activating...');
    
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((cacheName) => {
                        return cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE;
                    })
                    .map((cacheName) => {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    })
            );
        }).then(() => {
            return self.clients.claim();
        })
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip cross-origin requests
    if (url.origin !== location.origin) {
        return;
    }

    // Handle different request types
    if (request.method !== 'GET') {
        return;
    }

    event.respondWith(
        caches.match(request).then((response) => {
            // Return cached response if available
            if (response) {
                return response;
            }

            // Otherwise fetch from network
            return fetch(request).then((response) => {
                // Don't cache non-successful responses
                if (!response || response.status !== 200 || response.type === 'error') {
                    return response;
                }

                // Clone the response
                const responseToCache = response.clone();

                // Cache successful responses for runtime
                caches.open(RUNTIME_CACHE).then((cache) => {
                    cache.put(request, responseToCache);
                });

                return response;
            }).catch((err) => {
                console.log('Fetch failed; returning offline page', err);
                
                // Return cached version if available
                return caches.match(request).then((cachedResponse) => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    
                    // Return offline fallback
                    if (request.destination === 'document') {
                        return caches.match('/index.html');
                    }
                    
                    return new Response('Offline - service unavailable', {
                        status: 503,
                        statusText: 'Service Unavailable',
                        headers: new Headers({
                            'Content-Type': 'text/plain'
                        })
                    });
                });
            });
        })
    );
});

// Handle messages from clients
self.addEventListener('message', (event) => {
    console.log('Service Worker received message:', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Background sync for form submissions (if offline)
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-contact-form') {
        event.waitUntil(
            // You can add custom logic here to retry failed form submissions
            Promise.resolve()
        );
    }
});

// Push notifications
self.addEventListener('push', (event) => {
    const options = {
        body: event.data ? event.data.text() : 'Beauty Studio - Nowa wiadomość',
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect fill="%239AC8A0" width="192" height="192" rx="48"/><circle cx="96" cy="60" r="28" fill="white" opacity="0.8"/><path d="M 70 110 Q 96 95 122 110 Q 96 135 70 110" fill="white" opacity="0.8"/><path d="M 60 150 Q 96 135 132 150 Q 96 165 60 150" fill="white" opacity="0.6"/></svg>',
        badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><circle cx="48" cy="48" r="48" fill="%239AC8A0"/></svg>',
        theme_color: '#9AC8A0',
        tag: 'beauty-studio-notification',
        requireInteraction: false
    };

    event.waitUntil(
        self.registration.showNotification('Beauty Studio', options)
    );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    event.waitUntil(
        clients.matchAll({ type: 'window' }).then((clientList) => {
            // Check if there's already a window open
            for (let i = 0; i < clientList.length; i++) {
                const client = clientList[i];
                if (client.url === '/' && 'focus' in client) {
                    return client.focus();
                }
            }
            // If not, open a new window
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});

console.log('Service Worker loaded successfully');
