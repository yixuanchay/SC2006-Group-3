/* ============================================================
   compare.js — HomeMatch Location Comparison
   Depends on: hdb.js (loaded first)
   ============================================================ */

const fmt = n => '$' + Number(n).toLocaleString('en-SG');
const BTO_FACTOR = 0.55;

function getComparePrice(item, flatType, purchaseType) {
    const base = item.prices[flatType] ?? item.prices['4-room'] ?? Object.values(item.prices)[0];
    return purchaseType === 'bto' ? Math.round(base * BTO_FACTOR) : base;
}

function getScoreColor(score) {
    if (score >= 85) return '#22c55e';
    if (score >= 70) return '#f59e0b';
    return '#ef4444';
}


/* ============================================================
   Row Definitions
   Each row describes one attribute line in the table.
   type:     how the value is rendered
   best:     'max' | 'min' | null — which direction is "best"
   ============================================================ */

const ROWS = [
    { type: 'section',   label: 'Overview' },
    { type: 'score',     label: 'Match Score',           key: 'score',    best: 'max'  },
    { type: 'text',      label: 'Region',                key: 'region',   best: null   },

    { type: 'section',   label: 'Pricing'  },
    { type: 'flatprice', label: '2-room Flexi',           flat: '2-room',  best: 'min'  },
    { type: 'flatprice', label: '3-room',                 flat: '3-room',  best: 'min'  },
    { type: 'flatprice', label: '4-room',                 flat: '4-room',  best: 'min'  },
    { type: 'flatprice', label: '5-room',                 flat: '5-room',  best: 'min'  },

    { type: 'section',   label: 'Location' },
    { type: 'text',      label: 'Nearest MRT',           key: 'mrt',      best: null   },
    { type: 'distance',  label: 'MRT Walk Time',         key: 'distance', best: 'min'  },
    { type: 'trend',     label: 'Price Trend (YoY)',     key: 'trend',    best: null   },

    { type: 'section',   label: 'Affordability' },
    { type: 'grants',    label: 'Estimated Grants',                       best: 'max'  },
    { type: 'effective', label: 'Price After Grants (4-room)',             best: 'min'  },
];


/* ============================================================
   Best-value helper
   Returns the index of the item with the best value,
   or -1 if all items tie.
   ============================================================ */

function bestIndex(values, direction) {
    if (!direction) return -1;
    const nums = values.map(v => (typeof v === 'number' && !isNaN(v) ? v : null));
    const valid = nums.filter(n => n !== null);
    if (valid.length < 2) return -1; // need 2+ to crown a winner

    const target = direction === 'max' ? Math.max(...valid) : Math.min(...valid);
    const winners = nums.filter(n => n === target).length;
    if (winners === valid.length) return -1; // all tied
    return nums.indexOf(target);
}


/* ============================================================
   Render
   ============================================================ */

function renderCompareTable(items, formData) {
    const table = document.getElementById('compareTable');
    if (!table) return;

    const purchaseType = formData?.purchaseType || 'resale';
    const isBTO        = purchaseType === 'bto';
    const grantTotal   = formData ? calculateGrants(formData).total : 0;
    const topScore     = Math.max(...items.map(x => x.score));

    table.className = `compare-table cols-${items.length}`;

    let html = '';

    /* ---- Sticky column headers ---- */
    html += '<div class="compare-head">';
    html += '<div class="compare-head-label"></div>';

    items.forEach((item, i) => {
        const isBest   = item.score === topScore && items.filter(x => x.score === topScore).length === 1;
        const c        = getScoreColor(item.score);
        html += `
            <div class="compare-col-head">
                <div class="compare-score-circle" style="background:${c}20; border:2px solid ${c};">
                    <span style="color:${c}; font-weight:700; font-size:15px;">${item.score}%</span>
                </div>
                <div class="compare-town-name">${item.town}</div>
                <div class="compare-town-region">${item.region}</div>
                ${isBest ? '<span class="best-badge">★ Best Match</span>' : ''}
                <button class="compare-remove-btn" onclick="removeItem(${i})">Remove</button>
            </div>`;
    });

    html += '</div>'; // .compare-head

    /* ---- Data rows ---- */
    ROWS.forEach(row => {

        /* Section header */
        if (row.type === 'section') {
            html += `<div class="compare-section-head"><span>${row.label}</span></div>`;
            return;
        }

        /* Compute value per item */
        const values = items.map(item => {
            switch (row.type) {
                case 'flatprice': {
                    const base = item.prices[row.flat] ?? null;
                    if (base === null) return null;
                    return isBTO ? Math.round(base * BTO_FACTOR) : base;
                }
                case 'grants':    return grantTotal;
                case 'effective': {
                    const p = getComparePrice(item, '4-room', purchaseType);
                    return Math.max(0, p - grantTotal);
                }
                default: return item[row.key] ?? null;
            }
        });

        const bi = bestIndex(values, row.best);

        html += '<div class="compare-row">';
        html += `<div class="compare-row-label">${row.label}</div>`;

        values.forEach((val, i) => {
            const isBestCell = i === bi;
            html += `<div class="compare-cell${isBestCell ? ' best-cell' : ''}">`;

            if (val === null) {
                html += '<span class="compare-na">—</span>';

            } else if (row.type === 'score') {
                const c = getScoreColor(val);
                html += `
                    <div class="compare-score-bar-wrap">
                        <div class="compare-score-bar-track">
                            <div class="compare-score-bar-fill" style="width:${val}%; background:${c};"></div>
                        </div>
                        <span class="compare-score-bar-num" style="color:${c};">${val}%</span>
                    </div>`;

            } else if (row.type === 'flatprice' || row.type === 'effective') {
                html += `<span class="compare-val-price">${fmt(val)}</span>`;
                if (isBestCell) html += '<span class="compare-best-pill">Lowest</span>';

            } else if (row.type === 'grants') {
                html += `<span class="compare-val-price${val > 0 ? ' grants-val' : ''}">${val > 0 ? fmt(val) : '—'}</span>`;
                if (isBestCell && val > 0) html += '<span class="compare-best-pill">Most</span>';

            } else if (row.type === 'distance') {
                html += `<span class="compare-val">${val} min walk</span>`;
                if (isBestCell) html += '<span class="compare-best-pill">Closest</span>';

            } else if (row.type === 'trend') {
                const up = val >= 0;
                html += `<span class="result-trend ${up ? 'up' : 'down'}">${up ? '↑ +' : '↓ '}${Math.abs(val)}% per year</span>`;

            } else {
                html += `<span class="compare-val">${val}</span>`;
            }

            html += '</div>'; // .compare-cell
        });

        html += '</div>'; // .compare-row
    });

    table.innerHTML = html;
}


/* ============================================================
   Remove an item and re-render
   ============================================================ */

function removeItem(index) {
    const raw = sessionStorage.getItem('hm_compare');
    if (!raw) return;
    const data = JSON.parse(raw);
    data.items.splice(index, 1);

    if (data.items.length === 0) {
        window.location.href = 'results.html';
        return;
    }

    sessionStorage.setItem('hm_compare', JSON.stringify(data));
    renderCompareTable(data.items, data.formData);
}


/* ============================================================
   Init
   ============================================================ */

function init() {
    const raw = sessionStorage.getItem('hm_compare');
    if (!raw) { window.location.href = 'results.html'; return; }

    let data;
    try { data = JSON.parse(raw); } catch { window.location.href = 'results.html'; return; }

    if (!data.items?.length) { window.location.href = 'results.html'; return; }

    renderCompareTable(data.items, data.formData);
}

init();
