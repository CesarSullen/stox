let db = {
	products: [
		/* { id, name, price, stock, category } */
	],
	sales: [
		/* { id, product_id, product_name, quantity, price_at_sale, total, date, type } */
	],
	supplies: [
		/* { id, product_id, product_name, quantity, cost_unit, total_cost, ¿supplier?, date, type } */
	],
	categories: ["General"], // Default
	settings: {
		stockThreshold: 5,
	},
};

// Switch between tabs
function switchView(viewId, btnElement) {
	const restrictedViews = ["view-history", "view-dashboard"];
	const isPremium = checkPremiumStatus();

	if (restrictedViews.includes(viewId) && !isPremium) {
		document.getElementById("modal-premium").classList.add("active");
		return;
	}

	document
		.querySelectorAll(".view")
		.forEach((v) => v.classList.remove("active"));
	document
		.querySelectorAll(".nav-item")
		.forEach((b) => b.classList.remove("active"));

	document.getElementById(viewId).classList.add("active");

	if (btnElement) {
		btnElement.classList.add("active");
	}

	if (viewId === "view-home") renderDashboard();
	if (viewId === "view-inventory") renderInventory();
	if (viewId === "view-history") renderHistory();
	if (viewId === "view-dashboard") {
		renderStats("today", document.querySelector('.segment[onclick*="today"]'));
	}
	if (viewId === "view-settings") {
		renderSettings();
	}
}

function renderDashboard() {
	const data = calculateMetrics("today");
	const profit = data.income - data.investment;

	document.getElementById("home-stat-income").textContent =
		`$${data.income.toFixed(2)}`;
	document.getElementById("home-stat-sales").textContent = data.salesCount;
	document.getElementById("home-stat-profit").textContent =
		`$${profit.toFixed(2)}`;
	document.getElementById("home-stat-inventory-value").textContent =
		`$${data.inventoryValue.toFixed(2)}`;

	const profitEl = document.getElementById("home-stat-profit");
	profitEl.style.color = profit >= 0 ? "#4ade80" : "#ff4d4d";
}

function renderInventory(productsToDisplay = db.products) {
	const inventoryList = document.getElementById("inventory-list");
	inventoryList.innerHTML = "";

	if (productsToDisplay.length === 0) {
		inventoryList.innerHTML =
			'<p class="no-results">Sin productos que mostrar.</p>';
		return;
	}

	const threshold = db.settings ? db.settings.stockThreshold : 5;

	productsToDisplay.forEach((product) => {
		const isOutOfStock = product.stock === 0;
		const isLowStock = product.stock <= threshold && !isOutOfStock;

		let badgeClass = "ok";
		let badgeText = "● Suficiente";

		if (isOutOfStock) {
			badgeClass = "out";
			badgeText = "● Sin stock";
		} else if (isLowStock) {
			badgeClass = "low";
			badgeText = "● Bajo stock";
		}

		const itemHtml = `
            <div class="inventory-item" onclick="openEditModal('${product.id}')">
                <div class="item-info">
                    <div class="item-icon-box">
                        <img src="./assets/icons/package.svg">
                    </div>
                    <div class="item-details">
                        <h4>${product.name}</h4>
						<small>${product.category || "Sin categoría"}</small>
                        <span class="stock-badge ${badgeClass}">
                            ${badgeText}
                        </span>
                    </div>
                </div>
                <div class="item-values">
                    <div class="quantity">${product.stock} u</div>
                    <div class="price">$${product.price.toFixed(2)}</div>
                </div>
            </div>
        `;

		renderCategoryFilters();
		inventoryList.insertAdjacentHTML("beforeend", itemHtml);
	});
}

// Search Bar
function handleSearch(event) {
	const searchTerm = event.target.value.toLowerCase();

	const filteredProducts = db.products.filter((product) =>
		product.name.toLowerCase().includes(searchTerm),
	);

	renderInventory(filteredProducts);
}

function populateCategorySelect(selectId) {
	const select = document.getElementById(selectId);
	select.innerHTML = db.categories
		.map((cat) => `<option value="${cat}">${cat}</option>`)
		.join("");
}

let inventoryFilter = null;

function renderCategoryFilters() {
	const container = document.getElementById("category-filters");
	if (!container) return;
	container.innerHTML = "";

	const lowStockPill = document.createElement("div");
	lowStockPill.className = `category-pill low-stock-pill ${inventoryFilter === "low-stock" ? "active" : ""}`;
	lowStockPill.textContent = "● Bajo stock";
	lowStockPill.onclick = () => toggleInventoryFilter("low-stock");
	container.appendChild(lowStockPill);

	db.categories.forEach((cat) => {
		const pill = document.createElement("div");
		pill.className = `category-pill ${inventoryFilter === cat ? "active" : ""}`;
		pill.textContent = cat;
		pill.onclick = () => toggleInventoryFilter(cat);
		container.appendChild(pill);
	});
}

function toggleInventoryFilter(filter) {
	inventoryFilter = inventoryFilter === filter ? null : filter;

	let filtered = db.products;

	if (inventoryFilter === "low-stock") {
		const threshold = db.settings.stockThreshold || 5;
		filtered = db.products.filter((p) => p.stock <= threshold);
	} else if (inventoryFilter) {
		filtered = db.products.filter((p) => p.category === inventoryFilter);
	}

	renderCategoryFilters();
	renderInventory(filtered);
}

function renderHistory() {
	const timeline = document.getElementById("unified-timeline");
	timeline.innerHTML = "";

	let allEvents = [...db.sales, ...db.supplies];

	if (historyFilter !== "all") {
		allEvents = allEvents.filter((event) => event.type === historyFilter);
	}

	allEvents.sort((a, b) => new Date(b.date) - new Date(a.date));

	if (allEvents.length === 0) {
		timeline.innerHTML = '<p class="no-results">Sin registros que mostrar.</p>';
		return;
	}

	allEvents.forEach((event) => {
		const isSale = event.type === "sale";
		const date = new Date(event.date).toLocaleDateString("es-ES", {
			day: "2-digit",
			month: "short",
			hour: "2-digit",
			minute: "2-digit",
		});

		const html = `
            <div class="timeline-item">
                <div class="timeline-icon">
                    <img src="./assets/icons/${isSale ? "arrow-circle-up.svg" : "arrow-circle-down.svg"}">
                </div>
                <div class="timeline-item-content">
                    <div class="timeline-main">
                        <strong>${event.product_name}</strong>
						<span>${event.quantity} u</span>
                    </div>
                    <div class="timeline-details">
                        <strong class="timeline-amount ${isSale ? "type-sale" : "type-supply"}">
                            ${isSale ? "+" : "-"}$${(isSale ? event.total : event.total_cost).toFixed(2)}
                        </strong>
                        <span class="timeline-date">${date}</span>
                    </div>
                </div>
            </div>
        `;
		timeline.insertAdjacentHTML("beforeend", html);
	});
}

// Filter Btn
function toggleFilterMenu() {
	const menu = document.getElementById("filter-menu");
	menu.classList.toggle("active");
}

window.addEventListener("click", function (e) {
	const menu = document.getElementById("filter-menu");
	const filterBtn = document.querySelector(".filter-pill");

	if (!menu.contains(e.target) && !filterBtn.contains(e.target)) {
		menu.classList.remove("active");
	}
});

let historyFilter = "all";

function applyFilter(filter) {
	historyFilter = filter;

	const pill = document.getElementById("filter-pill");
	const labels = { all: "Todo", purchase: "Compras", sale: "Ventas" };
	pill.textContent = labels[filter];

	toggleFilterMenu();
	renderHistory();
}

function renderStats(period, element) {
	document
		.querySelectorAll(".segment")
		.forEach((s) => s.classList.remove("active"));
	if (element) element.classList.add("active");

	const data = calculateMetrics(period);
	const profit = data.income - data.investment;

	document.getElementById("stat-income").textContent =
		`$${data.income.toFixed(2)}`;
	document.getElementById("stat-sales-count").textContent = data.salesCount;
	document.getElementById("stat-investment").textContent =
		`$${data.investment.toFixed(2)}`;
	document.getElementById("stat-inventory-value").textContent =
		`$${data.inventoryValue.toFixed(2)}`;

	const profitEl = document.getElementById("stat-profit");
	profitEl.textContent = `$${profit.toFixed(2)}`;
	profitEl.style.color = profit >= 0 ? "#4CAF50" : "#FF4D4D";

	// Best Sellers (Quantity)
	renderTopList(data.filteredSales, "top-products-quantity", "quantity");

	// Best Sellers (Income)
	renderTopList(data.filteredSales, "top-products-income", "income");

	// Best Sellers (Profit)
	renderTopList(data.filteredSales, "top-products-profit", "profit");
}

// Calculate stats & filter top sales
function calculateMetrics(period) {
	const now = new Date();
	const startOfToday = new Date(
		now.getFullYear(),
		now.getMonth(),
		now.getDate(),
	);
	let startDate;

	if (period === "today") {
		startDate = startOfToday;
	} else if (period === "week") {
		const dayOfWeek = now.getDay();
		const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
		startDate = new Date(startOfToday);
		startDate.setDate(startOfToday.getDate() - diffToMonday);
	} else if (period === "month") {
		startDate = new Date(now.getFullYear(), now.getMonth(), 1);
	}

	const filterByDate = (item) => {
		if (period === "all") return true;
		return new Date(item.date) >= startDate;
	};

	const filteredSales = db.sales.filter(filterByDate);
	const filteredSupplies = db.supplies.filter(filterByDate);

	return {
		income: filteredSales.reduce((sum, s) => sum + s.total, 0),
		salesCount: filteredSales.length,
		investment: filteredSupplies.reduce((sum, s) => sum + s.total_cost, 0),
		inventoryValue: db.products.reduce((sum, p) => sum + p.stock * p.price, 0),
		filteredSales: filteredSales,
	};
}

// Lists
function renderTopList(sales, containerId, keyType) {
	const list = document.getElementById(containerId);
	if (!list) return;
	list.innerHTML = "";

	const counts = {};

	sales.forEach((s) => {
		const supply = db.supplies.find((sup) => sup.product_id === s.product_id);
		const costUnit = supply ? supply.cost_unit : 0;

		let valueToAdd = 0;
		if (keyType === "quantity") valueToAdd = s.quantity;
		if (keyType === "income") valueToAdd = s.total;
		if (keyType === "profit") valueToAdd = s.total - costUnit * s.quantity;

		counts[s.product_name] = (counts[s.product_name] || 0) + valueToAdd;
	});

	const sorted = Object.entries(counts)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 5);

	sorted.forEach(([name, value]) => {
		const displayValue =
			keyType === "quantity" ? `${value} u` : `$${value.toFixed(2)}`;

		list.insertAdjacentHTML(
			"beforeend",
			`
            <div class="top-product-item">
                <span>${name}</span>
                <strong>${displayValue}</strong>
            </div>
        `,
		);
	});
}

// Modals
function closeModal(modalId) {
	document.getElementById(modalId).classList.remove("active");
}

function openSaleModal() {
	const select = document.getElementById("sale-product-select");

	select.innerHTML =
		'<option value="" disabled selected>Selecciona un producto</option>';

	db.products.forEach((product) => {
		const option = document.createElement("option");
		option.value = product.id;
		option.textContent = `${product.name} ($${product.price})`;
		select.appendChild(option);
	});

	document.getElementById("modal-sale").classList.add("active");
}

function handleSaleSubmit(event) {
	event.preventDefault();

	const productId = document.getElementById("sale-product-select").value.trim();
	const quantity = parseInt(document.getElementById("sale-quantity").value);
	const product = db.products.find((p) => p.id === productId);

	if (product && product.stock >= quantity) {
		product.stock -= quantity;

		db.sales.push({
			id: `sale-${Date.now()}`,
			product_id: product.id,
			product_name: product.name,
			quantity: quantity,
			price_at_sale: product.price,
			total: product.price * quantity,
			date: new Date().toISOString(),
			type: "sale",
		});

		saveToStorage();
		renderDashboard();
		closeModal("modal-sale");
		alert("Venta registrada con éxito");
	} else {
		alert("Cantidad insuficiente en el inventario");
	}
}

function openSupplyModal() {
	const dataList = document.getElementById("product-list");
	dataList.innerHTML = "";

	db.products.forEach((product) => {
		const option = document.createElement("option");
		option.value = product.name;
		dataList.appendChild(option);
	});

	populateCategorySelect("supply-product-category");

	document.getElementById("modal-supply").classList.add("active");
}

function handleSupplySubmit(event) {
	event.preventDefault();

	const name = document.getElementById("supply-product-input").value.trim();
	const quantity = parseInt(document.getElementById("supply-quantity").value);
	const cost = parseFloat(document.getElementById("supply-cost").value);

	if (!checkPremiumStatus() && db.products.length >= 10) {
		alert(
			"Versión gratuita limitada a 10 productos.\nActiva Premium para desbloquear capacidad ilimitada.",
		);
		document.getElementById("modal-premium").classList.add("active");
		return;
	}

	let product = db.products.find(
		(p) => p.name.toLowerCase() === name.toLowerCase(),
	);

	if (product) {
		product.stock += quantity;
	} else {
		product = {
			id: `prod-${Date.now()}`,
			name: name,
			price: cost,
			stock: quantity,
		};
		db.products.push(product);
	}

	db.supplies.push({
		id: `sup-${Date.now()}`,
		product_id: product.id,
		product_name: product.name,
		quantity: quantity,
		cost_unit: cost,
		total_cost: cost * quantity,
		date: new Date().toISOString(),
		type: "purchase",
	});

	saveToStorage();
	renderDashboard();
	renderInventory();
	closeModal("modal-supply");
	alert(
		"Compra registrada con éxito. \nAsegúrese de añadirle un precio de venta en el inventario.",
	);
}

function openEditModal(productId) {
	const product = db.products.find((p) => p.id === productId);
	if (!product) return;

	populateCategorySelect("edit-product-category");

	document.getElementById("edit-product-id").value = product.id;
	document.getElementById("edit-product-name").value = product.name;
	document.getElementById("edit-product-price").value = product.price;
	document.getElementById("edit-product-stock").value = product.stock;

	document.getElementById("modal-edit").classList.add("active");
}

function handleEditSubmit(event) {
	event.preventDefault();

	const id = document.getElementById("edit-product-id").value;
	const product = db.products.find((p) => p.id === id);

	if (product) {
		product.name = document.getElementById("edit-product-name").value;
		product.category = document.getElementById("edit-product-category").value;
		product.price = parseFloat(
			document.getElementById("edit-product-price").value,
		);
		product.stock = parseInt(
			document.getElementById("edit-product-stock").value,
		);

		saveToStorage();
		renderInventory();
		closeModal("modal-edit");
	}
}

function handleDeleteProduct() {
	const id = document.getElementById("edit-product-id").value;
	const product = db.products.find((p) => p.id === id);

	if (
		confirm(
			`¿Estás seguro de que quieres eliminar "${product.name}"? Esta acción no se puede deshacer.`,
		)
	) {
		db.products = db.products.filter((p) => p.id !== id);

		saveToStorage();
		renderInventory();
		closeModal("modal-edit");
	}
}

// Settings
// Update threshold for Inventory
function updateThreshold(val) {
	db.settings.stockThreshold = parseInt(val);
	saveToStorage();
}

function renderSettings() {
	const container = document.getElementById("categories-list");
	const thresholdInput = document.getElementById("setting-stock-threshold");

	container.innerHTML = "";
	thresholdInput.value = db.settings.stockThreshold;
	db.categories.forEach((cat) => {
		container.insertAdjacentHTML(
			"beforeend",
			`
            <div class="category-pill">
                ${cat}
                <span onclick="removeCategory('${cat}')">&times;</span>
            </div>
        `,
		);
	});
}

function addCategory() {
	const name = prompt("Nombre de la nueva categoría:");
	if (name && !db.categories.includes(name)) {
		db.categories.push(name);
		saveToStorage();
		renderSettings();
	}
}

function removeCategory(name) {
	if (db.categories.length <= 1)
		return alert("Debes tener al menos una categoría.");
	db.categories = db.categories.filter((c) => c !== name);
	saveToStorage();
	renderSettings();
}

// Importing data
function handleImport(file) {
	if (!file) return;

	const reader = new FileReader();
	reader.onload = (e) => {
		try {
			const imported = JSON.parse(e.target.result);

			if (imported.products) {
				const existingIds = new Set(db.products.map((p) => p.id));
				const newProducts = imported.products.filter(
					(p) => !existingIds.has(p.id),
				);
				db.products.push(...newProducts);
			}

			if (imported.sales) db.sales.push(...imported.sales);
			if (imported.supplies) db.supplies.push(...imported.supplies);

			if (imported.categories) {
				db.categories = [
					...new Set([...db.categories, ...imported.categories]),
				];
			}

			if (imported.settings) {
				db.settings = { ...db.settings, ...imported.settings };
			}

			saveToStorage();

			alert("Datos importados con éxito");
			switchView("view-settings", null); // Soft reload
		} catch (err) {
			console.error("Error al parsear el JSON:", err);
			alert("Error: El archivo no es válido.");
		}
	};
	reader.readAsText(file);
}

// Exporting data
function exportData() {
	const downloadAnchorNode = document.createElement("a");

	downloadAnchorNode.setAttribute(
		"href",
		"data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(db)),
	);
	downloadAnchorNode.setAttribute("download", "stox_backup.json");
	document.body.appendChild(downloadAnchorNode);
	downloadAnchorNode.click();
	downloadAnchorNode.remove();
}

function loadFromStorage() {
	const stored = localStorage.getItem("stox_db");
	const defaultDB = {
		products: [],
		sales: [],
		supplies: [],
		categories: ["General"],
		settings: { stockThreshold: 5 },
	};

	if (stored) {
		const parsed = JSON.parse(stored);
		db = { ...defaultDB, ...parsed };
	} else {
		db = defaultDB;
	}
}

function saveToStorage() {
	localStorage.setItem("stox_db", JSON.stringify(db));
}

function clearDatabase() {
	const confirmed = confirm(
		"¿ESTÁS SEGURO?\nEsta acción borrará absolutamente todos tus datos, productos, ventas y categorías. No se puede deshacer.",
	);

	if (confirmed) {
		const reallyConfirmed = prompt(
			"Escribe 'BORRAR' en mayúsculas para confirmar:",
		);

		if (reallyConfirmed === "BORRAR") {
			db = {
				products: [],
				sales: [],
				supplies: [],
				categories: ["General"],
				settings: { stockThreshold: 5 },
			};

			localStorage.removeItem("stox_db");

			alert("Base de datos reseteada con éxito.");
			location.reload();
		} else {
			alert("Operación cancelada.");
		}
	}
}

loadFromStorage();
renderDashboard();

// Premium Locking
function checkPremiumStatus() {
	const premiumData = JSON.parse(localStorage.getItem("stox_premium"));
	if (!premiumData) return false;

	const today = new Date().getTime();
	if (today >= premiumData.expiryDate) {
		localStorage.removeItem("stox_premium");
		return false;
	}
	return true;
}

async function validatePremiumCode() {
	const inputCode = document.getElementById("premium-code").value.trim();
	if (!inputCode) return alert("Por favor, introduce un código.");

	try {
		const { data, error } = await _supabase
			.from("premium_codes")
			.select("id")
			.eq("code", inputCode)
			.eq("is_used", false)
			.single();

		if (error || !data) {
			throw new Error("Código no encontrado o ya ha sido utilizado.");
		}

		const { error: updateError } = await _supabase
			.from("premium_codes")
			.update({ is_used: true })
			.eq("id", data.id);

		if (updateError)
			throw new Error("Error al procesar el código. Inténtalo de nuevo.");

		activatePremium(30);

		closeModal("modal-premium");
		alert("¡Felicidades! Acceso Premium activado por 30 días.");
		// location.reload();
	} catch (err) {
		console.error("Error Premium:", err);
		alert(err.message || "Error al conectar con el servidor.");
	}
}

function activatePremium(days = 30) {
	const expiryDate = new Date().getTime() + days * 24 * 60 * 60 * 1000;
	const premiumData = { expiryDate: expiryDate };

	localStorage.setItem("stox_premium", JSON.stringify(premiumData));
}

if ("serviceWorker" in navigator) {
	window.addEventListener("load", () => {
		navigator.serviceWorker
			.register("./sw.js")
			.then((registration) => {
				console.log("SW registrado con éxito:", registration.scope);
			})
			.catch((error) => {
				console.log("Fallo al registrar el SW:", error);
			});
	});
}
