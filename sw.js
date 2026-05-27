const CACHE_NAME = "stox-v1.7.1";
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
	"./assets/opengraph/stox-logo-text.svg",

	// UI Icons
	"./assets/icons/arrow-circle-down.svg",
	"./assets/icons/arrow-circle-up.svg",
	"./assets/icons/chart-line-up-duotone.svg",
	"./assets/icons/chart-pie-slice.svg",
	"./assets/icons/check-circle-fill.svg",
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
	"./assets/icons/receipt.svg",
	"./assets/icons/shopping-cart-simple-duotone.svg",
	"./assets/icons/x-circle-fill.svg",
	"./assets/icons/x-circle.svg",

	// Typography
	"./typography/Poppins-Regular.ttf",
	"./typography/Poppins-Bold.ttf",
	"./typography/Poppins-SemiBold.ttf",
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
	if (
		event.request.method === "POST" &&
		event.request.url.includes("index.html")
	) {
		event.respondWith(
			(async () => {
				try {
					const formData = await event.request.formData();
					const file = formData.get("shared_file");

					if (file) {
						const db = await new Promise((resolve, reject) => {
							const request = indexedDB.open("SelyTempDB", 1);
							request.onupgradeneeded = () =>
								request.result.createObjectStore("files");
							request.onsuccess = () => resolve(request.result);
							request.onerror = () => reject(request.error);
						});

						await new Promise((resolve, reject) => {
							const tx = db.transaction("files", "readwrite");
							tx.objectStore("files").put(file, "last_shared_file");
							tx.oncomplete = () => resolve();
							tx.onerror = () => reject(tx.error);
						});
					}
				} catch (err) {
					console.error("Error procesando shared_file:", err);
				}

				return Response.redirect("./index.html?shared=true", 303);
			})(),
		);
		return;
	}

	event.respondWith(
		caches.match(event.request).then((response) => {
			return response || fetch(event.request);
		}),
	);
});
