let db = {
  app: "STOX",
  products: [],
  sales: [],
  supplies: [],
  categories: ["General"], // Default
  settings: { stockThreshold: 5, serviceUnit: "sesión", servicesOnly: false },
};

const API_BASE_URL = "https://stox.sullen.deno.net";

async function apiFetch(endpoint, options = {}) {
  if (!navigator.onLine) {
    throw new Error("Sin conexión a internet.");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);

  try {
    const token = localStorage.getItem("stox_session_token");
    const headers = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    };

    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || "Error de conexión con el servidor.");
    }

    return data;
  } catch (err) {
    clearTimeout(timeoutId);

    if (err.name === "AbortError") {
      throw new Error("Tiempo de espera agotado. Verifica tu conexión.");
    }

    throw err;
  }
}

function haptic() {
  if (navigator.vibrate) {
    navigator.vibrate(10);
    return;
  }

  // iOS fallback via checkbox switch
  const el = document.createElement("input");
  el.type = "checkbox";
  el.setAttribute("switch", "");
  el.style.cssText = "position:fixed;opacity:0;pointer-events:none;";
  document.body.appendChild(el);
  el.click();
  document.body.removeChild(el);
}

function formatDateShort(isoString) {
  return new Date(isoString).toLocaleDateString("es-ES", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatDateWithTime(isoString) {
  return new Date(isoString).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTimeOnly(isoString) {
  return new Date(isoString).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function generateId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
}

function showToast(message, type = "success", duration = 3000) {
  const container = document.getElementById("toast-container");
  let toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.classList.add("toast-visible");
    });
  });

  setTimeout(() => {
    toast.classList.remove("toast-visible");
    toast.addEventListener("transitionend", () => toast.remove(), {
      once: true,
    });
  }, duration);
}

function showAlert(message, onClose) {
  const modal = document.getElementById("modal-ui");
  const msg = document.getElementById("modal-ui-message");
  const input = document.getElementById("modal-ui-input");
  const actions = document.getElementById("modal-ui-actions");

  msg.textContent = message;
  input.style.display = "none";
  input.value = "";
  actions.innerHTML = `
    <button class="btn-confirm" onclick="closeModalUI(${onClose ? "true" : "false"})">
      Entendido
    </button>`;

  document.body.classList.add("modal-open");
  modal.classList.add("active");
  history.pushState({ modal: true }, "");
  modal._onClose = onClose || null;
  haptic();
}

function showConfirm(message, onConfirm, destructive = false) {
  const modal = document.getElementById("modal-ui");
  const msg = document.getElementById("modal-ui-message");
  const input = document.getElementById("modal-ui-input");
  const actions = document.getElementById("modal-ui-actions");

  msg.textContent = message;
  input.style.display = "none";
  input.value = "";
  const confirmClass = destructive ? "btn-delete-confirm" : "btn-confirm";
  actions.innerHTML = `
    <button class="btn-cancel" onclick="closeModalUI(false)">Cancelar</button>
    <button class="${confirmClass}" onclick="closeModalUI(true)">Confirmar</button>`;

  document.body.classList.add("modal-open");
  modal.classList.add("active");
  history.pushState({ modal: true }, "");
  modal._onConfirm = onConfirm;
  modal._type = "confirm";
}

function showPrompt(message, placeholder, onConfirm) {
  const modal = document.getElementById("modal-ui");
  const msg = document.getElementById("modal-ui-message");
  const input = document.getElementById("modal-ui-input");
  const actions = document.getElementById("modal-ui-actions");

  msg.textContent = message;
  input.style.display = "block";
  input.value = "";
  input.placeholder = placeholder || "";
  actions.innerHTML = `
    <button class="btn-cancel" onclick="closeModalUI(false)">Cancelar</button>
    <button class="btn-confirm" onclick="closeModalUI(true)">Confirmar</button>`;

  document.body.classList.add("modal-open");
  modal.classList.add("active");
  history.pushState({ modal: true }, "");
  modal._onConfirm = onConfirm;
  modal._type = "prompt";

  setTimeout(() => input.focus(), 100);
}

function closeModalUI(confirmed) {
  const modal = document.getElementById("modal-ui");
  const input = document.getElementById("modal-ui-input");
  modal.classList.remove("active");
  document.body.classList.remove("modal-open");

  if (confirmed && modal._type === "confirm" && modal._onConfirm) {
    modal._onConfirm();
  } else if (confirmed && modal._type === "prompt" && modal._onConfirm) {
    modal._onConfirm(input.value);
  } else if (confirmed && modal._onClose) {
    modal._onClose();
  }

  modal._onConfirm = null;
  modal._onClose = null;
  modal._type = null;
}

// Switch between tabs
function switchView(viewId, btnElement) {
  const restrictedViews = ["view-history", "view-dashboard"];
  const isPremium = checkPremiumStatus();

  if (restrictedViews.includes(viewId) && !isPremium) {
    openPremiumModal();
    return;
  }

  haptic();

  const performUpdate = () => {
    document
      .querySelectorAll(".view")
      .forEach((v) => v.classList.remove("active"));
    document
      .querySelectorAll(".nav-item")
      .forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".category-pill").forEach((pill) => {
      pill.classList.remove("active");
    });

    const targetView = document.getElementById(viewId);
    if (targetView) targetView.classList.add("active");
    window.scrollTo({ top: 0, behavior: "instant" });

    if (btnElement) {
      btnElement.classList.add("active");
    }

    if (viewId === "view-home") {
      // Download sales in background and render when ready
      downloadSalesFromCloud().then(() => renderDashboard());
      renderDashboard();
    }
    if (viewId === "view-inventory") {
      inventoryFilter = null;
      renderInventory();
    }
    if (viewId === "view-history") {
      showAllHistory = false;
      downloadSalesFromCloud().then(() => {
        renderPosFilters();
        renderHistory();
      });
      renderPosFilters();
      renderHistory();
    }
    if (viewId === "view-dashboard") {
      downloadSalesFromCloud().then(() => {
        renderStats(
          "today",
          document.querySelector('.segment[onclick*="today"]'),
        );
      });
      renderStats(
        "today",
        document.querySelector('.segment[onclick*="today"]'),
      );
    }
    if (viewId === "view-settings") {
      renderSettings();
    }
  };

  if (!document.startViewTransition) {
    performUpdate();
    return;
  }

  document.startViewTransition(() => performUpdate());
}

function populateDateSelect() {
  const select = document.getElementById("daily-date-select");
  if (!select) return;

  const DAY_NAMES = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

  const dateMap = {};
  db.sales.forEach((s) => {
    const dateObj = new Date(s.date);
    const dateStr = formatDateShort(dateObj.toISOString());

    if (!dateMap[dateStr]) {
      const dayName = DAY_NAMES[dateObj.getDay()];
      dateMap[dateStr] = {
        label: `${dayName}, ${dateStr}`,
        dateObj,
      };
    }
  });

  const sorted = Object.entries(dateMap).sort(
    (a, b) => b[1].dateObj - a[1].dateObj,
  );

  select.innerHTML = '<option value="">Selecciona una fecha...</option>';
  sorted.forEach(([dateStr, { label }]) => {
    const option = document.createElement("option");
    option.value = dateStr;
    option.textContent = label;
    select.appendChild(option);
  });
}

function renderDailySummary(selectedDateStr) {
  const container = document.getElementById("daily-summary-content");
  if (!container) return;

  if (!selectedDateStr) {
    container.innerHTML = "";
    return;
  }

  const salesOfDay = db.sales.filter(
    (s) => formatDateShort(s.date) === selectedDateStr && s.type !== "return",
  );
  const returnsOfDay = db.sales.filter(
    (s) => formatDateShort(s.date) === selectedDateStr && s.type === "return",
  );
  const suppliesOfDay = db.supplies.filter(
    (s) =>
      formatDateShort(s.date) === selectedDateStr && s.type !== "service_added",
  );
  const servicesAddedToday = db.supplies.filter(
    (s) =>
      formatDateShort(s.date) === selectedDateStr && s.type === "service_added",
  );

  if (
    salesOfDay.length === 0 &&
    returnsOfDay.length === 0 &&
    suppliesOfDay.length === 0
  ) {
    container.innerHTML =
      '<p class="no-results">Sin actividad registrada este día.</p>';
    return;
  }

  // Total
  const totalIncome = salesOfDay.reduce((sum, s) => sum + s.total, 0);
  const totalReturns = returnsOfDay.reduce((sum, s) => sum + s.total, 0);
  const totalProfit = salesOfDay.reduce(
    (sum, s) => sum + (s.total - (s.acquisition_cost_total || 0)),
    0,
  );
  const totalSuppliesCost = suppliesOfDay.reduce(
    (sum, s) => sum + s.total_cost,
    0,
  );
  const profitColor = totalProfit >= 0 ? "var(--accent)" : "var(--alert)";

  const returnsLine =
    returnsOfDay.length > 0
      ? `<p>Devoluciones: <strong style="color:var(--alert)">-$${totalReturns.toFixed(2)}</strong></p>`
      : "";
  const suppliesLine =
    suppliesOfDay.length > 0
      ? `<p>Total en Compras: <strong style="color:var(--alert)">-$${totalSuppliesCost.toFixed(2)}</strong></p>`
      : "";

  // Sales by POS
  const groups = {};
  salesOfDay.forEach((s) => {
    const key =
      s.pos_name && s.pos_name.trim() !== "" ? s.pos_name : "Este negocio";
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  });

  let groupsHtml = "";
  if (salesOfDay.length > 0) {
    groupsHtml += `<p class="daily-section-title">Ventas por punto de venta</p>`;
    Object.entries(groups).forEach(([posName, sales]) => {
      const products = {};
      sales.forEach((s) => {
        if (!products[s.product_name]) {
          products[s.product_name] = { quantity: 0, total: 0 };
        }
        products[s.product_name].quantity += s.quantity;
        products[s.product_name].total += s.total;
      });

      const sortedProducts = Object.entries(products).sort(
        (a, b) => b[1].total - a[1].total,
      );
      const posTotal = sortedProducts.reduce(
        (sum, [, data]) => sum + data.total,
        0,
      );

      const itemsHtml = sortedProducts
        .map(
          ([name, data]) => `
<div class="daily-product-item">
  <span>${name} <small>×${data.quantity}</small></span>
  <strong>$${data.total.toFixed(2)}</strong>
</div>`,
        )
        .join("");

      groupsHtml += `
<div class="daily-pos-group">
  <p class="daily-pos-label">${posName}</p>
  ${itemsHtml}
  <div class="daily-product-item">
    <strong>Total</strong>
    <strong>$${posTotal.toFixed(2)}</strong>
  </div>
</div>`;
    });
  }

  // Returns
  let returnsHtml = "";
  if (returnsOfDay.length > 0) {
    const returnItems = returnsOfDay
      .map(
        (r) => `
<div class="daily-return-item">
  <span>${r.product_name} <small>×${r.quantity}</small></span>
  <strong>-$${r.total.toFixed(2)}</strong>
</div>`,
      )
      .join("");

    const returnsTotal = returnsOfDay.reduce((sum, r) => sum + r.total, 0);

    returnsHtml = `
<p class="daily-section-title">Devoluciones</p>
<div class="daily-pos-group">
  ${returnItems}
  <div class="daily-return-item">
    <strong style="color: var(--text-muted)">Total devuelto</strong>
    <strong>-$${returnsTotal.toFixed(2)}</strong>
  </div>
</div>`;
  }

  // Supplies
  let suppliesHtml = "";
  if (suppliesOfDay.length > 0) {
    const supplyItems = suppliesOfDay
      .map(
        (s) => `
<div class="daily-supply-item">
  <span>${s.product_name} <small>×${s.quantity}</small></span>
  <strong>-$${s.total_cost.toFixed(2)}</strong>
</div>`,
      )
      .join("");

    suppliesHtml = `
<p class="daily-section-title">Compras</p>
<div class="daily-pos-group">
  ${supplyItems}
  <div class="daily-supply-item">
    <strong>Total invertido</strong>
    <strong>-$${totalSuppliesCost.toFixed(2)}</strong>
  </div>
</div>`;
  }
  let servicesAddedHtml = "";
  if (servicesAddedToday.length > 0) {
    const serviceItems = servicesAddedToday
      .map(
        (s) => `
<div class="daily-supply-item">
  <span>${s.product_name}</span>
  <strong style="color: var(--accent)">Nuevo</strong>
</div>`,
      )
      .join("");

    servicesAddedHtml = `
<p class="daily-section-title">Servicios añadidos</p>
<div class="daily-pos-group">
  ${serviceItems}
</div>`;
  }

  // Render
  container.innerHTML = `
<div class="daily-summary-totals">
  <p>Total ingresado: <strong>$${totalIncome.toFixed(2)}</strong></p>
  ${returnsLine}
  <p>Ganancia bruta: <strong style="color:${profitColor}">$${totalProfit.toFixed(2)}</strong></p>
  ${suppliesLine}
</div>
${groupsHtml}
${returnsHtml}
${suppliesHtml}
${servicesAddedHtml}
<button
  class="btn-confirm"
  style="margin-top: 1rem; width: 100%"
  onclick="exportDailySummaryPDF('${selectedDateStr}')"
>
  Exportar PDF
</button>
`;
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
  profitEl.style.color = profit >= 0 ? "var(--accent)" : "var(--alert)";
  populateDateSelect();
}

function checkLowStockToast(product) {
  const threshold =
    product.threshold !== undefined
      ? product.threshold
      : db.settings
        ? db.settings.stockThreshold
        : 5;

  if (product.stock > 0 && product.stock <= threshold) {
    showToast(
      `Bajo stock: ${product.product_name || product.name} (${product.stock} u)`,
      "error",
      4000,
    );
  }
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

  const globalThreshold = db.settings ? db.settings.stockThreshold : 5;

  productsToDisplay = [...productsToDisplay].sort((a, b) =>
    a.name.localeCompare(b.name, "es", { sensitivity: "base" }),
  );

  productsToDisplay.forEach((product) => {
    const isService = product.type === "service";
    const threshold =
      product.threshold !== undefined ? product.threshold : globalThreshold;
    const isOutOfStock = product.stock === 0 && !isService;
    const isLowStock =
      product.stock <= threshold && !isOutOfStock && !isService;

    let badgeClass = "ok";
    let badgeText = "● Suficiente";

    if (isService) {
      badgeClass = "service";
      badgeText = "★ Servicio";
    } else if (isOutOfStock) {
      badgeClass = "out";
      badgeText = "● Sin stock";
    } else if (isLowStock) {
      badgeClass = "low";
      badgeText = "● Bajo stock";
    }

    const icon = isService ? "call-bell.svg" : "package.svg";
    const itemHtml = `
            <div class="inventory-item" onclick="openEditModal('${product.id}')">
                <div class="item-info">
                    <div class="item-icon-box">
                       <img src="./assets/icons/${icon}">
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
                    <div class="quantity">${isService ? "∞" : product.stock + " u"}</div>
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
    const globalThreshold = db.settings ? db.settings.stockThreshold : 5;
    filtered = db.products.filter((p) => {
      const t = p.threshold !== undefined ? p.threshold : globalThreshold;
      return p.stock <= t && p.stock > 0;
    });
  } else if (inventoryFilter) {
    filtered = db.products.filter((p) => p.category === inventoryFilter);
  }

  const results = filtered
    .filter((p) => p.name.toLowerCase().includes(searchTerm))
    .sort((a, b) =>
      a.name.localeCompare(b.name, "es", { sensitivity: "base" }),
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

  const hasServices = db.products.some((p) => p.type === "service");
  if (hasServices) {
    const servicesPill = document.createElement("div");
    servicesPill.className = `category-pill ${inventoryFilter === "services" ? "active" : ""}`;
    servicesPill.textContent = "★ Servicios";
    servicesPill.onclick = () => toggleInventoryFilter("services");
    container.appendChild(servicesPill);
  }

  db.categories.forEach((cat) => {
    const pill = document.createElement("div");
    pill.className = `category-pill ${inventoryFilter === cat ? "active" : ""}`;
    pill.textContent = cat;
    pill.onclick = () => toggleInventoryFilter(cat);
    container.appendChild(pill);
  });

  const addBtn = document.createElement("div");
  addBtn.className = "category-pill-add";
  addBtn.innerHTML = `<img src="./assets/icons/plus.svg" />`;
  addBtn.onclick = () => {
    addCategory();
    renderInventory();
  };
  container.appendChild(addBtn);
}

function toggleInventoryFilter(filter) {
  inventoryFilter = inventoryFilter === filter ? null : filter;

  let filtered = db.products;

  if (inventoryFilter === "low-stock") {
    const threshold = db.settings.stockThreshold || 5;
    filtered = db.products.filter(
      (p) => p.stock <= threshold && p.type !== "service",
    );
  } else if (inventoryFilter === "services") {
    filtered = db.products.filter((p) => p.type === "service");
  } else if (inventoryFilter) {
    filtered = db.products.filter((p) => p.category === inventoryFilter);
  }

  renderCategoryFilters();
  renderInventory(filtered);
}

function renderHistory() {
  const timeline = document.getElementById("unified-timeline");
  timeline.innerHTML = "";

  const groupedEvents = groupAndAggregateEvents();

  const { events, hiddenCount } = applyFilters(groupedEvents);

  renderTimelineContent(timeline, events, hiddenCount);
}

function groupAndAggregateEvents() {
  const groupedEvents = [];
  const tickets = {};

  db.sales.forEach((sale) => {
    if (sale.ticket_id) {
      if (!tickets[sale.ticket_id]) {
        tickets[sale.ticket_id] = {
          type: "ticket",
          ticket_id: sale.ticket_id,
          date: sale.date,
          items: [],
          total: 0,
          pos_name: sale.pos_name || "",
          has_returns: false,
        };
        groupedEvents.push(tickets[sale.ticket_id]);
      }
      tickets[sale.ticket_id].items.push(sale);

      if (sale.type !== "return") {
        tickets[sale.ticket_id].total += sale.total;
      } else {
        tickets[sale.ticket_id].has_returns = true;
      }
    } else {
      groupedEvents.push({ ...sale, type: sale.type || "sale" });
    }
  });

  db.supplies.forEach((sup) => {
    groupedEvents.push({ ...sup, type: "supply" });
  });

  return groupedEvents;
}

function applyFilters(groupedEvents) {
  let filteredEvents = groupedEvents;

  if (historyFilter !== "all") {
    filteredEvents = filteredEvents.filter((e) => matchesHistoryFilter(e));
  }

  if (posFilter) {
    filteredEvents = filteredEvents.filter((e) => e.pos_name === posFilter);
  }

  filteredEvents.sort((a, b) => new Date(b.date) - new Date(a.date));

  // 30 days filter
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  const withinRange = filteredEvents.filter((e) => new Date(e.date) >= cutoff);

  const hiddenCount = filteredEvents.length - withinRange.length;

  return {
    events: showAllHistory ? filteredEvents : withinRange,
    hiddenCount,
  };
}

function matchesHistoryFilter(event) {
  if (historyFilter === "sale") {
    return event.type === "sale" || event.type === "ticket";
  }
  if (historyFilter === "returns") {
    return (
      event.type === "return" || (event.type === "ticket" && event.has_returns)
    );
  }
  if (historyFilter === "supply") {
    return event.type === "supply" || event.type === "service_added";
  }
  return event.type === historyFilter;
}

function renderTimelineContent(timeline, filteredEvents, hiddenCount) {
  if (filteredEvents.length === 0 && hiddenCount === 0) {
    renderEmptyState(timeline);
    return;
  }

  if (filteredEvents.length === 0 && hiddenCount > 0) {
    timeline.innerHTML = `
      <p class="no-results">Sin registros en los últimos 90 días.</p>
      <button class="load-all-btn" onclick="toggleShowAllHistory()">
        Ver historial completo (${hiddenCount} registros anteriores)
      </button>
    `;
    return;
  }

  const hasSaleEvents = filteredEvents.some(
    (e) => e.type === "sale" || e.type === "ticket",
  );

  timeline.innerHTML = hasSaleEvents
    ? '<p class="no-results">Toca una venta para registrar una devolución</p>'
    : "";

  filteredEvents.forEach((event) => {
    const eventHtml = buildEventHtml(event);
    timeline.insertAdjacentHTML("beforeend", eventHtml);
  });

  if (!showAllHistory && hiddenCount > 0) {
    appendLoadAllButton(timeline, hiddenCount);
  }
}

function renderEmptyState(timeline) {
  timeline.innerHTML = '<p class="no-results">Sin registros que mostrar</p>';
}

function appendLoadAllButton(timeline, hiddenCount) {
  timeline.insertAdjacentHTML(
    "beforeend",
    `<button class="load-all-btn" onclick="toggleShowAllHistory()">
			Ver historial completo (${hiddenCount} registros anteriores)
		</button>`,
  );
}

function buildEventHtml(event) {
  const date = formatDateWithTime(event.date);
  const { icon, amountClass, symbol } = getEventTypeStyles(event);
  const totalDisplay = calculateTotalDisplay(event);
  const contentHtml = buildEventContent(event, totalDisplay);
  const itemActionHtml = getEventClickHandler(event);

  return `
<div class="timeline-item" ${itemActionHtml}>
	<div class="timeline-icon">
		<img src="./assets/icons/${icon}">
	</div>
	<div class="timeline-item-content">
		${contentHtml}
		<div class="timeline-details">
			${
        event.type === "service_added"
          ? `<strong class="timeline-amount type-service">Nuevo servicio</strong>`
          : `<strong class="timeline-amount ${amountClass}">${symbol}$${totalDisplay.toFixed(2)}</strong>`
      }
			<span class="timeline-date">${date}</span>
		</div>
	</div>
</div>`;
}

function getEventTypeStyles(event) {
  const styles = {
    supply: {
      icon: "arrow-circle-down.svg",
      amountClass: "type-supply",
      symbol: "-",
    },
    sale: {
      icon: "arrow-circle-up.svg",
      amountClass: "type-sale",
      symbol: "+",
    },
    return: {
      icon: "arrow-counter-clockwise.svg",
      amountClass: "type-return",
      symbol: "↺ ",
    },
    ticket: {
      icon: "arrow-circle-up.svg",
      amountClass: "type-sale",
      symbol: "+",
    },
    service_added: {
      icon: "call-bell.svg",
      amountClass: "type-service",
      symbol: "",
    },
  };
  return styles[event.type] || styles.sale;
}

function calculateTotalDisplay(event) {
  if (event.type === "ticket") {
    return historyFilter === "returns"
      ? event.items
          .filter((i) => i.type === "return")
          .reduce((acc, curr) => acc + curr.total, 0)
      : event.total;
  }

  if (event.type === "supply") {
    return event.total_cost;
  }

  if (event.type === "service_added") return 0;

  return Math.abs(event.total);
}

function buildEventContent(event, totalDisplay) {
  if (event.type === "ticket") {
    return buildTicketContent(event);
  }

  return buildSimpleEventContent(event);
}

function buildTicketContent(event) {
  const itemsHtml = event.items
    .map((item) => buildTicketItem(item, event.ticket_id))
    .filter((html) => html !== "")
    .join("");

  const posNameHtml = event.pos_name
    ? `<div class="timeline-info-row timeline-pos-name"><span>${event.pos_name}</span></div>`
    : "";
  const descriptionHtml = event.items[0]?.description
    ? `<div class="timeline-info-row">
      <span>Descripción</span>
      <span style="text-align:right; max-width:60%">${event.items[0].description}</span>
    </div>`
    : "";

  return `
<div class="timeline-main">
	<strong>Ticket de Venta</strong>
	<span>${event.items.filter((i) => i.type !== "return").length} ítems</span>
</div>
${posNameHtml}
${descriptionHtml}
<div class="timeline-info-box">
	${itemsHtml}
</div>`;
}

function buildTicketItem(item, ticketId) {
  const isItemReturned = item.type === "return";

  if (historyFilter === "returns" && !isItemReturned) return "";
  if (historyFilter === "sale" && isItemReturned) return "";

  const rowStyle = isItemReturned ? "opacity: 0.8;" : "cursor: pointer;";
  const rowAction = isItemReturned
    ? ""
    : `onclick="handleReturnFromTicket('${item.id}', '${ticketId}')"`;
  const returnBadge = isItemReturned
    ? `<img src="./assets/icons/arrow-counter-clockwise.svg" class="timeline-returned-badge"></img>`
    : "";

  return `
<div class="timeline-info-row" style="${rowStyle}" ${rowAction}>
	<span>${item.product_name} x${item.quantity}  <small>(${item.payment_method || "No asignado"})</small>
   	<span>
		$${item.total.toFixed(2)}
		${returnBadge}
	</span>
</div>`;
}

function buildSimpleEventContent(event) {
  const posNameHtml = event.pos_name
    ? `<div class="timeline-info-row timeline-pos-name"><span>${event.pos_name}</span></div>`
    : "";

  const innerBox = buildInnerBox(event);

  return `
<div class="timeline-main">
	<strong>${event.product_name}</strong>
	<span>${event.quantity} u</span>
</div>
${posNameHtml}
${innerBox}`;
}

function buildInnerBox(event) {
  if (event.type === "service_added") {
    return `
<div class="timeline-info-box">
  <div class="timeline-info-row">
    <span>Servicio añadido al catálogo</span>
  </div>
</div>`;
  }

  if (event.type === "supply") {
    const transportHtml =
      event.transport_cost > 0
        ? `<div class="timeline-info-row"><span>Transporte</span><span>+$${event.transport_cost.toFixed(2)}</span></div>`
        : "";

    return `
<div class="timeline-info-box">
	<div class="timeline-info-row">
		<span>Costo Unitario</span>
		<span>$${event.cost_unit.toFixed(2)}</span>
	</div>
	${transportHtml}
</div>`;
  }

  if (event.type === "return") {
    return `
<div class="timeline-info-box">
	<div class="timeline-info-row">
		<span>Devolución Completa</span>
	</div>
</div>`;
  }

  return `
<div class="timeline-info-box">
  <div class="timeline-info-row">
    <span>Método de Pago</span>
    <span>${event.payment_method || "No asignado"}</span>
  </div>
  ${
    event.description
      ? `<div class="timeline-info-row">
        <span>Descripción</span>
        <span style="text-align:right; max-width: 60%">${event.description}</span>
      </div>`
      : ""
  }
</div>`;
}

function getEventClickHandler(event) {
  if (event.type === "sale") {
    return `onclick="handleReturn('${event.id}')" style="cursor: pointer;"`;
  }
  return "";
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
let posFilter = null;
let showAllHistory = false;

function applyFilter(filter) {
  showAllHistory = false;
  historyFilter = filter;
  posFilter = null;
  const pill = document.getElementById("filter-pill");
  const labels = {
    all: "Todo",
    supply: "Compras",
    sale: "Ventas",
    return: "Devoluciones",
  };
  pill.textContent = labels[historyFilter] || "Todo";

  toggleFilterMenu();
  renderPosFilters();
  renderHistory();
}

function renderPosFilters() {
  const container = document.getElementById("pos-filter-row");
  if (!container) return;
  container.innerHTML = "";

  const posNames = [
    ...new Set(
      db.sales
        .map((s) => s.pos_name)
        .filter((name) => name && name.trim() !== ""),
    ),
  ].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));

  if (posNames.length === 0) return;

  posNames.forEach((name) => {
    const pill = document.createElement("div");
    pill.className = `pos-pill ${posFilter === name ? "active" : ""}`;
    pill.textContent = name;
    pill.onclick = () => applyPosFilter(name);
    container.appendChild(pill);
  });
}

function applyPosFilter(name) {
  showAllHistory = false;
  posFilter = posFilter === name ? null : name;
  historyFilter = "all";
  document.getElementById("filter-pill").textContent = "Todo";
  renderPosFilters();
  renderHistory();
}

function toggleShowAllHistory() {
  showAllHistory = true;
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
  profitEl.style.color = profit >= 0 ? "var(--accent)" : "var(--alert)";

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

  const filteredSales = db.sales
    .filter(filterByDate)
    .filter((sale) => sale.type !== "return");

  const filteredSupplies = db.supplies.filter(filterByDate);

  return {
    income: filteredSales.reduce((sum, s) => sum + s.total, 0),
    investment: filteredSupplies.reduce((sum, s) => sum + s.total_cost, 0),
    inventoryValue: db.products
      .filter((p) => p.type !== "service")
      .reduce((sum, p) => sum + p.stock * p.price, 0),
    filteredSales: filteredSales,
  };
}

// Lists
function renderTopList(containerId, keyType) {
  const list = document.getElementById(containerId);
  if (!list) return;
  list.innerHTML = "";

  const counts = {};

  db.sales
    .filter((s) => s.type !== "return")
    .forEach((s) => {
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

  db.sales
    .filter((s) => s.type !== "return")
    .forEach((sale) => {
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

  db.sales
    .filter((s) => s.type !== "return")
    .forEach((sale) => {
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
function openModal(modalId) {
  document.body.classList.add("modal-open");
  const modal = document.getElementById(modalId);
  modal.querySelector(".modal-content").scrollTop = 0;
  if (modal) modal.classList.add("active");
}

function closeModal(modalId) {
  document.body.classList.remove("modal-open");
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

  history.pushState({ modal: true }, "");
}

function closeAllModals() {
  // Closing normal modals
  document.querySelectorAll(".modal.active").forEach((modal) => {
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
  });

  // Closing modal-ui (alerts, confirms, prompts)
  const modalUi = document.getElementById("modal-ui");
  if (modalUi && modalUi.classList.contains("active")) {
    modalUi.classList.remove("active");
    modalUi._onConfirm = null;
    modalUi._onClose = null;
    modalUi._type = null;
    // Clean schedule
    if (typeof _modalQueue !== "undefined") {
      _modalQueue.length = 0;
      _modalActive = false;
    }
  }

  document.body.classList.remove("modal-open");
}

window.addEventListener("popstate", () => {
  const anyOpen = document.querySelector(".modal.active");
  const uiOpen = document
    .getElementById("modal-ui")
    ?.classList.contains("active");

  if (anyOpen || uiOpen) {
    closeAllModals();
    history.pushState({ modal: false }, "");
  } else {
    switchView(
      "view-home",
      document.querySelector('.nav-item[onclick*="view-home"]'),
    );
  }
});

history.pushState({ modal: false }, "");

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;

  const anyOpen = document.querySelector(".modal.active");
  const uiOpen = document
    .getElementById("modal-ui")
    ?.classList.contains("active");

  if (anyOpen || uiOpen) {
    closeAllModals();
    history.back();
  }
});

let tempTicket = [];

function openSaleModal() {
  haptic();
  tempTicket = [];

  document.getElementById("sale-quantity").value = "";
  document.getElementById("sale-price").value = "";
  document.getElementById("sale-payment-method").selectedIndex = 0;

  const descriptionField = document.getElementById("sale-description");
  if (descriptionField) descriptionField.value = "";

  const hasServices = db.products.some((p) => p.type === "service");
  const filterRow = document.getElementById("sale-services-filter-row");
  const toggle = document.getElementById("sale-services-only-toggle");

  if (filterRow) filterRow.style.display = hasServices ? "flex" : "none";
  const servicesOnly = db.settings.servicesOnly || false;
  if (toggle) toggle.checked = servicesOnly;

  populateSaleSelect(servicesOnly);
  renderTicket();
  openModal("modal-sale");
}

function populateSaleSelect(onlyServices = false) {
  const select = document.getElementById("sale-product-select");
  const label = document.getElementById("sale-product-label");

  select.innerHTML = onlyServices
    ? '<option value="" disabled selected>Selecciona servicio</option>'
    : '<option value="" disabled selected>Selecciona producto o servicio</option>';

  if (label) {
    label.textContent = onlyServices ? "Servicio" : "Producto o servicio";
  }

  const sorted = [...db.products]
    .filter((p) => !onlyServices || p.type === "service")
    .sort((a, b) =>
      a.name.localeCompare(b.name, "es", { sensitivity: "base" }),
    );

  sorted.forEach((product) => {
    const option = document.createElement("option");
    option.value = product.id;
    const isService = product.type === "service";
    option.textContent = isService
      ? product.name
      : `${product.name} (Stock: ${product.stock})`;
    select.appendChild(option);
  });
}

function onSaleServicesToggle(checked) {
  db.settings.servicesOnly = checked;
  saveToStorage();

  document.getElementById("sale-product-select").value = "";
  document.getElementById("sale-price").value = "";
  const stockInfo = document.getElementById("sale-stock-info");
  if (stockInfo) stockInfo.textContent = "";

  populateSaleSelect(checked);
}

function addToTicket() {
  if (!checkPremiumStatus()) {
    openPremiumModal();
    return;
  }

  const productId = document.getElementById("sale-product-select").value;
  const quantity = parseFloat(document.getElementById("sale-quantity").value);
  const method = document.getElementById("sale-payment-method").value;
  const price = parseFloat(document.getElementById("sale-price").value);
  const product = db.products.find((p) => p.id === productId);

  if (!product || isNaN(quantity) || isNaN(price) || quantity <= 0) {
    return showAlert("Por favor, completa los campos correctamente.");
  }

  if (product.type !== "service" && quantity > product.stock) {
    return showAlert(`Stock insuficiente. Disponible: ${product.stock}`);
  }

  tempTicket.push({
    id: product.id,
    name: product.name,
    quantity,
    price,
    total: quantity * price,
    payment_method: method,
    item_type: product.type || "product",
    recipe: product.recipe || [],
  });

  document.getElementById("sale-product-select").value = "";
  document.getElementById("sale-quantity").value = "";
  document.getElementById("sale-price").value = "";

  renderTicket();
}

function renderTicket() {
  const container = document.getElementById("ticket-items-container");
  const totalDisplay = document.getElementById("ticket-total-amount");

  let grandTotal = 0;

  container.innerHTML = "";

  if (tempTicket.length > 0) {
    container.classList.add("active");
    tempTicket.forEach((item, index) => {
      grandTotal += item.total;
      container.innerHTML += `
                <div class="ticket-item">
                    <div class="ticket-item-info">
                        <strong>${item.name}</strong><br>
                        <small>${item.quantity} x $${item.price.toFixed(2)} — ${item.payment_method}</small>
                    </div>
                    <div class="ticket-item-actions">
                        <strong>$${item.total.toFixed(2)}</strong>
                        <button class="btn-remove" onclick="removeFromTicket(${index})" type="button">
                            <img src="./assets/icons/x-circle-fill.svg" class="icon-remove">
                        </button>
                    </div>
                </div>
            `;
    });
  } else {
    container.classList.remove("active");

    const qty = parseInt(document.getElementById("sale-quantity").value) || 0;
    const price = parseFloat(document.getElementById("sale-price").value) || 0;

    if (document.getElementById("sale-product-select").value) {
      grandTotal = qty * price;
    }
  }

  totalDisplay.textContent = `$${grandTotal.toFixed(2)}`;
}

function removeFromTicket(index) {
  tempTicket.splice(index, 1);
  renderTicket();
}

function handleSaleSubmit() {
  const productId = document.getElementById("sale-product-select").value;
  const quantity = parseFloat(document.getElementById("sale-quantity").value);
  const price = parseFloat(document.getElementById("sale-price").value);
  const method = document.getElementById("sale-payment-method").value;
  const description = document.getElementById("sale-description").value.trim();
  const ticketContainer = document.getElementById("ticket-items-container");

  if (
    tempTicket.length === 0 &&
    productId &&
    !isNaN(quantity) &&
    !isNaN(price)
  ) {
    const product = db.products.find((p) => p.id === productId);
    if (product && (product.type === "service" || quantity <= product.stock)) {
      tempTicket.push({
        id: product.id,
        name: product.name,
        quantity: quantity,
        price: price,
        total: quantity * price,
        payment_method: method,
        item_type: product.type || "product",
        recipe: product.recipe || [],
      });
    }
  }

  if (tempTicket.length === 0) return showAlert("El ticket está vacío.");

  const saleGroupId = tempTicket.length > 1 ? `ticket-${Date.now()}` : null;
  let hadStockShortage = false;
  const shortageNames = [];

  tempTicket.forEach((item) => {
    const product = db.products.find((p) => p.id === item.id);
    let totalCostOfSale = 0;

    if (item.item_type === "service") {
      (item.recipe || []).forEach((ingredient) => {
        const material = db.products.find(
          (p) => p.id === ingredient.product_id,
        );
        if (!material) return;

        const needed = ingredient.quantity * item.quantity;

        if (!material.batches || material.batches.length === 0) {
          material.batches = [
            { quantity: material.stock, cost: material.price / 1.3 },
          ];
        }

        let remaining = needed;
        while (remaining > 0 && material.batches.length > 0) {
          const batch = material.batches[0];
          const consume = Math.min(batch.quantity, remaining);
          totalCostOfSale += consume * batch.cost;
          batch.quantity -= consume;
          remaining -= consume;
          if (batch.quantity <= 0) material.batches.shift();
        }

        if (remaining > 0) {
          hadStockShortage = true;
          if (!shortageNames.includes(material.name))
            shortageNames.push(material.name);
        }

        material.stock = Math.max(0, material.stock - (needed - remaining));
      });
    } else {
      if (!product.batches || product.batches.length === 0) {
        product.batches = [
          { quantity: product.stock, cost: product.price / 1.3 },
        ];
      }

      let remaining = item.quantity;
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

      product.stock -= item.quantity;
      product.price = item.price;
    }

    db.sales.push({
      id: generateId("sale"),
      ticket_id: saleGroupId,
      product_id: product.id,
      product_name: product.name,
      quantity: item.quantity,
      price_at_sale: item.price,
      total: item.total,
      acquisition_cost_total: totalCostOfSale,
      payment_method: item.payment_method,
      date: new Date().toISOString(),
      type: "sale",
      item_type: item.item_type,
      description,
    });
  });

  if (hadStockShortage) {
    saveToStorage();
    renderDashboard();
    renderInventory();
    renderHistory();
    ticketContainer.classList.remove("active");
    closeModal("modal-sale");
    showToast("Venta registrada con éxito.");
    setTimeout(() => {
      showAlert(
        `Stock insuficiente en: ${shortageNames.join(", ")}.\n\nEl costo de esos materiales se registró como $0.00. Registra una nueva compra para reponer el inventario.`,
      );
    }, 150);
    return;
  }

  ticketContainer.classList.remove("active");

  tempTicket.forEach((item) => {
    const product = db.products.find((p) => p.id === item.id);
    if (product && item.item_type !== "service") checkLowStockToast(product);
  });

  saveToStorage();
  renderDashboard();
  renderInventory();
  renderHistory();
  closeModal("modal-sale");
  showToast("Venta registrada con éxito.");
}

// Update sale price at selling
document
  .getElementById("sale-product-select")
  .addEventListener("change", (e) => {
    const productId = e.target.value;
    const product = db.products.find((p) => p.id === productId);
    if (!product) return;

    document.getElementById("sale-price").value = product.price;

    const unit = db.settings.serviceUnit || "sesión";
  });

function updateSuggestedPrice() {
  const cost = parseFloat(document.getElementById("supply-cost").value) || 0;
  const transport =
    parseFloat(document.getElementById("supply-transport").value) || 0;
  const realCost = cost + transport;
  if (realCost > 0) {
    document.getElementById("supply-suggested-price").value = (
      realCost * 1.3
    ).toFixed(2);
  }
}

let tempRecipe = [];
let tempEditRecipe = [];
let tempSupplyTicket = [];

function openSupplyModal() {
  haptic();
  tempRecipe = [];
  tempSupplyTicket = [];

  const typeSelect = document.getElementById("supply-type-select");
  if (typeSelect) {
    typeSelect.disabled = false;
    typeSelect.style.opacity = "";
  }
  const productCategory = document.getElementById("product-category");
  if (productCategory) {
    productCategory.disabled = false;
    productCategory.style.opacity = "";
  }

  const fieldsToClear = [
    "supply-product-input",
    "supply-suggested-price",
    "supply-service-price",
    "supply-quantity",
    "supply-cost",
    "supply-transport",
  ];
  fieldsToClear.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  document.getElementById("supply-type-select").value = "product";
  onSupplyTypeChange("product");
  renderSupplyTicket();

  const dataList = document.getElementById("product-list");
  dataList.innerHTML = "";
  db.products
    .filter((p) => p.type !== "service")
    .sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }))
    .forEach((product) => {
      const option = document.createElement("option");
      option.value = product.name;
      dataList.appendChild(option);
    });

  populateCategorySelect("product-category");
  openModal("modal-supply");
}

function onSupplyTypeChange(type) {
  const productFields = document.getElementById("supply-product-fields");
  const serviceFields = document.getElementById("supply-service-fields");
  const unit = db.settings.serviceUnit || "sesión";

  const nameLabel = document.getElementById("supply-name-label");
  const nameInput = document.getElementById("supply-product-input");

  if (type === "service") {
    productFields.style.display = "none";
    serviceFields.style.display = "block";
    document.getElementById("service-price-label").textContent =
      `Precio por ${unit}`;

    // Change to service texts
    if (nameLabel) nameLabel.textContent = "Nombre del servicio";
    if (nameInput) nameInput.placeholder = "Ej: Plato, manicura o pelado";

    const recipeSelect = document.getElementById("recipe-product-select");
    recipeSelect.innerHTML = '<option value="">Seleccionar...</option>';
    db.products
      .filter((p) => p.type !== "service")
      .sort((a, b) =>
        a.name.localeCompare(b.name, "es", { sensitivity: "base" }),
      )
      .forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = `${p.name} (${p.stock} u)`;
        recipeSelect.appendChild(opt);
      });
    renderRecipeList("recipe-list", tempRecipe, "removeFromRecipe");
  } else {
    productFields.style.display = "block";
    serviceFields.style.display = "none";

    // Change to product texts
    if (nameLabel) nameLabel.textContent = "Nombre del producto";
    if (nameInput) nameInput.placeholder = "Ej: Spaguetti Ovella 500gr";
  }
}

function addIngredientToRecipe(recipeArray, selectId, quantityId, onUpdate) {
  if (!checkPremiumStatus()) {
    openPremiumModal();
    return;
  }

  const productId = document.getElementById(selectId).value;
  const quantity = parseFloat(document.getElementById(quantityId).value);

  if (!productId) return showAlert("Selecciona un producto.");
  if (isNaN(quantity) || quantity <= 0)
    return showAlert("Introduce una cantidad válida.");

  const product = db.products.find((p) => p.id === productId);
  if (!product) return;

  const existing = recipeArray.find((r) => r.product_id === productId);
  if (existing) {
    existing.quantity = quantity;
  } else {
    recipeArray.push({
      product_id: product.id,
      product_name: product.name,
      quantity,
    });
  }

  document.getElementById(selectId).value = "";
  document.getElementById(quantityId).value = "";
  onUpdate();
}

function removeFromRecipe(productId) {
  tempRecipe = tempRecipe.filter((r) => r.product_id !== productId);
  renderRecipeList("recipe-list", tempRecipe, "removeFromRecipe");
}

document
  .getElementById("btn-add-recipe-ingredient")
  .addEventListener("click", () => {
    addIngredientToRecipe(
      tempRecipe,
      "recipe-product-select",
      "recipe-quantity",
      () => renderRecipeList("recipe-list", tempRecipe, "removeFromRecipe"),
    );
  });

document
  .getElementById("btn-add-edit-recipe-ingredient")
  .addEventListener("click", () => {
    addIngredientToRecipe(
      tempEditRecipe,
      "edit-recipe-product-select",
      "edit-recipe-quantity",
      () =>
        renderRecipeList(
          "edit-recipe-list",
          tempEditRecipe,
          "removeFromEditRecipe",
        ),
    );
  });

function renderRecipeList(containerId, recipeArray, removeFnName) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = "";

  if (recipeArray.length === 0) {
    container.classList.remove("active");
    return;
  }

  container.classList.add("active");

  recipeArray.forEach((item) => {
    container.insertAdjacentHTML(
      "beforeend",
      `<div class="ticket-item">
        <div class="ticket-item-info">
          <span>${item.product_name} <strong>×${item.quantity}</strong></span>
        </div>
        <div class="ticket-item-actions">
          <button type="button" class="btn-remove" data-product-id="${item.product_id}" data-remove-fn="${removeFnName}">
            <img src="./assets/icons/x-circle-fill.svg" class="icon-remove">
          </button>
        </div>
      </div>`,
    );
  });

  container.querySelectorAll(".btn-remove[data-remove-fn]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const productId = btn.dataset.productId;
      const fnName = btn.dataset.removeFn;
      if (fnName === "removeFromRecipe") removeFromRecipe(productId);
      else if (fnName === "removeFromEditRecipe")
        removeFromEditRecipe(productId);
    });
  });
}

function addToSupplyTicket() {
  if (!checkPremiumStatus()) {
    openPremiumModal();
    return;
  }

  const name = document.getElementById("supply-product-input").value.trim();
  const category = document.getElementById("product-category").value;
  const quantity = parseInt(document.getElementById("supply-quantity").value);
  const cost = parseFloat(document.getElementById("supply-cost").value);
  const suggestedPrice =
    parseFloat(document.getElementById("supply-suggested-price").value) || 0;

  if (!name) return showAlert("El nombre es obligatorio.");
  if (isNaN(quantity) || quantity <= 0)
    return showAlert("Introduce una cantidad válida.");
  if (isNaN(cost) || cost < 0) return showAlert("Introduce un costo válido.");

  tempSupplyTicket.push({ name, category, quantity, cost, suggestedPrice });

  document.getElementById("supply-product-input").value = "";
  document.getElementById("supply-quantity").value = "";
  document.getElementById("supply-cost").value = "";
  document.getElementById("supply-suggested-price").value = "";

  renderSupplyTicket();
}

function removeFromSupplyTicket(index) {
  tempSupplyTicket.splice(index, 1);
  renderSupplyTicket();
}

function renderSupplyTicket() {
  const container = document.getElementById("supply-ticket-items-container");
  const transportLabel = document.getElementById("supply-transport-label");
  if (!container) return;

  container.innerHTML = "";

  if (tempSupplyTicket.length > 0) {
    container.classList.add("active");
    tempSupplyTicket.forEach((item, index) => {
      container.innerHTML += `
                <div class="ticket-item">
                    <div class="ticket-item-info">
                        <strong>${item.name}</strong><br>
                        <small>${item.quantity} u x $${item.cost.toFixed(2)}</small>
                    </div>
                    <div class="ticket-item-actions">
                        <strong>$${(item.quantity * item.cost).toFixed(2)}</strong>
                        <button class="btn-remove" onclick="removeFromSupplyTicket(${index})" type="button">
                            <img src="./assets/icons/x-circle-fill.svg" class="icon-remove">
                        </button>
                    </div>
                </div>
            `;
    });
  } else {
    container.classList.remove("active");
  }

  if (transportLabel) {
    transportLabel.textContent =
      tempSupplyTicket.length >= 1 ? "Transp. (Lote)" : "Transp. (Unidad)";
  }
}

function processSupplyLine(line, transportPerUnit) {
  const realUnitCost = line.cost + transportPerUnit;
  const totalAcquisition = realUnitCost * line.quantity;

  let existingItem = db.products.find(
    (p) =>
      p.name.toLowerCase() === line.name.toLowerCase() &&
      (p.type || "product") === "product",
  );

  if (existingItem) {
    if (!existingItem.batches) existingItem.batches = [];
    existingItem.batches.push({ quantity: line.quantity, cost: realUnitCost });
    existingItem.stock += line.quantity;
    existingItem.category = line.category;
    if (line.suggestedPrice > 0) existingItem.price = line.suggestedPrice;
  } else {
    const finalPrice =
      line.suggestedPrice > 0 ? line.suggestedPrice : realUnitCost * 1.3;
    existingItem = {
      id: generateId("prod"),
      name: line.name,
      category: line.category,
      price: finalPrice,
      stock: line.quantity,
      type: "product",
      batches: [{ quantity: line.quantity, cost: realUnitCost }],
    };
    db.products.push(existingItem);
  }

  db.supplies.push({
    id: generateId("sup"),
    product_id: existingItem.id,
    product_name: existingItem.name,
    quantity: line.quantity,
    cost_unit: line.cost,
    transport_cost: transportPerUnit,
    total_cost: totalAcquisition,
    date: new Date().toISOString(),
    type: "purchase",
  });
}

function handleSupplySubmit(event) {
  event.preventDefault();

  const type = document.getElementById("supply-type-select").value;
  const name = document.getElementById("supply-product-input").value.trim();
  const category = document.getElementById("product-category").value;

  const isBatchMode = type === "product" && tempSupplyTicket.length > 0;

  if (!isBatchMode && !name) return showAlert("El nombre es obligatorio.");

  if (!checkPremiumStatus() && db.products.length >= 5) {
    showAlert(
      "Versión gratuita limitada a 5 ítems.\nActiva Premium para desbloquear capacidad ilimitada.",
    );
    openPremiumModal();
    return;
  }

  const currentType = document.getElementById("supply-type-select").value;

  let existingItem = db.products.find(
    (p) =>
      p.name.toLowerCase() === name.toLowerCase() &&
      (p.type || "product") === currentType,
  );

  if (type === "service") {
    const price = parseFloat(
      document.getElementById("supply-service-price").value,
    );
    if (isNaN(price) || price <= 0)
      return showAlert("Introduce un precio válido.");

    if (existingItem) {
      existingItem.category = category;
      existingItem.price = price;
      existingItem.recipe = [...tempRecipe];
      existingItem.type = "service";
    } else {
      db.products.push({
        id: `serv-${Date.now()}`,
        name: name,
        category: category,
        price: price,
        type: "service",
        recipe: [...tempRecipe],
      });
    }

    if (!existingItem) {
      db.supplies.push({
        id: generateId("svc-add"),
        product_id: db.products[db.products.length - 1].id,
        product_name: name,
        quantity: 0,
        cost_unit: 0,
        transport_cost: 0,
        total_cost: 0,
        date: new Date().toISOString(),
        type: "service_added",
      });
    }

    showToast("Servicio guardado con éxito.");
  } else if (isBatchMode) {
    // Lote: el campo de transporte es el TOTAL del envío, se reparte
    // proporcionalmente entre todas las unidades de todos los productos.
    const transportTotal =
      parseFloat(document.getElementById("supply-transport").value) || 0;
    const totalUnits = tempSupplyTicket.reduce(
      (sum, line) => sum + line.quantity,
      0,
    );
    const transportPerUnit = totalUnits > 0 ? transportTotal / totalUnits : 0;

    tempSupplyTicket.forEach((line) =>
      processSupplyLine(line, transportPerUnit),
    );
    tempSupplyTicket = [];
    renderSupplyTicket();

    showToast("Lote de compras registrado con éxito.");
  } else {
    const quantity = parseInt(document.getElementById("supply-quantity").value);
    const cost = parseFloat(document.getElementById("supply-cost").value);
    const transport =
      parseFloat(document.getElementById("supply-transport").value) || 0;

    if (isNaN(quantity) || quantity <= 0)
      return showAlert("Introduce una cantidad válida.");
    if (isNaN(cost) || cost < 0) return showAlert("Introduce un costo válido.");

    const suggestedPrice =
      parseFloat(document.getElementById("supply-suggested-price").value) || 0;

    processSupplyLine(
      { name, category, quantity, cost, suggestedPrice },
      transport,
    );
    showToast("Compra registrada con éxito.");
  }

  saveToStorage();
  renderDashboard();
  renderInventory();
  closeModal("modal-supply");
}

document
  .getElementById("supply-product-input")
  .addEventListener("input", (e) => {
    const name = e.target.value.trim().toLowerCase();
    const existingProduct = db.products.find(
      (p) => p.name.toLowerCase() === name,
    );
    const categorySelect = document.getElementById("product-category");
    const typeSelect = document.getElementById("supply-type-select");

    if (existingProduct) {
      categorySelect.value = existingProduct.category;
      categorySelect.disabled = true;
      categorySelect.style.opacity = "0.7";

      typeSelect.value = existingProduct.type || "product";
      typeSelect.disabled = true;
      typeSelect.style.opacity = "0.7";
      onSupplyTypeChange(typeSelect.value);
    } else {
      categorySelect.disabled = false;
      categorySelect.style.opacity = "1";
      typeSelect.disabled = false;
      typeSelect.style.opacity = "1";
    }
  });

function removeFromEditRecipe(productId) {
  tempEditRecipe = tempEditRecipe.filter((r) => r.product_id !== productId);
  renderRecipeList("edit-recipe-list", tempEditRecipe, "removeFromEditRecipe");
}

function openEditModal(productId) {
  const product = db.products.find((p) => p.id === productId);
  if (!product) return;

  const isService = product.type === "service";
  const unit = db.settings.serviceUnit || "sesión";

  populateCategorySelect("edit-product-category");

  document.getElementById("edit-product-id").value = product.id;
  document.getElementById("edit-product-type").value =
    product.type || "product";
  document.getElementById("edit-product-name").value = product.name;
  document.getElementById("edit-product-category").value = product.category;
  document.getElementById("edit-modal-title").textContent = isService
    ? "Editar Servicio"
    : "Editar Producto";
  document.getElementById("edit-name-label").textContent = isService
    ? "Nombre del servicio"
    : "Nombre del producto";

  const shareBtn = document.getElementById("btn-share-product");
  shareBtn.style.display = isService ? "none" : "";
  shareBtn.onclick = () => shareProduct(productId);

  const productFields = document.getElementById("edit-product-only-fields");
  const serviceFields = document.getElementById("edit-service-only-fields");

  if (isService) {
    productFields.style.display = "none";
    serviceFields.style.display = "block";
    document.getElementById("edit-service-price-label").textContent =
      `Precio por ${unit}`;
    document.getElementById("edit-service-price").value = product.price;

    tempEditRecipe = product.recipe ? [...product.recipe] : [];

    const recipeSelect = document.getElementById("edit-recipe-product-select");
    recipeSelect.innerHTML = '<option value="">Seleccionar...</option>';
    db.products
      .filter((p) => p.type !== "service")
      .sort((a, b) =>
        a.name.localeCompare(b.name, "es", { sensitivity: "base" }),
      )
      .forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = `${p.name} (${p.stock} u)`;
        recipeSelect.appendChild(opt);
      });

    renderRecipeList(
      "edit-recipe-list",
      tempEditRecipe,
      "removeFromEditRecipe",
    );
  } else {
    productFields.style.display = "block";
    serviceFields.style.display = "none";

    let avgCost = 0;
    if (product.batches && product.batches.length > 0) {
      const totalValue = product.batches.reduce(
        (sum, b) => sum + b.quantity * b.cost,
        0,
      );
      const totalQuantity = product.batches.reduce(
        (sum, b) => sum + b.quantity,
        0,
      );
      avgCost = totalQuantity > 0 ? totalValue / totalQuantity : 0;
    }

    document.getElementById("edit-avg-cost").textContent =
      `$${avgCost.toFixed(2)}`;
    document.getElementById("edit-product-price").value = product.price;
    document.getElementById("edit-product-stock").value = product.stock;

    const generalThreshold = db.settings ? db.settings.stockThreshold : 5;
    const thresholdInput = document.getElementById("edit-product-threshold");
    thresholdInput.value =
      product.threshold !== undefined && product.threshold !== generalThreshold
        ? product.threshold
        : "";
  }

  openModal("modal-edit");
}

function handleEditSubmit(event) {
  event.preventDefault();

  const id = document.getElementById("edit-product-id").value;
  const type = document.getElementById("edit-product-type").value;
  const product = db.products.find((p) => p.id === id);
  if (!product) return;

  product.name = document.getElementById("edit-product-name").value;
  product.category = document.getElementById("edit-product-category").value;

  if (type === "service") {
    product.price = parseFloat(
      document.getElementById("edit-service-price").value,
    );
    product.recipe = [...tempEditRecipe];
  } else {
    product.price = parseFloat(
      document.getElementById("edit-product-price").value,
    );
    product.stock = parseFloat(
      document.getElementById("edit-product-stock").value,
    );

    const generalThreshold = db.settings ? db.settings.stockThreshold : 5;
    const customThreshold = document.getElementById(
      "edit-product-threshold",
    ).value;
    const parsedThreshold = parseInt(customThreshold);

    if (customThreshold === "" || isNaN(parsedThreshold)) {
      delete product.threshold;
    } else if (parsedThreshold === generalThreshold) {
      delete product.threshold;
    } else {
      product.threshold = parsedThreshold;
    }

    checkLowStockToast(product);
  }

  saveToStorage();
  inventoryFilter = null;
  renderInventory();
  closeModal("modal-edit");
}

function shareProduct(productId) {
  const product = db.products.find((p) => p.id === productId);
  if (!product) return;

  const singleProductData = {
    products: [
      {
        id: product.id,
        name: product.name,
        category: product.category,
        price: product.price,
        stock: product.stock,
        type: product.type || "product",
        recipe: product.recipe || [],
        threshold: product.threshold,
      },
    ],
    categories: [product.category],
  };

  const fileName = `producto_${product.name.replace(/\s+/g, "_")}.json`;
  const jsonString = JSON.stringify(singleProductData);

  const file = new File([jsonString], fileName, { type: "text/plain" });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator
      .share({
        files: [file],
        title: "Producto para SELY",
        text: "Nuevo producto para el inventario de SELY",
      })
      .catch((error) => {
        console.error("Error al compartir:", error);
        fallbackDownload(jsonString, fileName);
      });
  } else {
    fallbackDownload(jsonString, fileName);
  }
}

function fallbackDownload(content, fileName) {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function handleDeleteProduct() {
  const id = document.getElementById("edit-product-id").value;
  const product = db.products.find((p) => p.id === id);

  showConfirm(
    `¿Estás seguro de que quieres eliminar "${product.name}"? Esta acción no se puede deshacer.`,
    () => {
      db.products = db.products.filter((p) => p.id !== id);
      saveToStorage();
      inventoryFilter = null;
      renderInventory();
      closeModal("modal-edit");
    },
    true,
  );
}

function handleReturn(saleId) {
  const sale = db.sales.find((s) => s.id === saleId);
  if (!sale) return;
  if (sale.type === "return") {
    showAlert("Esta venta ya fue devuelta.");
    return;
  }

  showConfirm(
    `¿Confirmar devolución de ${sale.quantity} u de "${sale.product_name}"?\nSe revertirá el stock y se marcará como devuelta.`,
    () => {
      const product = db.products.find((p) => p.id === sale.product_id);
      if (product) {
        product.stock += sale.quantity;

        if (!product.batches) product.batches = [];
        const unitCost =
          sale.quantity > 0
            ? sale.acquisition_cost_total / sale.quantity
            : product.price / 1.3;
        product.batches.unshift({ quantity: sale.quantity, cost: unitCost });
      }

      sale.type = "return";
      sale.return_date = new Date().toISOString();

      saveToStorage();
      renderDashboard();
      renderInventory();
      renderHistory();
      showToast(`Venta devuelta con éxito`);
    },
    true,
  );
}

function handleReturnFromTicket(saleId, ticketId) {
  const sale = db.sales.find((s) => s.id === saleId);
  if (!sale) return;
  if (sale.type === "return") {
    showAlert("Este ítem ya fue devuelto.");
    return;
  }

  showConfirm(
    `¿Devolver ${sale.quantity} u de "${sale.product_name}" del ticket?`,
    () => {
      const product = db.products.find((p) => p.id === sale.product_id);
      if (product) {
        product.stock += sale.quantity;

        if (!product.batches) product.batches = [];
        const unitCost =
          sale.quantity > 0
            ? sale.acquisition_cost_total / sale.quantity
            : product.price / 1.3;
        product.batches.unshift({ quantity: sale.quantity, cost: unitCost });
      }

      sale.type = "return";
      sale.return_date = new Date().toISOString();

      saveToStorage();
      renderDashboard();
      renderInventory();
      renderHistory();
      showToast(`Ítem devuelto con éxito`);
    },
    true,
  );
}

// Settings
function updateThreshold(val) {
  db.settings.stockThreshold = parseInt(val);
  saveToStorage();
}
function updateServiceUnit(val) {
  db.settings.serviceUnit = val.trim() || "sesión";
  saveToStorage();
}

function renderSettings() {
  const container = document.getElementById("categories-list");
  const thresholdInput = document.getElementById("setting-stock-threshold");

  container.innerHTML = "";
  thresholdInput.value = db.settings.stockThreshold;
  document.getElementById("setting-service-unit").value =
    db.settings.serviceUnit || "sesión";
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
  showPrompt("Nombre de la nueva categoría:", "Ej: Bebidas", (name) => {
    if (name && !db.categories.includes(name.trim())) {
      db.categories.push(name.trim());
      saveToStorage();
      renderSettings();
      renderInventory();
    }
  });
}

function removeCategory(name) {
  if (db.categories.length <= 1)
    return showAlert("Debes tener al menos una categoría.");
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

      const isFullBackup = imported.app === "STOX";

      if (imported.products) {
        imported.products.forEach((newP) => {
          let existingP = db.products.find((p) => p.id === newP.id);
          if (existingP) {
            if (isFullBackup) {
              existingP.stock = newP.stock;
              existingP.batches = newP.batches || [];
            }

            existingP.name = newP.name;
            existingP.price = newP.price;
            existingP.category = newP.category;
            existingP.type = newP.type || "product";
            existingP.recipe = newP.recipe || [];
            if (newP.threshold !== undefined)
              existingP.threshold = newP.threshold;
          } else {
            db.products.push(newP);
          }
        });
      }

      if (imported.sales) {
        const existingSaleIds = new Set(db.sales.map((s) => s.id));

        imported.sales.forEach((sale) => {
          if (!existingSaleIds.has(sale.id)) {
            const product = db.products.find((p) => p.id === sale.product_id);

            if (!isFullBackup && product) {
              if (product.batches && product.batches.length > 0) {
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
              } else {
                sale.acquisition_cost_total =
                  (product.price / 1.3) * sale.quantity;
              }

              product.stock -= sale.quantity;
            }

            db.sales.push(sale);
          }
        });
      }

      // Only for backups
      if (imported.supplies) {
        const existingSupplyIds = new Set(db.supplies.map((s) => s.id));
        const newSupplies = imported.supplies.filter(
          (s) => !existingSupplyIds.has(s.id),
        );
        db.supplies.push(...newSupplies);
      }

      if (imported.categories && Array.isArray(imported.categories)) {
        db.categories = [
          ...new Set(["General", ...db.categories, ...imported.categories]),
        ];
      }

      saveToStorage();
      renderInventory();
      renderDashboard();
      showToast("Sincronización completada con éxito.");
    } catch (err) {
      console.error("Error al parsear el JSON:", err);
      showAlert("Error: El archivo no es válido o está corrupto.");
    }
  };
  reader.readAsText(file);
}

// Exporting data
function exportData() {
  if (checkPremiumStatus()) {
    saveToStorage();

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
    openPremiumModal();
  }
}

function exportDataForSely() {
  if (!checkPremiumStatus()) {
    openPremiumModal();
    return;
  }

  const selyDB = {
    products: db.products.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      price: p.price,
      stock: p.stock,
      type: p.type || "product",
      recipe: p.recipe || [],
      threshold: p.threshold,
    })),
    categories: db.categories,
    settings: {
      stockThreshold: db.settings.stockThreshold,
    },
  };

  const fileName = `inventario_stox_${new Date().toISOString().slice(0, 10)}.json`;
  const jsonString = JSON.stringify(selyDB);

  const blob = new Blob([jsonString], { type: "application/json" });

  const file = new File([jsonString], fileName, { type: "text/plain" });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator
      .share({
        files: [file],
        title: "Datos para SELY",
        text: "Inventario para la app SELY",
      })
      .catch(() => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
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
    app: "STOX",
    products: [],
    sales: [],
    supplies: [],
    categories: ["General"],
    settings: { stockThreshold: 5, serviceUnit: "sesión", servicesOnly: false },
  };

  if (db.settings.servicesOnly === undefined) db.settings.servicesOnly = false; // To Delete

  if (stored) {
    const parsed = JSON.parse(stored);
    db = { ...defaultDB, ...parsed };
  } else {
    db = defaultDB;
  }

  cloudEnabled = localStorage.getItem("stox_cloud_enabled") === "true";
  currentManagerId = localStorage.getItem("stox_manager_id") || null;
  currentLinkCode = localStorage.getItem("stox_link_code") || null;
  updateCloudUI();
}

function saveToStorage() {
  localStorage.setItem("stox_db", JSON.stringify(db));
  uploadInventoryToCloud();
}

function clearDatabase() {
  showConfirm(
    "¿ESTÁS SEGURO?\nEsta acción borrará absolutamente todos tus datos, productos, ventas y categorías. No se puede deshacer.",
    () => {
      setTimeout(() => {
        showPrompt(
          "Escribe 'BORRAR' en mayúsculas para confirmar:",
          "BORRAR",
          (value) => {
            if (value === "BORRAR") {
              db = {
                products: [],
                sales: [],
                supplies: [],
                categories: ["General"],
                settings: { stockThreshold: 5 },
              };

              localStorage.removeItem("stox_db");
              localStorage.removeItem("stox_cloud_enabled");
              localStorage.removeItem("stox_manager_id");
              localStorage.removeItem("stox_link_code");
              localStorage.removeItem("stox_last_sync");
              localStorage.removeItem("stox_premium");
              localStorage.removeItem("stox_session_token");
              cloudEnabled = false;
              currentManagerId = null;
              currentLinkCode = null;
              location.reload();
            } else {
              setTimeout(() => {
                showAlert("Operación cancelada. El texto no coincide.");
              }, 150);
            }
          },
        );
      }, 150);
    },
    true,
  );
}

// Account & Cloud
let cloudEnabled = false;
let currentManagerId = null;
let currentLinkCode = null;

function copyLinkCode() {
  if (!currentLinkCode) return;
  navigator.clipboard
    .writeText(currentLinkCode)
    .then(() => showToast("Código copiado al portapapeles."))
    .catch(() => showToast("No se pudo copiar. Cópialo manualmente.", "error"));
}

function openPremiumModal() {
  const loggedIn = document.getElementById("auth-logged-in");
  const tabs = document.getElementById("auth-tabs");
  const loginForm = document.getElementById("auth-login-form");
  const registerForm = document.getElementById("auth-register-form");

  if (cloudEnabled && currentManagerId) {
    if (loggedIn) loggedIn.style.display = "block";
    if (tabs) tabs.style.display = "none";
    if (loginForm) loginForm.style.display = "none";
    if (registerForm) registerForm.style.display = "none";
  } else {
    if (loggedIn) loggedIn.style.display = "none";
    if (tabs) tabs.style.display = "flex";
    switchAuthTab("login");
  }

  openModal("modal-premium");
}

function switchAuthTab(tab) {
  const loginForm = document.getElementById("auth-login-form");
  const registerForm = document.getElementById("auth-register-form");
  const tabLogin = document.getElementById("tab-login");
  const tabRegister = document.getElementById("tab-register");

  if (tab === "login") {
    loginForm.style.display = "block";
    registerForm.style.display = "none";
    tabLogin.classList.add("active");
    tabRegister.classList.remove("active");
  } else {
    loginForm.style.display = "none";
    registerForm.style.display = "block";
    tabLogin.classList.remove("active");
    tabRegister.classList.add("active");
  }
}

async function submitLogin() {
  const email = document
    .getElementById("login-email")
    .value.trim()
    .toLowerCase();
  const password = document.getElementById("login-password").value;

  if (!email || !password) {
    showAlert("Introduce tu correo y contraseña.");
    return;
  }

  try {
    const data = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    await _onLoginSuccess(data);
  } catch (err) {
    console.error("Error login:", err);
    showAlert(err.message || "Error de conexión. Intenta de nuevo.");
  }
}

async function submitRegister() {
  const email = document
    .getElementById("register-email")
    .value.trim()
    .toLowerCase();
  const password = document.getElementById("register-password").value;
  const confirm = document.getElementById("register-password-confirm").value;

  if (!email || !password || !confirm) {
    showAlert("Completa todos los campos.");
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showAlert("Introduce un correo electrónico válido.");
    return;
  }

  if (password.length < 8) {
    showAlert("La contraseña debe tener al menos 8 caracteres.");
    return;
  }

  if (password !== confirm) {
    showAlert("Las contraseñas no coinciden.");
    return;
  }

  try {
    const data = await apiFetch("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    showToast("Cuenta creada. ¡Bienvenido!");
    await _onLoginSuccess(data);
  } catch (err) {
    console.error("Error registro:", err);
    if (err.message && err.message.includes("ya tiene una cuenta")) {
      showAlert(err.message);
      switchAuthTab("login");
    } else {
      showAlert(err.message || "Error de conexión. Intenta de nuevo.");
    }
  }
}

async function _onLoginSuccess(data) {
  currentManagerId = data.managerId;
  currentLinkCode = data.linkCode;

  cloudEnabled = true;
  localStorage.setItem("stox_cloud_enabled", "true");
  localStorage.setItem("stox_manager_id", currentManagerId);
  localStorage.setItem("stox_link_code", currentLinkCode);
  localStorage.setItem("stox_session_token", data.token);

  // Save encrypted premium in case
  _applyPremiumFromCloud(data.premiumActive, data.premiumExpiry);

  closeModal("modal-premium");
  updateCloudUI();
  await restoreFromCloud();
  showToast("Sesión iniciada correctamente.");
}

function _applyPremiumFromCloud(premiumActive, premiumExpiry) {
  if (premiumActive && premiumExpiry) {
    const expiryMs = new Date(premiumExpiry).getTime();
    if (expiryMs > Date.now()) {
      const payload = JSON.stringify({ expiryDate: expiryMs });
      const encrypted = CryptoJS.AES.encrypt(payload, _PK).toString();
      localStorage.setItem("stox_premium", encrypted);
      return;
    }
  }
  // No premium or expired? Clear local
  localStorage.removeItem("stox_premium");
}

function updateCloudUI() {
  const toggle = document.getElementById("cloud-toggle");
  const info = document.getElementById("cloud-info");

  if (!toggle || !info) return;

  toggle.checked = cloudEnabled;

  if (cloudEnabled && currentLinkCode) {
    const lastSync = localStorage.getItem("stox_last_sync");
    const syncText = lastSync
      ? `Última sync: ${formatTimeOnly(lastSync)}`
      : "Aún no sincronizado";
    info.innerHTML = `
  <p class="setting-help">Nube activa. Código de vinculación:</p>
  <div class="link-code-field" onclick="copyLinkCode()">
    <span class="link-code-value">${currentLinkCode}</span>
    <img src="./assets/icons/copy-simple-bold.svg" class="link-code-copy-icon" />
  </div>
  <p class="setting-help">Toca el código para copiarlo y compártelo con tus dependientes en SELY.</p>
  <p class="sync-timestamp">${syncText}</p>
`;
  } else {
    info.innerHTML = "";
  }
}

async function handleCloudToggle(enabled) {
  if (enabled) {
    document.getElementById("cloud-toggle").checked = false;
    openPremiumModal();
  } else {
    disableCloud();
  }
}

function disableCloud() {
  cloudEnabled = false;
  currentManagerId = null;
  currentLinkCode = null;

  localStorage.removeItem("stox_cloud_enabled");
  localStorage.removeItem("stox_manager_id");
  localStorage.removeItem("stox_link_code");
  localStorage.removeItem("stox_session_token");

  updateCloudUI();
}

async function deleteCloudAccount() {
  if (!currentManagerId) {
    showAlert("No hay ninguna cuenta activa en este dispositivo.");
    return;
  }

  showConfirm(
    "¿ESTÁS SEGURO?\nEsta acción eliminará permanentemente tu cuenta y todos tus datos de la nube. No se puede deshacer.",
    () => {
      setTimeout(() => {
        showPrompt(
          "Escribe 'ELIMINAR' en mayúsculas para confirmar:",
          "ELIMINAR",
          async (value) => {
            if (value !== "ELIMINAR") {
              setTimeout(() => {
                showAlert("Operación cancelada. El texto no coincide.");
              }, 150);
              return;
            }
            try {
              await apiFetch("/account/delete", { method: "POST" });

              disableCloud();
              showToast("Cuenta eliminada de la nube con éxito.");
            } catch (err) {
              console.error("Error al eliminar cuenta:", err);
              setTimeout(() => {
                showAlert("Error al eliminar la cuenta. Intenta de nuevo.");
              }, 150);
            }
          },
        );
      }, 150);
    },
    true,
  );
}

async function restoreFromCloud() {
  if (!cloudEnabled || !currentManagerId) return;

  try {
    const { data } = await apiFetch("/sync/download", { method: "GET" });

    if (!data) {
      // Sin backup en la nube: subir lo que hay en local
      await uploadInventoryToCloud();
      return;
    }

    const cloud = data;

    // Local products as a base
    const mergedProducts = [...db.products];

    if (cloud.products && Array.isArray(cloud.products)) {
      cloud.products.forEach((cloudProd) => {
        const existsLocally = mergedProducts.some((p) => p.id === cloudProd.id);
        if (!existsLocally) {
          // Only in cloud? Add it
          mergedProducts.push(cloudProd);
        }
        // Local only? Don't touch
      });
    }

    const localSaleIds = new Set(db.sales.map((s) => s.id));
    const cloudOnlySales =
      cloud.sales && Array.isArray(cloud.sales)
        ? cloud.sales.filter((s) => !localSaleIds.has(s.id))
        : [];
    const mergedSales = [...db.sales, ...cloudOnlySales];

    const localSupplyIds = new Set(db.supplies.map((s) => s.id));
    const cloudOnlySupplies =
      cloud.supplies && Array.isArray(cloud.supplies)
        ? cloud.supplies.filter((s) => !localSupplyIds.has(s.id))
        : [];
    const mergedSupplies = [...db.supplies, ...cloudOnlySupplies];

    const mergedCategories = [
      ...new Set([
        ...db.categories,
        ...(cloud.categories && Array.isArray(cloud.categories)
          ? cloud.categories
          : []),
      ]),
    ];

    db.products = mergedProducts;
    db.sales = mergedSales;
    db.supplies = mergedSupplies;
    db.categories = mergedCategories;

    saveToStorage();
    renderDashboard();
    renderInventory();
    renderHistory();

    await uploadInventoryToCloud();
  } catch (err) {
    console.error("Error:", err);
  }
}

async function checkCloudAccess() {
  if (!cloudEnabled || !currentManagerId) return;

  try {
    const data = await apiFetch("/account/status", { method: "GET" });

    _applyPremiumFromCloud(data.premiumActive, data.premiumExpiry);

    // If premium_active is false, revoque local access
    if (data.premiumActive === false) {
      localStorage.removeItem("stox_premium");
    }
  } catch (err) {
    // No internet o token inválido: ignore
  }
}

async function uploadInventoryToCloud() {
  if (!cloudEnabled || !currentManagerId) return;
  if (db.products.length === 0) return;

  try {
    const payload = {
      products: db.products,
      categories: db.categories,
      settings: db.settings,
      sales: db.sales,
      supplies: db.supplies,
    };

    await apiFetch("/sync/upload", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    localStorage.setItem("stox_last_sync", new Date().toISOString());
    updateCloudUI();
  } catch (err) {
    console.error("Error:", err);
  }
}

async function downloadSalesFromCloud() {
  if (!cloudEnabled || !currentManagerId) return;

  try {
    const { rows } = await apiFetch("/sync/sales", { method: "GET" });

    if (!rows || rows.length === 0) return;

    let newSalesCount = 0;

    rows.forEach((row) => {
      const sales = row.data;

      if (!Array.isArray(sales)) return;

      sales.forEach((sale) => {
        const exists = db.sales.find((s) => s.id === sale.id);

        if (!exists) {
          const product = db.products.find((p) => p.id === sale.product_id);
          if (product) product.stock -= sale.quantity;
          db.sales.push(sale);
          newSalesCount++;
        }
      });
    });

    if (newSalesCount > 0) {
      localStorage.setItem("stox_last_sync", new Date().toISOString());
      saveToStorage();
      renderDashboard();
      renderInventory();
      renderHistory();
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

loadFromStorage();
renderDashboard();

// Premium Locking
const _PK = "stxT8AW!b$SJw6z$CN7a@$vxbGj0sZ";

function checkPremiumStatus() {
  try {
    const stored = localStorage.getItem("stox_premium");
    if (!stored) return false;
    const bytes = CryptoJS.AES.decrypt(stored, _PK);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    if (!decrypted) return false;
    const { expiryDate } = JSON.parse(decrypted);
    if (new Date().getTime() >= expiryDate) {
      localStorage.removeItem("stox_premium");
      return false;
    }
    return true;
  } catch {
    localStorage.removeItem("stox_premium");
    return false;
  }
}

Object.defineProperty(window, "checkPremiumStatus", {
  value: checkPremiumStatus,
  writable: false,
  configurable: false,
});

async function trackProjectActivity(projectName) {
  try {
    await apiFetch("/track", {
      method: "POST",
      body: JSON.stringify({ projectName }),
    });
  } catch (err) {
    console.warn("Offline mode");
  }
}

Promise.race([
  Promise.all([trackProjectActivity("STOX"), checkCloudAccess()]),
  new Promise((resolve) => setTimeout(resolve, 3000)),
]);

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
