function exportDailySummaryPDF(selectedDateStr) {
	if (!checkPremiumStatus()) {
		openPremiumModal();
		return;
	}

	const { jsPDF } = window.jspdf;
	const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

	const pageW = doc.internal.pageSize.getWidth();
	const margin = 14;
	const contentW = pageW - margin * 2;

	// Helpers
	function addHeader(doc, dateStr) {
		doc.setFont("helvetica", "bold");
		doc.setFontSize(18);
		doc.text("STOX", margin, 18);

		doc.setFont("helvetica", "normal");
		doc.setFontSize(9);
		doc.setTextColor(100);
		doc.text("Resumen de actividad diaria", margin, 24);
		doc.text(
			`Generado: ${new Date().toLocaleString("es-ES")}`,
			pageW - margin,
			24,
			{ align: "right" },
		);

		doc.setTextColor(0);
		doc.setFontSize(13);
		doc.setFont("helvetica", "bold");
		doc.text(`Fecha: ${dateStr}`, margin, 33);

		doc.setDrawColor(0);
		doc.setLineWidth(0.5);
		doc.line(margin, 36, pageW - margin, 36);
	}

	function sectionTitle(doc, text, y) {
		doc.setFont("helvetica", "bold");
		doc.setFontSize(11);
		doc.setTextColor(0);
		doc.text(text.toUpperCase(), margin, y);
		doc.setFont("helvetica", "normal");
		doc.setFontSize(10);
		return y + 6;
	}

	// Daily data
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

	// Group sales by POS
	const groups = {};
	salesOfDay.forEach((s) => {
		const key =
			s.pos_name && s.pos_name.trim() !== "" ? s.pos_name : "Este negocio";
		if (!groups[key]) groups[key] = [];
		groups[key].push(s);
	});

	// General
	addHeader(doc, selectedDateStr);

	let y = 44;
	y = sectionTitle(doc, "Resumen del día", y);

	doc.autoTable({
		startY: y,
		margin: { left: margin, right: margin },
		theme: "plain",
		styles: { fontSize: 10, cellPadding: 2 },
		columnStyles: {
			0: { cellWidth: contentW * 0.65 },
			1: { cellWidth: contentW * 0.35, halign: "right", fontStyle: "bold" },
		},
		body: [
			["Total ingresado (ventas)", `$${totalIncome.toFixed(2)}`],
			...(returnsOfDay.length > 0
				? [["Devoluciones", `-$${totalReturns.toFixed(2)}`]]
				: []),
			["Ganancia bruta", `$${totalProfit.toFixed(2)}`],
			...(suppliesOfDay.length > 0
				? [["Total en compras", `-$${totalSuppliesCost.toFixed(2)}`]]
				: []),
		],
	});

	y = doc.lastAutoTable.finalY + 6;

	// By POS
	if (Object.keys(groups).length > 1) {
		y = sectionTitle(doc, "Ingresos por punto de venta", y);
		const posRows = Object.entries(groups).map(([pos, sales]) => {
			const posTotal = sales.reduce((sum, s) => sum + s.total, 0);
			return [pos, `$${posTotal.toFixed(2)}`];
		});
		doc.autoTable({
			startY: y,
			margin: { left: margin, right: margin },
			theme: "striped",
			styles: { fontSize: 10, cellPadding: 2 },
			headStyles: {
				fillColor: [230, 230, 230],
				textColor: 0,
				fontStyle: "bold",
			},
			head: [["Punto de venta", "Total"]],
			columnStyles: {
				0: { cellWidth: contentW * 0.65 },
				1: { cellWidth: contentW * 0.35, halign: "right" },
			},
			body: posRows,
		});
		y = doc.lastAutoTable.finalY + 6;
	}

	// Group by POS
	Object.entries(groups).forEach(([posName, sales], index) => {
		doc.addPage();
		addHeader(doc, selectedDateStr);

		let py = 44;
		py = sectionTitle(doc, `Ventas — ${posName}`, py);

		const products = {};
		sales.forEach((s) => {
			if (!products[s.product_name]) {
				products[s.product_name] = {
					quantity: 0,
					total: 0,
					method: s.payment_method,
				};
			}
			products[s.product_name].quantity += s.quantity;
			products[s.product_name].total += s.total;
		});

		const rows = Object.entries(products)
			.sort((a, b) => b[1].total - a[1].total)
			.map(([name, data]) => [
				name,
				data.quantity,
				`$${(data.total / data.quantity).toFixed(2)}`,
				`$${data.total.toFixed(2)}`,
			]);

		const posTotal = sales.reduce((sum, s) => sum + s.total, 0);

		doc.autoTable({
			startY: py,
			margin: { left: margin, right: margin },
			theme: "striped",
			styles: { fontSize: 9, cellPadding: 2.5 },
			headStyles: {
				fillColor: [30, 30, 30],
				textColor: 255,
				fontStyle: "bold",
				fontSize: 9,
			},
			head: [["Producto", "Cant.", "P. Unit.", "Total"]],
			columnStyles: {
				0: { cellWidth: contentW * 0.45 },
				1: { cellWidth: contentW * 0.15, halign: "center" },
				2: { cellWidth: contentW * 0.2, halign: "right" },
				3: { cellWidth: contentW * 0.2, halign: "right", fontStyle: "bold" },
			},
			body: rows,
			foot: [["", "", "Total", `$${posTotal.toFixed(2)}`]],
			footStyles: {
				fillColor: [240, 240, 240],
				textColor: 0,
				fontStyle: "bold",
				fontSize: 10,
			},
		});
	});

	// Returns Page
	if (returnsOfDay.length > 0) {
		doc.addPage();
		addHeader(doc, selectedDateStr);

		let ry = 44;
		ry = sectionTitle(doc, "Devoluciones del día", ry);

		const returnRows = returnsOfDay.map((r) => [
			r.product_name,
			r.quantity,
			`$${r.price_at_sale.toFixed(2)}`,
			`-$${r.total.toFixed(2)}`,
			r.pos_name || "Este negocio",
		]);

		doc.autoTable({
			startY: ry,
			margin: { left: margin, right: margin },
			theme: "striped",
			styles: { fontSize: 9, cellPadding: 2.5 },
			headStyles: {
				fillColor: [180, 50, 50],
				textColor: 255,
				fontStyle: "bold",
				fontSize: 9,
			},
			head: [["Producto", "Cant.", "P. Unit.", "Total dev.", "Punto de venta"]],
			columnStyles: {
				0: { cellWidth: contentW * 0.3 },
				1: { cellWidth: contentW * 0.1, halign: "center" },
				2: { cellWidth: contentW * 0.15, halign: "right" },
				3: { cellWidth: contentW * 0.2, halign: "right", fontStyle: "bold" },
				4: { cellWidth: contentW * 0.25 },
			},
			body: returnRows,
			foot: [["", "", "", `-$${totalReturns.toFixed(2)}`, ""]],
			footStyles: {
				fillColor: [240, 240, 240],
				textColor: 0,
				fontStyle: "bold",
			},
		});
	}

	// Supplies Page
	if (suppliesOfDay.length > 0) {
		doc.addPage();
		addHeader(doc, selectedDateStr);

		let sy = 44;
		sy = sectionTitle(doc, "Compras del día", sy);

		const supplyRows = suppliesOfDay.map((s) => [
			s.product_name,
			s.quantity,
			`$${s.cost_unit.toFixed(2)}`,
			s.transport_cost > 0 ? `$${s.transport_cost.toFixed(2)}` : "—",
			`$${s.total_cost.toFixed(2)}`,
		]);

		doc.autoTable({
			startY: sy,
			margin: { left: margin, right: margin },
			theme: "striped",
			styles: { fontSize: 9, cellPadding: 2.5 },
			headStyles: {
				fillColor: [30, 30, 30],
				textColor: 255,
				fontStyle: "bold",
				fontSize: 9,
			},
			head: [["Producto", "Cant.", "C. Unit.", "Transporte", "Total"]],
			columnStyles: {
				0: { cellWidth: contentW * 0.35 },
				1: { cellWidth: contentW * 0.1, halign: "center" },
				2: { cellWidth: contentW * 0.18, halign: "right" },
				3: { cellWidth: contentW * 0.18, halign: "right" },
				4: { cellWidth: contentW * 0.19, halign: "right", fontStyle: "bold" },
			},
			body: supplyRows,
			foot: [["", "", "", "Total", `$${totalSuppliesCost.toFixed(2)}`]],
			footStyles: {
				fillColor: [240, 240, 240],
				textColor: 0,
				fontStyle: "bold",
			},
		});
	}
	if (servicesAddedToday.length > 0) {
		doc.addPage();
		addHeader(doc, selectedDateStr);

		let svy = 44;
		svy = sectionTitle(doc, "Servicios añadidos", svy);

		const serviceRows = servicesAddedToday.map((s) => [
			s.product_name,
			"Nuevo servicio",
		]);

		doc.autoTable({
			startY: svy,
			margin: { left: margin, right: margin },
			theme: "plain",
			styles: { fontSize: 10, cellPadding: 2.5 },
			headStyles: {
				fillColor: [30, 30, 30],
				textColor: 255,
				fontStyle: "bold",
				fontSize: 9,
			},
			head: [["Servicio", "Estado"]],
			columnStyles: {
				0: { cellWidth: contentW * 0.75 },
				1: { cellWidth: contentW * 0.25, halign: "right" },
			},
			body: serviceRows,
		});
	}

	// Save
	const safeDateStr = selectedDateStr.replace(/\//g, "-");
	doc.save(`STOX_resumen_${safeDateStr}.pdf`);
}
