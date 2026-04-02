/* ============================================================
   results.js — HomeMatch Results Page
   Depends on: hdb.js (loaded first), app.js
   ============================================================ */


/* ---------- Mock Data ---------- */

const MOCK_RESULTS = [
    {
        town:     "Ang Mo Kio",
        score:    92,
        prices:   { "2-room": 268000, "3-room": 388000, "4-room": 518000, "5-room": 648000 },
        mrt:      "Ang Mo Kio MRT",
        distance: 5,
        coords:   [1.3691, 103.8454],
        trend:    2.8,
        region:   "North East",
        image:    "images/hdb-building.png"
    },
    {
        town:     "Bishan",
        score:    88,
        prices:   { "2-room": 305000, "3-room": 465000, "4-room": 608000, "5-room": 768000 },
        mrt:      "Bishan MRT",
        distance: 4,
        coords:   [1.3508, 103.8485],
        trend:    3.5,
        region:   "Central",
        image:    "images/hdb-building.png"
    },
    {
        town:     "Bukit Merah",
        score:    84,
        prices:   { "2-room": 292000, "3-room": 448000, "4-room": 582000, "5-room": 728000 },
        mrt:      "Tiong Bahru MRT",
        distance: 6,
        coords:   [1.2806, 103.8262],
        trend:    4.1,
        region:   "Central",
        image:    "images/hdb-building.png"
    },
    {
        town:     "Tampines",
        score:    80,
        prices:   { "2-room": 245000, "3-room": 355000, "4-room": 468000, "5-room": 588000 },
        mrt:      "Tampines MRT",
        distance: 7,
        coords:   [1.3540, 103.9454],
        trend:    1.9,
        region:   "East",
        image:    "images/hdb-building.png"
    },
    {
        town:     "Woodlands",
        score:    76,
        prices:   { "2-room": 198000, "3-room": 298000, "4-room": 398000, "5-room": 498000 },
        mrt:      "Woodlands MRT",
        distance: 8,
        coords:   [1.4370, 103.7866],
        trend:    1.2,
        region:   "North",
        image:    "images/hdb-building.png"
    },
    {
        town:     "Jurong West",
        score:    72,
        prices:   { "2-room": 215000, "3-room": 318000, "4-room": 425000, "5-room": 535000 },
        mrt:      "Jurong East MRT",
        distance: 10,
        coords:   [1.3404, 103.7090],
        trend:    2.4,
        region:   "West",
        image:    "images/hdb-building.png"
    }
];

const BTO_FACTOR = 0.55;


/* ---------- API Layer ---------- */

async function fetchRecommendations(_formData) {
    // TODO: replace mock with real API call:
    // const res = await fetch('/api/recommend', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(_formData) });
    // if (!res.ok) throw new Error(`Server error: ${res.status}`);
    // return res.json();
    await new Promise(resolve => setTimeout(resolve, 900));
    return MOCK_RESULTS;
}


/* ---------- UI State ---------- */

function showLoading() {
    document.getElementById("loadingState").style.display   = "flex";
    document.getElementById("resultsContent").style.display = "none";
    document.getElementById("errorState").style.display     = "none";
}

function showError(message) {
    document.getElementById("loadingState").style.display   = "none";
    document.getElementById("resultsContent").style.display = "none";
    const el = document.getElementById("errorState");
    el.style.display = "flex";
    el.querySelector(".error-message").textContent = message;
}

function showResults() {
    document.getElementById("loadingState").style.display   = "none";
    document.getElementById("errorState").style.display     = "none";
    document.getElementById("resultsContent").style.display = "block";
}


/* ---------- Price / Score Helpers ---------- */

function getPrice(result, flatType, purchaseType) {
    const type = flatType || "4-room";
    const base = result.prices[type] ?? result.prices["4-room"] ?? Object.values(result.prices)[0];
    return purchaseType === "bto" ? Math.round(base * BTO_FACTOR) : base;
}

function getScoreColor(score) {
    if (score >= 85) return "#22c55e";
    if (score >= 70) return "#f59e0b";
    return "#ef4444";
}


/* ---------- Main Map ---------- */

let map = null;
const mapMarkers = {};

function initMap() {
    if (map) return;
    map = L.map("map").setView([1.3521, 103.8198], 11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
}

function addMapMarker(result, price) {
    if (mapMarkers[result.town]) return;
    mapMarkers[result.town] = L.marker(result.coords)
        .addTo(map)
        .bindPopup(`<strong>${result.town}</strong><br>${fmt(price)}`);
}


/* ---------- State ---------- */

let allData      = [];
let formData     = null;
const compareMap = new Map();
let savedSet     = new Set(JSON.parse(localStorage.getItem("hm_saved_towns") || "[]"));
let activeResult = null;
let detailMap    = null;
let detailMarker = null;


/* ---------- Grant Banner ---------- */

function renderGrantBanner(fd) {
    const banner = document.getElementById("grantBanner");
    if (!banner || !fd) return;
    const { grants, total } = calculateGrants(fd);
    if (!total) return;
    document.getElementById("grantBannerTitle").textContent =
        `You may be eligible for up to ${fmt(total)} in HDB grants`;
    document.getElementById("grantBannerSub").innerHTML =
        grants.map(g => `${g.name}: <strong>${fmt(g.amount)}</strong>`).join(" &nbsp;·&nbsp; ") +
        "<br>Effective prices shown already reflect these deductions.";
    banner.style.display = "flex";
}


/* ---------- Results Grid ---------- */

function renderGrid(data, flatType, purchaseType, grantTotal, maxPrice) {
    const grid = document.getElementById("resultsGrid");
    if (!grid) return;

    grid.innerHTML = "";
    let shown = 0;

    data.forEach((result, index) => {
        const price     = getPrice(result, flatType, purchaseType);
        const effective = Math.max(0, price - grantTotal);
        if (effective > maxPrice) return;

        shown++;
        const isBest     = index === 0;
        const scoreColor = getScoreColor(result.score);
        const isBTO      = purchaseType === "bto";
        const isSaved    = savedSet.has(result.town);
        const inCompare  = compareMap.has(result.town);

        const card = document.createElement("div");
        card.className = "rg-card" + (inCompare ? " rg-card--comparing" : "");
        card.dataset.town = result.town;

        card.innerHTML = `
            <div class="rg-card-img-wrap">
                <img class="rg-card-img" src="${result.image || 'images/hdb-building.png'}"
                     alt="${result.town}"
                     onerror="this.src=''; this.parentElement.style.background='#e8e4df'">
                ${isBest ? '<span class="rg-best-badge">★ Best Match</span>' : ""}
                ${isSaved ? '<span class="rg-saved-badge">🔖</span>' : ""}
            </div>
            <div class="rg-card-body">
                <div class="rg-card-top">
                    <div>
                        <h3 class="rg-card-name">${result.town}</h3>
                        <span class="rg-region-tag">${result.region}</span>
                        ${isBTO ? '<span class="rg-bto-tag">BTO est.</span>' : ""}
                    </div>
                    <div class="rg-score" style="color:${scoreColor};">${result.score}%</div>
                </div>

                <div class="rg-bar-track">
                    <div class="rg-bar-fill" style="width:${result.score}%; background:${scoreColor};"></div>
                </div>

                <div class="rg-price-row">
                    <span class="rg-price">${fmt(price)}</span>
                    ${grantTotal > 0 ? `<span class="rg-after-grant">After grants: ${fmt(effective)}</span>` : ""}
                </div>

                <div class="rg-mrt">🚆 ${result.mrt}</div>

                <div class="rg-card-actions">
                    <button class="rg-details-btn" onclick="openDetail('${result.town}')">View Details</button>
                    <button class="rg-compare-pill ${inCompare ? 'active' : ''}"
                            onclick="event.stopPropagation(); toggleCompare('${result.town}')">
                        ${inCompare ? "✓ Comparing" : "+ Compare"}
                    </button>
                </div>
            </div>
        `;

        grid.appendChild(card);

        // Map marker + hover flyTo
        if (map) {
            addMapMarker(result, price);
            card.addEventListener("mouseenter", () => {
                mapMarkers[result.town]?.openPopup();
                map.flyTo(result.coords, 13, { duration: 0.6 });
            });
        }
    });

    if (shown === 0) {
        grid.innerHTML = `<div class="no-results-msg">No results match your filters. Try adjusting the price range or flat type.</div>`;
    }

    const countEl = document.getElementById("filterCount");
    if (countEl) countEl.textContent = `${shown} location${shown !== 1 ? "s" : ""} shown`;
}


/* ---------- Detail Modal ---------- */

function openDetail(town) {
    const result = allData.find(r => r.town === town);
    if (!result) return;
    activeResult = result;

    const flatType     = document.getElementById("filterFlatType")?.value || formData?.flatType || "4-room";
    const purchaseType = formData?.purchaseType || "resale";
    const grantTotal   = formData ? calculateGrants(formData).total : 0;
    const price        = getPrice(result, flatType, purchaseType);
    const effective    = Math.max(0, price - grantTotal);
    const scoreColor   = getScoreColor(result.score);
    const isBTO        = purchaseType === "bto";
    const trendUp      = result.trend >= 0;
    const isSaved      = savedSet.has(town);
    const inCompare    = compareMap.has(town);

    // Populate
    document.getElementById("detailTown").textContent   = result.town;
    document.getElementById("detailRegion").textContent = result.region;
    document.getElementById("detailMrt").textContent    = `🚆 ${result.mrt} · ${result.distance} min walk`;
    document.getElementById("detailScorePct").textContent = result.score + "%";
    document.getElementById("detailScorePct").style.color = scoreColor;
    document.getElementById("detailBarFill").style.width      = result.score + "%";
    document.getElementById("detailBarFill").style.background = scoreColor;

    // Badges
    const badges = [];
    if (allData.indexOf(result) === 0) badges.push('<span class="detail-badge best">★ Best Match</span>');
    if (isBTO) badges.push('<span class="detail-badge bto">BTO est.</span>');
    document.getElementById("detailBadges").innerHTML = badges.join("");

    // Price grid
    document.getElementById("detailPriceGrid").innerHTML = Object.entries(result.prices)
        .map(([type, p]) => {
            const chipPrice = isBTO ? Math.round(p * BTO_FACTOR) : p;
            const isActive  = (flatType || "4-room") === type;
            return `<div class="detail-price-chip ${isActive ? "active" : ""}">
                        <div class="detail-chip-type">${type}</div>
                        <div class="detail-chip-price">${fmt(chipPrice)}</div>
                    </div>`;
        }).join("");

    // Grant row
    if (grantTotal > 0) {
        document.getElementById("detailGrantText").innerHTML =
            `Estimated grants: <strong>${fmt(grantTotal)}</strong> → Effective price: <strong>${fmt(effective)}</strong>`;
        document.getElementById("detailGrantRow").style.display = "flex";
    } else {
        document.getElementById("detailGrantRow").style.display = "none";
    }

    // Trend
    document.getElementById("detailTrendRow").innerHTML =
        `<span class="result-trend ${trendUp ? "up" : "down"}">
            ${trendUp ? "↑ +" : "↓ "}${Math.abs(result.trend)}% price change past year
        </span>`;

    // Save / Compare buttons
    const saveBtn    = document.getElementById("detailSaveBtn");
    const compareBtn = document.getElementById("detailCompareBtn");
    saveBtn.textContent    = isSaved   ? "🔖 Saved"     : "🔖 Save";
    saveBtn.classList.toggle("active", isSaved);
    compareBtn.textContent = inCompare ? "✓ Comparing"  : "+ Compare";
    compareBtn.classList.toggle("active", inCompare);
    compareBtn.disabled = !inCompare && compareMap.size >= 3;

    // Open overlay
    document.getElementById("detailOverlay").classList.add("open");
    document.body.style.overflow = "hidden";

    // Init/update mini map
    setTimeout(() => {
        if (!detailMap) {
            detailMap = L.map("detailMap", { zoomControl: false }).setView(result.coords, 14);
            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(detailMap);
            L.control.zoom({ position: "bottomright" }).addTo(detailMap);
        } else {
            detailMap.setView(result.coords, 14);
            if (detailMarker) detailMarker.remove();
        }
        detailMarker = L.marker(result.coords)
            .addTo(detailMap)
            .bindPopup(`<strong>${result.town}</strong>`)
            .openPopup();
        detailMap.invalidateSize();
    }, 50);
}

function closeDetail(event) {
    // Only close if clicking the overlay backdrop, not the modal itself
    if (event && event.target !== document.getElementById("detailOverlay")) return;
    closeDetailBtn();
}

function closeDetailBtn() {
    document.getElementById("detailOverlay").classList.remove("open");
    document.body.style.overflow = "";
    activeResult = null;
}

// Close on Escape key
document.addEventListener("keydown", e => {
    if (e.key === "Escape") closeDetailBtn();
});


/* ---------- Save ---------- */

function toggleSaveFromModal() {
    if (!activeResult) return;
    const town = activeResult.town;
    if (savedSet.has(town)) {
        savedSet.delete(town);
    } else {
        savedSet.add(town);
    }
    localStorage.setItem("hm_saved_towns", JSON.stringify([...savedSet]));

    const btn = document.getElementById("detailSaveBtn");
    btn.textContent = savedSet.has(town) ? "🔖 Saved" : "🔖 Save";
    btn.classList.toggle("active", savedSet.has(town));

    // Refresh card badge
    const card = document.querySelector(`.rg-card[data-town="${town}"]`);
    if (card) {
        const existing = card.querySelector(".rg-saved-badge");
        if (savedSet.has(town) && !existing) {
            const badge = document.createElement("span");
            badge.className = "rg-saved-badge";
            badge.textContent = "🔖";
            card.querySelector(".rg-card-img-wrap").appendChild(badge);
        } else if (!savedSet.has(town) && existing) {
            existing.remove();
        }
    }
}


/* ---------- Compare ---------- */

function toggleCompare(town) {
    const result = allData.find(r => r.town === town);
    if (!result) return;

    if (compareMap.has(town)) {
        compareMap.delete(town);
    } else {
        if (compareMap.size >= 3) return;
        compareMap.set(town, result);
    }

    updateCompareBar();
    refreshCardCompareState(town);

    // Sync modal button if open
    if (activeResult?.town === town) {
        const btn = document.getElementById("detailCompareBtn");
        const inCompare = compareMap.has(town);
        btn.textContent = inCompare ? "✓ Comparing" : "+ Compare";
        btn.classList.toggle("active", inCompare);
        btn.disabled = !inCompare && compareMap.size >= 3;
    }
}

function toggleCompareFromModal() {
    if (!activeResult) return;
    toggleCompare(activeResult.town);
}

function refreshCardCompareState(town) {
    const card = document.querySelector(`.rg-card[data-town="${town}"]`);
    if (!card) return;
    const inCompare = compareMap.has(town);
    card.classList.toggle("rg-card--comparing", inCompare);
    const btn = card.querySelector(".rg-compare-pill");
    if (btn) {
        btn.textContent = inCompare ? "✓ Comparing" : "+ Compare";
        btn.classList.toggle("active", inCompare);
    }
}

function updateCompareBar() {
    const bar      = document.getElementById("compareBar");
    const townsEl  = document.getElementById("compareBarTowns");
    const barBtn   = document.getElementById("compareBarBtn");
    if (!bar) return;

    bar.classList.toggle("visible", compareMap.size > 0);

    townsEl.innerHTML = [...compareMap.keys()].map(town => `
        <span class="compare-bar-pill">
            ${town}
            <button onclick="toggleCompare('${town}')" class="compare-bar-pill-remove">✕</button>
        </span>
    `).join("");

    if (compareMap.size >= 2) {
        barBtn.textContent = `Compare ${compareMap.size} locations →`;
        barBtn.disabled = false;
    } else {
        barBtn.textContent = `Select ${2 - compareMap.size} more to compare`;
        barBtn.disabled = true;
    }
}

function goToComparePage() {
    if (compareMap.size < 2) return;
    sessionStorage.setItem("hm_compare", JSON.stringify({
        items:    [...compareMap.values()],
        formData: formData
    }));
    window.location.href = "compare.html";
}


/* ---------- Sort & Filter ---------- */

function getSortedFiltered() {
    const sortVal      = document.getElementById("sortResults")?.value || "match";
    const flatType     = document.getElementById("filterFlatType")?.value || "";
    const maxPrice     = Number(document.getElementById("filterPrice")?.value) || Infinity;
    const purchaseType = formData?.purchaseType || "resale";
    const grantTotal   = formData ? calculateGrants(formData).total : 0;

    const sorted = [...allData];
    if (sortVal === "price") {
        sorted.sort((a, b) =>
            getPrice(a, flatType || "4-room", purchaseType) -
            getPrice(b, flatType || "4-room", purchaseType)
        );
    } else if (sortVal === "match") {
        sorted.sort((a, b) => b.score - a.score);
    } else if (sortVal === "distance") {
        sorted.sort((a, b) => a.distance - b.distance);
    }

    renderGrid(sorted, flatType || formData?.flatType, purchaseType, grantTotal, maxPrice);
}

function initFilters() {
    document.getElementById("sortResults")?.addEventListener("change", getSortedFiltered);

    const flatFilter = document.getElementById("filterFlatType");
    if (flatFilter) {
        if (formData?.flatType) flatFilter.value = formData.flatType;
        flatFilter.addEventListener("change", getSortedFiltered);
    }

    const priceSlider  = document.getElementById("filterPrice");
    const priceDisplay = document.getElementById("filterPriceDisplay");
    if (priceSlider && priceDisplay) {
        const grantTotal   = formData ? calculateGrants(formData).total : 0;
        const flatType     = formData?.flatType || "4-room";
        const purchaseType = formData?.purchaseType || "resale";
        const maxResult    = Math.max(...allData.map(r =>
            Math.max(0, getPrice(r, flatType, purchaseType) - grantTotal)
        ));
        const sliderMax = Math.ceil(maxResult / 100000) * 100000 + 200000;
        priceSlider.max   = sliderMax;
        priceSlider.value = sliderMax;
        priceDisplay.textContent = "Any";

        priceSlider.addEventListener("input", () => {
            const val = Number(priceSlider.value);
            priceDisplay.textContent = val >= sliderMax ? "Any" : fmt(val);
            getSortedFiltered();
        });
    }
}


/* ---------- Init ---------- */

async function init() {
    showLoading();
    const raw = sessionStorage.getItem("homematchData");
    formData  = raw ? JSON.parse(raw) : null;

    try {
        allData = await fetchRecommendations(formData);
        showResults();
        initMap();
        map.invalidateSize();
        renderGrantBanner(formData);
        initFilters();
        getSortedFiltered();
    } catch (err) {
        showError("Unable to load recommendations. Please try again.");
        console.error(err);
    }
}

document.getElementById("retryBtn")?.addEventListener("click", init);
init();
