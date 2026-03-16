/* ============================================================
   results.js — HomeMatch Results Page
   Depends on: hdb.js (loaded first)
   ============================================================ */


/* ---------- Mock Data ---------- */
// Resale prices per flat type. Replace with API response when backend is ready.

const MOCK_RESULTS = [
    {
        town:     "Ang Mo Kio",
        score:    92,
        prices:   { "2-room": 268000, "3-room": 388000, "4-room": 518000, "5-room": 648000 },
        mrt:      "Ang Mo Kio MRT",
        distance: 5,
        coords:   [1.3691, 103.8454],
        trend:    2.8,
        region:   "North East"
    },
    {
        town:     "Bishan",
        score:    88,
        prices:   { "2-room": 305000, "3-room": 465000, "4-room": 608000, "5-room": 768000 },
        mrt:      "Bishan MRT",
        distance: 4,
        coords:   [1.3508, 103.8485],
        trend:    3.5,
        region:   "Central"
    },
    {
        town:     "Bukit Merah",
        score:    84,
        prices:   { "2-room": 292000, "3-room": 448000, "4-room": 582000, "5-room": 728000 },
        mrt:      "Tiong Bahru MRT",
        distance: 6,
        coords:   [1.2806, 103.8262],
        trend:    4.1,
        region:   "Central"
    }
];

// BTO prices are roughly 50–60% of resale for the same town
const BTO_FACTOR = 0.55;


/* ---------- API Layer ---------- */

async function fetchRecommendations(_formData) {
    // TODO: replace mock with real API call once backend is ready:
    //
    // const response = await fetch('/api/recommend', {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify(_formData)
    // });
    // if (!response.ok) throw new Error(`Server error: ${response.status}`);
    // return response.json();

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


/* ---------- Price Helpers ---------- */

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


/* ---------- Map ---------- */

let map = null;
const mapMarkers = {};

function initMap() {
    if (map) return;
    map = L.map("map").setView([1.3521, 103.8198], 11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19
    }).addTo(map);
}


/* ---------- Grant Banner ---------- */

function renderGrantBanner(formData) {
    const banner = document.getElementById("grantBanner");
    if (!banner || !formData) return;

    const { grants, total } = calculateGrants(formData);
    if (grants.length === 0 || total === 0) return;

    document.getElementById("grantBannerTitle").textContent =
        `You may be eligible for up to ${fmt(total)} in HDB grants`;

    document.getElementById("grantBannerSub").innerHTML =
        grants.map(g => `${g.name}: <strong>${fmt(g.amount)}</strong>`).join(" &nbsp;·&nbsp; ") +
        "<br>Effective prices shown on cards already reflect these deductions.";

    banner.style.display = "flex";
}


/* ---------- Cards ---------- */

function renderCards(data, flatType, purchaseType, grantTotal, maxPrice) {
    const list = document.getElementById("resultsList");
    if (!list) return;

    list.innerHTML = "";
    let shown = 0;

    data.forEach((result, index) => {
        const price     = getPrice(result, flatType, purchaseType);
        const effective = Math.max(0, price - grantTotal);

        // Apply price filter
        if (effective > maxPrice) return;

        shown++;
        const isBTO        = purchaseType === "bto";
        const isBest       = index === 0;
        const scoreColor   = getScoreColor(result.score);
        const trendUp      = result.trend >= 0;
        const trendLabel   = (trendUp ? "↑ +" : "↓ ") + Math.abs(result.trend) + "% past year";

        // Build flat type breakdown chips
        const chips = Object.entries(result.prices)
            .map(([type, p]) => {
                const chipPrice = isBTO ? Math.round(p * BTO_FACTOR) : p;
                const isActive  = (flatType || "4-room") === type;
                return `<span class="price-chip${isActive ? " active" : ""}">${type} ${fmt(chipPrice)}</span>`;
            })
            .join("");

        const card = document.createElement("div");
        card.className = "result-card";
        card.style.borderLeftColor = scoreColor;

        card.innerHTML = `
            <div class="card-header">
                <div class="result-title">${result.town}</div>
                ${isBest ? '<span class="best-badge">★ Best Match</span>' : ""}
            </div>

            <span class="region-tag">${result.region}</span>
            ${isBTO ? '<span class="region-tag" style="margin-left:4px; color:#7c3aed; border-color:#ddd6fe; background:#f5f3ff;">BTO est.</span>' : ""}

            <div class="match-bar-label">Match Score</div>
            <div class="match-bar-row">
                <div class="match-bar-track">
                    <div class="match-bar-fill" style="width:${result.score}%; background:${scoreColor};"></div>
                </div>
                <span class="match-bar-score" style="color:${scoreColor};">${result.score}%</span>
            </div>

            <div class="price-breakdown">${chips}</div>

            ${grantTotal > 0 ? `<div class="effective-price">After grants: ${fmt(effective)}</div>` : ""}

            <div class="card-meta">
                <span class="card-mrt">
                    🚆 ${result.mrt}
                    <span class="result-trend ${trendUp ? "up" : "down"}">${trendLabel}</span>
                </span>
                <span class="card-price">${fmt(price)}</span>
            </div>
        `;

        list.appendChild(card);

        if (!mapMarkers[result.town]) {
            mapMarkers[result.town] = L.marker(result.coords)
                .addTo(map)
                .bindPopup(`<strong>${result.town}</strong><br>${fmt(price)}`);
        }

        card.addEventListener("mouseenter", () => {
            mapMarkers[result.town].openPopup();
            map.flyTo(result.coords, 13);
        });
    });

    if (shown === 0) {
        list.innerHTML = `<div class="no-results-msg">No results match your filters. Try adjusting the price range or flat type.</div>`;
    }

    const countEl = document.getElementById("filterCount");
    if (countEl) countEl.textContent = `${shown} location${shown !== 1 ? "s" : ""} shown`;
}


/* ---------- Sort & Filter ---------- */

let allData    = [];
let formData   = null;

function getSortedFiltered() {
    const sortVal    = document.getElementById("sortResults")?.value || "match";
    const flatType   = document.getElementById("filterFlatType")?.value || "";
    const maxPrice   = Number(document.getElementById("filterPrice")?.value) || Infinity;
    const purchaseType = formData?.purchaseType || "resale";
    const grantTotal = formData ? calculateGrants(formData).total : 0;

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

    renderCards(sorted, flatType || formData?.flatType, purchaseType, grantTotal, maxPrice);
}

function initFilters() {
    // Sort
    document.getElementById("sortResults")?.addEventListener("change", getSortedFiltered);

    // Flat type filter
    const flatFilter = document.getElementById("filterFlatType");
    if (flatFilter) {
        // Pre-select user's chosen flat type if available
        if (formData?.flatType) flatFilter.value = formData.flatType;
        flatFilter.addEventListener("change", getSortedFiltered);
    }

    // Price range filter
    const priceSlider  = document.getElementById("filterPrice");
    const priceDisplay = document.getElementById("filterPriceDisplay");

    if (priceSlider && priceDisplay) {
        // Seed max to a round number above the most expensive result
        const grantTotal = formData ? calculateGrants(formData).total : 0;
        const flatType   = formData?.flatType || "4-room";
        const purchaseType = formData?.purchaseType || "resale";
        const maxResult  = Math.max(...allData.map(r =>
            Math.max(0, getPrice(r, flatType, purchaseType) - grantTotal)
        ));
        const sliderMax  = Math.ceil(maxResult / 100000) * 100000 + 200000;
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

    const raw  = sessionStorage.getItem("homematchData");
    formData   = raw ? JSON.parse(raw) : null;

    try {
        allData = await fetchRecommendations(formData);

        showResults();  // container must be visible before Leaflet measures it
        initMap();
        map.invalidateSize(); // recalculate dimensions now that container is visible
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
