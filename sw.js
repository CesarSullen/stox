const CACHE_NAME = "stox-v2.1.6";
const STATIC_ASSETS = [
	// Page
	"./",
	"./index.html",
	"./css/style.css",
	"./js/main.js",
	"./js/pdf.js",
	"./js/supabase-config.js",
	"./manifest.json",

	// App Icons
	"./assets/opengraph/logo.png",
	"./assets/opengraph/stox-logo-text.svg",

	// UI Icons
	"./assets/icons/arrow-circle-down.svg",
	"./assets/icons/arrow-circle-up.svg",
	"./assets/icons/arrow-counter-clockwise.svg",
	"./assets/icons/calendar-check-duotone.svg",
	"./assets/icons/chart-line-up-duotone.svg",
	"./assets/icons/chart-pie-slice.svg",
	"./assets/icons/check-circle-fill.svg",
	"./assets/icons/copy-simple-bold.svg",
	"./assets/icons/export.svg",
	"./assets/icons/file-arrow-down.svg",
	"./assets/icons/file-arrow-up.svg",
	"./assets/icons/gear-six.svg",
	"./assets/icons/handbag-simple.svg",
	"./assets/icons/house.svg",
	"./assets/icons/magnifying-glass.svg",
	"./assets/icons/money-wavy-duotone.svg",
	"./assets/icons/package-duotone.svg",
	"./assets/icons/package.svg",
	"./assets/icons/plus-circle.svg",
	"./assets/icons/plus.svg",
	"./assets/icons/receipt.svg",
	"./assets/icons/shopping-cart-simple-duotone.svg",
	"./assets/icons/telegram.svg",
	"./assets/icons/x-circle-fill.svg",
	"./assets/icons/x-circle.svg",
	"./assets/opengraph/synthocean-logo.svg",

	// Typography
	"./typography/Outfit-Regular.woff2",
	"./typography/Outfit-Bold.woff2",
	"./typography/Outfit-SemiBold.woff2",
];

// Install
self.addEventListener("install", (event) => {
	self.skipWaiting();
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => {
			return cache.addAll(STATIC_ASSETS);
		}),
	);
});

// Activate
self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => {
				return Promise.all(
					keys
						.filter((key) => key !== CACHE_NAME)
						.map((key) => caches.delete(key)),
				);
			})
			.then(() => self.clients.claim()),
	);
});

// Fetch (cache-first)
self.addEventListener("fetch", (event) => {
	event.respondWith(
		caches.match(event.request).then((response) => {
			return response || fetch(event.request);
		}),
	);
});
