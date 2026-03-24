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
	const profit = data.filteredSales.reduce((sum, s) => {
		return sum + (s.total - (s.acquisition_cost_total || 0));
	}, 0);

	document.getElementById("home-stat-income").textContent =
		`$${data.income.toFixed(2)}`;
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
			'<p class="no-results">Sin productos que mostrar</p>';
		return;
	}

	renderCategoryFilters();

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
				<div class="price">$${product.price.toFixed(2)}</div>
                    <div class="quantity">${product.stock} u</div>
                </div>
            </div>
        `;

		inventoryList.insertAdjacentHTML("beforeend", itemHtml);
	});
}

// Search Bar
function handleSearch(event) {
	const searchTerm = event.target.value.toLowerCase();

	let filtered = db.products;
	if (inventoryFilter === "low-stock") {
		filtered = db.products.filter(
			(p) => p.stock <= (db.settings.stockThreshold || 5),
		);
	} else if (inventoryFilter) {
		filtered = db.products.filter((p) => p.category === inventoryFilter);
	}

	const results = filtered.filter((p) =>
		p.name.toLowerCase().includes(searchTerm),
	);

	renderInventory(results);
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
		timeline.innerHTML = '<p class="no-results">Sin registros que mostrar</p>';
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

		let extraInfo = "";
		if (!isSale) {
			const realUnit = event.cost_unit.toFixed(2);
			const transportText =
				event.transport_cost > 0
					? `<span class="timeline-sub-text">Precio de Transporte: +$${event.transport_cost.toFixed(2)}/u</span>`
					: "";

			extraInfo = `
                <div class="timeline-extra-info">
                    <span class="timeline-sub-text">Precio de Compra: $${realUnit}/u</span>
                    ${transportText}
                </div>
            `;
		}

		const html = `
            <div class="timeline-item">
                <div class="timeline-icon">
                    <img src="./assets/icons/${isSale ? "arrow-circle-up.svg" : "arrow-circle-down.svg"}">
                </div>
                <div class="timeline-item-content">
                    <div class="timeline-main">
                        <div>
                            <strong>${event.product_name}</strong>
                            ${extraInfo}
                        </div>
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
	const profit = data.filteredSales.reduce((sum, s) => {
		return sum + (s.total - (s.acquisition_cost_total || 0));
	}, 0);

	document.getElementById("stat-income").textContent =
		`$${data.income.toFixed(2)}`;
	document.getElementById("stat-investment").textContent =
		`$${data.investment.toFixed(2)}`;
	document.getElementById("stat-inventory-value").textContent =
		`$${data.inventoryValue.toFixed(2)}`;

	const profitEl = document.getElementById("stat-profit");
	profitEl.textContent = `$${profit.toFixed(2)}`;
	profitEl.style.color = profit >= 0 ? "#4CAF50" : "#FF4D4D";

	renderWeeklyChart();
	renderHourlyChart();
	renderTopList("top-products-quantity", "quantity");
	renderTopList("top-products-profit", "profit");
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
		investment: filteredSupplies.reduce((sum, s) => sum + s.total_cost, 0),
		inventoryValue: db.products.reduce((sum, p) => sum + p.stock * p.price, 0),
		filteredSales: filteredSales,
	};
}

// Lists
function renderTopList(containerId, keyType) {
	const list = document.getElementById(containerId);
	if (!list) return;
	list.innerHTML = "";

	const counts = {};

	db.sales.forEach((s) => {
		let valueToAdd =
			keyType === "quantity"
				? s.quantity
				: s.total - (s.acquisition_cost_total || 0);

		counts[s.product_name] = (counts[s.product_name] || 0) + valueToAdd;
	});

	const sorted = Object.entries(counts)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 10);

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

// Charts
function getWeeklyPerformance() {
	const daysName = [
		"Domingo",
		"Lunes",
		"Martes",
		"Miércoles",
		"Jueves",
		"Viernes",
		"Sábado",
	];
	let dayCounts = {
		Lunes: 0,
		Martes: 0,
		Miércoles: 0,
		Jueves: 0,
		Viernes: 0,
		Sábado: 0,
		Domingo: 0,
	};

	const totalSales = db.sales.length;
	if (totalSales === 0) return [];

	db.sales.forEach((sale) => {
		const date = new Date(sale.date);
		const dayName = daysName[date.getDay()];
		dayCounts[dayName]++;
	});

	return Object.keys(dayCounts)
		.map((name) => ({
			name: name,
			count: dayCounts[name],
			percentage: ((dayCounts[name] / totalSales) * 100).toFixed(),
		}))
		.sort((a, b) => b.count - a.count);
}

function renderWeeklyChart() {
	const data = getWeeklyPerformance();
	const barsArea = document.getElementById("weekly-bars-area");
	const labelsAxis = document.getElementById("weekly-labels-axis");

	if (!data || data.length === 0) {
		barsArea.innerHTML = '<p class="no-results">Sin datos</p>';
		return;
	}

	barsArea.innerHTML = "";
	labelsAxis.innerHTML = "";

	data.forEach((day) => {
		const barWrapper = document.createElement("div");
		barWrapper.className = "bar-wrapper";
		barWrapper.innerHTML = `
            <div class="bar-fill" 
                 style="height: ${day.percentage}%" 
                 data-percent="${day.percentage}%">
            </div>
        `;
		barsArea.appendChild(barWrapper);

		const label = document.createElement("div");
		label.className = "axis-label";
		label.innerText = day.name.substring(0, 3); // "Lun", "Mar", etc.
		labelsAxis.appendChild(label);
	});
}

function getHourlyPerformance() {
	let hourCounts = {};
	const totalSales = db.sales.length;
	if (totalSales === 0) return [];

	db.sales.forEach((sale) => {
		const date = new Date(sale.date);
		const hour = date.getHours();

		// 2h intervals
		const start = Math.floor(hour / 2) * 2;
		const end = start + 2;
		const label = `${start.toString().padStart(2, "0")}:00 - ${end.toString().padStart(2, "0")}:00`;

		hourCounts[label] = (hourCounts[label] || 0) + 1;
	});

	return Object.keys(hourCounts)
		.map((label) => ({
			timeRange: label,
			count: hourCounts[label],
			percentage: ((hourCounts[label] / totalSales) * 100).toFixed(),
		}))
		.sort((a, b) => a.timeRange.localeCompare(b.timeRange));
}

function renderHourlyChart() {
	const data = getHourlyPerformance();
	const container = document.getElementById("hourly-chart-container");

	if (!data || data.length === 0) {
		container.innerHTML = '<p class="no-results">Sin datos</p>';
		return;
	}

	container.innerHTML = data
		.map(
			(item) => `
        <div class="horizontal-row">
            <div class="row-info">
                <span>${item.timeRange}</span>
                <span class="row-percentage">${item.percentage}%</span>
            </div>
            <div class="row-bar-wrapper">
                <div class="row-bar-fill" style="width: ${item.percentage}%"></div>
            </div>
        </div>
    `,
		)
		.join("");
}

// Modals
function closeModal(modalId) {
	const modal = document.getElementById(modalId);
	if (modal) {
		modal.classList.remove("active");

		const form = modal.querySelector("form");
		if (form) {
			form.reset();

			const categorySelect = form.querySelector("#supply-category");
			if (categorySelect) {
				categorySelect.disabled = false;
				categorySelect.style.opacity = 1;
			}
		}
	}
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
	const quantityToSell = parseInt(
		document.getElementById("sale-quantity").value,
	);
	const priceAtSale = parseFloat(document.getElementById("sale-price").value);
	const product = db.products.find((p) => p.id === productId);

	if (product && product.stock >= quantityToSell) {
		let remaining = quantityToSell;
		let totalCostOfSale = 0;

		if (!product.batches || product.batches.length === 0) {
			product.batches = [
				{ quantity: product.stock, cost: product.price / 1.3 },
			];
		}

		while (remaining > 0 && product.batches.length > 0) {
			let batch = product.batches[0];

			if (batch.quantity <= remaining) {
				totalCostOfSale += batch.quantity * batch.cost;
				remaining -= batch.quantity;
				product.batches.shift();
			} else {
				totalCostOfSale += remaining * batch.cost;
				batch.quantity -= remaining;
				remaining = 0;
			}
		}

		product.stock -= quantityToSell;
		product.price = priceAtSale;

		db.sales.push({
			id: `sale-${Date.now()}`,
			product_id: product.id,
			product_name: product.name,
			quantity: quantityToSell,
			price_at_sale: priceAtSale,
			total: priceAtSale * quantityToSell,
			acquisition_cost_total: totalCostOfSale,
			date: new Date().toISOString(),
			type: "sale",
		});

		saveToStorage();
		renderDashboard();
		closeModal("modal-sale");
		alert(
			"Venta registrada con éxito.\nEl precio del producto ha sido actualizado.",
		);
	} else {
		alert("Cantidad insuficiente en el inventario o producto no encontrado.");
	}
}

// Update sale price at selling
document
	.getElementById("sale-product-select")
	.addEventListener("change", (e) => {
		const productId = e.target.value;
		const product = db.products.find((p) => p.id === productId);

		if (product) {
			document.getElementById("sale-price").value = product.price;
		}
	});

function openSupplyModal() {
	const dataList = document.getElementById("product-list");
	dataList.innerHTML = "";

	db.products.forEach((product) => {
		const option = document.createElement("option");
		option.value = product.name;
		dataList.appendChild(option);
	});

	populateCategorySelect("supply-category");

	document.getElementById("modal-supply").classList.add("active");
}

function handleSupplySubmit(event) {
	event.preventDefault();

	const name = document.getElementById("supply-product-input").value.trim();
	const category = document.getElementById("supply-category").value;
	const quantity = parseInt(document.getElementById("supply-quantity").value);
	const cost = parseFloat(document.getElementById("supply-cost").value);
	const transport =
		parseFloat(document.getElementById("supply-transport").value) || 0;

	if (!checkPremiumStatus() && db.products.length >= 10) {
		alert(
			"Versión gratuita limitada a 10 productos.\nActiva Premium para desbloquear capacidad ilimitada.",
		);
		document.getElementById("modal-premium").classList.add("active");
		return;
	}

	const realUnitCost = cost + transport;
	const totalAcquisition = realUnitCost * quantity;

	let product = db.products.find(
		(p) => p.name.toLowerCase() === name.toLowerCase(),
	);

	if (product) {
		if (!product.batches) product.batches = [];
		product.batches.push({ quantity: quantity, cost: realUnitCost });
		product.stock += quantity;
	} else {
		product = {
			id: `prod-${Date.now()}`,
			name: name,
			category: category,
			price: cost * 1.3,
			stock: quantity,
			batches: [{ quantity: quantity, cost: realUnitCost }],
		};
		db.products.push(product);
	}

	db.supplies.push({
		id: `sup-${Date.now()}`,
		product_id: product.id,
		product_name: product.name,
		quantity: quantity,
		cost_unit: cost,
		transport_cost: transport,
		total_cost: totalAcquisition,
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

// Update category from inventory
document
	.getElementById("supply-product-input")
	.addEventListener("input", (e) => {
		const name = e.target.value.trim().toLowerCase();
		const existingProduct = db.products.find(
			(p) => p.name.toLowerCase() === name,
		);
		const categorySelect = document.getElementById("supply-category");

		if (existingProduct) {
			categorySelect.value = existingProduct.category;
			categorySelect.disabled = true;
			categorySelect.style.opacity = "0.7";
		} else {
			categorySelect.disabled = false;
			categorySelect.style.opacity = "1";
		}
	});

function openEditModal(productId) {
	const product = db.products.find((p) => p.id === productId);
	if (!product) return;

	populateCategorySelect("edit-product-category");

	document.getElementById("edit-product-id").value = product.id;
	document.getElementById("edit-product-name").value = product.name;
	document.getElementById("edit-product-category").value = product.category;
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

function handleImport(file) {
	if (!file) return;

	const reader = new FileReader();
	reader.onload = (e) => {
		try {
			const imported = JSON.parse(e.target.result);

			// BACKUP
			if (imported.products) {
				imported.products.forEach((newP) => {
					let existingP = db.products.find((p) => p.id === newP.id);
					if (existingP) {
						existingP.stock = newP.stock;
						existingP.batches = newP.batches || [];
						existingP.price = newP.price;
					} else {
						db.products.push(newP);
					}
				});

				if (imported.categories) {
					db.categories = [
						...new Set([...db.categories, ...imported.categories]),
					];
				}
				if (imported.settings) {
					db.settings = { ...db.settings, ...imported.settings };
				}
			}

			// SELY OR BACKUP
			if (imported.sales) {
				const existingSaleIds = new Set(db.sales.map((s) => s.id));

				imported.sales.forEach((sale) => {
					if (!existingSaleIds.has(sale.id)) {
						// If there's not acquisition cost, it comes from SELY
						if (sale.acquisition_cost_total === undefined) {
							const product = db.products.find((p) => p.id === sale.product_id);

							if (product && product.batches && product.batches.length > 0) {
								let remaining = sale.quantity;
								let costForThisSale = 0;

								while (remaining > 0 && product.batches.length > 0) {
									let batch = product.batches[0];
									if (batch.quantity <= remaining) {
										costForThisSale += batch.quantity * batch.cost;
										remaining -= batch.quantity;
										product.batches.shift();
									} else {
										costForThisSale += remaining * batch.cost;
										batch.quantity -= remaining;
										remaining = 0;
									}
								}
								sale.acquisition_cost_total = costForThisSale;
								product.stock -= sale.quantity;
							} else if (product) {
								sale.acquisition_cost_total =
									(product.price / 1.3) * sale.quantity;
								product.stock -= sale.quantity;
							}
						}

						db.sales.push(sale);
					}
				});

				// BACKUP
				if (imported.supplies) {
					const existingSupplyIds = new Set(db.supplies.map((s) => s.id));
					const newSupplies = imported.supplies.filter(
						(s) => !existingSupplyIds.has(s.id),
					);
					db.supplies.push(...newSupplies);
				}
			}

			saveToStorage();
			renderInventory();
			renderDashboard();
			alert("Sincronización completada con éxito.");
		} catch (err) {
			console.error("Error al parsear el JSON:", err);
			alert("Error: El archivo no es válido o está corrupto.");
		}
	};
	reader.readAsText(file);
}

// Exporting data
function exportData() {
	if (checkPremiumStatus()) {
		const downloadAnchorNode = document.createElement("a");

		downloadAnchorNode.setAttribute(
			"href",
			"data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(db)),
		);
		downloadAnchorNode.setAttribute("download", "stox_backup.json");
		document.body.appendChild(downloadAnchorNode);
		downloadAnchorNode.click();
		downloadAnchorNode.remove();
	} else {
		document.getElementById("modal-premium").classList.add("active");
	}
}

function exportDataForSely() {
	if (!checkPremiumStatus()) {
		document.getElementById("modal-premium").classList.add("active");
		return;
	}

	const selyDB = {
		products: db.products.map((p) => ({
			id: p.id,
			name: p.name,
			category: p.category,
			price: p.price,
			stock: p.stock,
		})),
		categories: db.categories,
		settings: {
			stockThreshold: db.settings.stockThreshold,
		},
	};

	const fileName = `inventario_stox_${new Date().toISOString().slice(0, 10)}.json`;
	const blob = new Blob([JSON.stringify(selyDB)], { type: "application/json" });
	const file = new File([blob], fileName, { type: "application/json" });

	if (navigator.canShare && navigator.canShare({ files: [file] })) {
		navigator.share({
			files: [file],
			title: "Datos para SELY",
			text: "Inventario para la app SELY",
		});
	} else {
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = fileName;
		a.click();
		URL.revokeObjectURL(url);
	}
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

async function trackProjectActivity(projectName) {
	try {
		const { error } = await _supabase.rpc("increment_visit", {
			name_param: projectName,
		});

		if (error) throw error;
	} catch (err) {
		console.warn("Offline mode");
	}
}

trackProjectActivity("STOX");

if ("launchQueue" in window) {
	launchQueue.setConsumer(async (launchParams) => {
		if (!launchParams.files || launchParams.files.length === 0) return;

		for (const fileHandle of launchParams.files) {
			try {
				const file = await fileHandle.getFile();
				if (file.name.toLowerCase().endsWith(".json")) {
					handleImport(file);
				}
			} catch (err) {
				console.error("Error al acceder al archivo compartido:", err);
			}
		}
	});
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
