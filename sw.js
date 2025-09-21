// CP Journey Tracker - Service Worker
// Bump cache to invalidate any stale HTML previously cached
const CACHE_NAME = 'cp-journey-v1.2.0';
// Do NOT precache index.html to avoid serving stale markup (e.g., old loading overlay)
const urlsToCache = [
    '/',
    '/styles.css',
    '/script.js',
    '/manifest.json'
];

// Install event
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: Caching files');
                return cache.addAll(urlsToCache);
            })
            .catch((error) => {
                console.error('Service Worker: Caching failed', error);
            })
    );
    self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Service Worker: Deleting old cache', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch event with network-first strategy for API calls and cache-first for static assets
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Network-first for navigations (HTML documents)
    if (request.mode === 'navigate' || request.destination === 'document') {
        event.respondWith((async () => {
            try {
                const networkResponse = await fetch(request);
                // Cache the latest HTML for offline use
                const cache = await caches.open(CACHE_NAME);
                cache.put(request, networkResponse.clone());
                return networkResponse;
            } catch (err) {
                // Fallback to cached document if offline
                const cached = await caches.match(request);
                return cached || caches.match('/index.html');
            }
        })());
        return;
    }

    // Handle cross-origin fonts/icons with runtime caching (stale-while-revalidate)
    const isFontOrIcon = (
        url.hostname.includes('fonts.googleapis.com') ||
        url.hostname.includes('fonts.gstatic.com') ||
        url.hostname.includes('cdnjs.cloudflare.com')
    );

    if (isFontOrIcon) {
        event.respondWith(
            caches.open('runtime-fonts-v1').then(async (cache) => {
                const cached = await cache.match(request);
                const networkFetch = fetch(request)
                    .then((response) => {
                        if (response && response.status === 200) {
                            cache.put(request, response.clone());
                        }
                        return response;
                    })
                    .catch(() => cached);
                return cached || networkFetch;
            })
        );
        return;
    }

    // Network-first strategy for API calls
    if (request.url.includes('/api/')) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // Clone the response before caching
                    const responseClone = response.clone();

                    // Only cache successful responses
                    if (response.status === 200) {
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(request, responseClone);
                            });
                    }

                    return response;
                })
                .catch(() => {
                    // Return cached response if network fails
                    return caches.match(request);
                })
        );
        return;
    }

    // Cache-first strategy for static assets
    event.respondWith(
        caches.match(request)
            .then((response) => {
                // Return cached version if available
                if (response) {
                    return response;
                }

                // Fetch from network
                return fetch(request)
                    .then((response) => {
                        // Don't cache if not a valid response
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        // Clone the response
                        const responseToCache = response.clone();

                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(request, responseToCache);
                            });

                        return response;
                    })
                    .catch(() => {
                        // Non-navigation request failed; no special fallback
                    });
            })
    );
});

// Background sync for offline data
self.addEventListener('sync', (event) => {
    console.log('Service Worker: Background sync', event.tag);

    if (event.tag === 'background-sync') {
        event.waitUntil(
            // Handle background sync logic
            syncData()
        );
    }
});

async function syncData() {
    try {
        // Sync any pending data when back online
        const pendingData = await getStoredPendingData();

        if (pendingData && pendingData.length > 0) {
            for (const data of pendingData) {
                await syncSingleItem(data);
            }

            // Clear pending data after successful sync
            await clearPendingData();
        }
    } catch (error) {
        console.error('Service Worker: Sync failed', error);
    }
}

async function getStoredPendingData() {
    // Get data from IndexedDB or localStorage
    return new Promise((resolve) => {
        const stored = localStorage.getItem('pendingSync');
        resolve(stored ? JSON.parse(stored) : []);
    });
}

async function syncSingleItem(data) {
    // Sync individual items
    try {
        const response = await fetch(data.url, {
            method: data.method || 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...data.headers
            },
            body: JSON.stringify(data.payload)
        });

        if (!response.ok) {
            throw new Error(`Sync failed: ${response.status}`);
        }

        console.log('Service Worker: Item synced successfully', data.id);
        return response;
    } catch (error) {
        console.error('Service Worker: Item sync failed', data.id, error);
        throw error;
    }
}

async function clearPendingData() {
    localStorage.removeItem('pendingSync');
}

// Push notifications
self.addEventListener('push', (event) => {
    console.log('Service Worker: Push received', event);

    const options = {
        body: 'You have new updates in your CP Journey!',
        icon: '/icon-192.png',
        badge: '/badge-72.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            {
                action: 'explore',
                title: 'View Progress',
                icon: '/icon-explore.png'
            },
            {
                action: 'close',
                title: 'Close',
                icon: '/icon-close.png'
            }
        ]
    };

    event.waitUntil(
        self.registration.showNotification('CP Journey Tracker', options)
    );
});

// Notification click
self.addEventListener('notificationclick', (event) => {
    console.log('Service Worker: Notification click received');

    event.notification.close();

    if (event.action === 'explore') {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});
