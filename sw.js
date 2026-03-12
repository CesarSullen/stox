const CACHE_NAME = "stox-v1.2.0";
const STATIC_ASSETS = [
	// Page
	"./",
	"./index.html",
	"./css/style.css",
	"./js/main.js",
	"./js/supabase-config.js",
	"./manifest.json",

	// App Icons
	"./assets/opengraph/logo.png",
	"./assets/opengraph/so-logo-white-2.webp",

	// UI Icons
	"./assets/icons/arrow-circle-down.svg",
	"./assets/icons/arrow-circle-up.svg",
	"./assets/icons/chart-line-up-duotone.svg",
	"./assets/icons/chart-pie-slice.svg",
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
		caches.open(CACHE_NAME).then((cache) => {
			return cache.addAll(STATIC_ASSETS);
		}),
	);
});

// Activate
self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches.keys().then((keys) => {
			return Promise.all(
				keys
					.filter((key) => key !== CACHE_NAME)
					.map((key) => caches.delete(key)),
			);
		}),
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
