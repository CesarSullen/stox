const CACHE_NAME = "stox-v1";
const STATIC_ASSETS = [
	// Page
	"./",
	"./index.html",
	"./css/style.css",
	"./js/main.js",
	"./manifest.json",

	// App Icons
	"./assets/opengraph/logo.png",
	"./assets/opengraph/so-white-logo-60.svg",

	// UI Icons
	"./assets/icons/arrow-circle-down.svg",
	"./assets/icons/arrow-circle-up.svg",
	"./assets/icons/chart-bar.svg",
	"./assets/icons/chart-line-up-duotone.svg",
	"./assets/icons/check-circle-fill.svg",
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
	"./assets/icons/receipt.svg",
	"./assets/icons/shopping-cart-simple-duotone.svg",
	"./assets/icons/tag-duotone.svg",
	"./assets/icons/x-circle.svg",

	// Typography
	"./typography/Poppins-Regular.ttf",
	"./typography/Poppins-Bold.ttf",
	"./typography/Poppins-SemiBold.ttf",
];

// Install
self.addEventListener("install", (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE_NAME);
			await cache.addAll(STATIC_ASSETS);
		})(),
	);
});

// Activate
self.addEventListener("activate", (event) => {
	event.waitUntil(
		(async () => {
			const keys = await caches.keys();
			await Promise.all(
				keys
					.filter((key) => key !== CACHE_NAME)
					.map((key) => caches.delete(key)),
			);
			await self.clients.claim();
		})(),
	);
});

// Fetch (cache-first)
self.addEventListener("fetch", (event) => {
	event.respondWith(
		(async () => {
			const cachedResponse = await caches.match(event.request);
			if (cachedResponse) return cachedResponse;
			return fetch(event.request);
		})(),
	);
});
