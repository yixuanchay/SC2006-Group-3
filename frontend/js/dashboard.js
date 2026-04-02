/* ============================================================
   dashboard.js — HomeMatch Personal Dashboard
   Depends on: app.js, hdb.js
   ============================================================ */

/* ---------- Helpers ---------- */

function fmt(n) { return '$' + Number(n).toLocaleString('en-SG'); }

function citizenLabel(code) {
    return { sc: 'Singapore Citizen', pr: 'Permanent Resident', foreigner: 'Foreigner' }[code] || code || '—';
}

function capitalize(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : '—';
}

function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val || '—';
}

/* ---------- Section Switching ---------- */

function switchSection(name) {
    document.querySelectorAll('.db-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.db-nav-item').forEach(b => b.classList.remove('active'));

    const section = document.getElementById(`section-${name}`);
    if (section) section.classList.add('active');

    const btn = document.querySelector(`.db-nav-item[data-section="${name}"]`);
    if (btn) btn.classList.add('active');
}

/* ---------- Populate Fields ---------- */

function populateLogin(user) {
    setText('f-name',  user.name  || user.username || '');
    setText('f-email', user.email || '');
}

function populatePersonal(fd) {
    setText('f-citizenship',       citizenLabel(fd.citizenship));
    setText('f-marital',           capitalize(fd.marital));
    setText('f-partnerCitizenship', citizenLabel(fd.partnerCitizenship));
    setText('f-employmentStatus',  capitalize(fd.employmentStatus));
    setText('f-income',            fd.income ? `$${Number(fd.income).toLocaleString()}/mo` : '—');
    setText('f-flatType',          fd.flatType || '—');

    // Hide spouse field if single
    const spouseRow = document.getElementById('fg-partnerCitizenship');
    if (spouseRow) spouseRow.style.display = fd.marital === 'single' ? 'none' : '';
}

function populateFinancial(fd) {
    setText('f-purchaseType',      fd.purchaseType === 'bto' ? 'BTO' : fd.purchaseType === 'resale' ? 'Resale' : '—');
    setText('f-budget',            fd.budget ? fmt(fd.budget) : '—');
    setText('f-loanType',          fd.loanType === 'hdb' ? 'HDB Loan' : fd.loanType === 'bank' ? 'Bank Loan' : '—');
    setText('f-nearParents',       fd.nearParents === 'yes' ? 'Yes' : fd.nearParents === 'no' ? 'No' : '—');
    setText('f-parentsLocation',   fd.parentsLocation || fd.parentsTown || '—');
    setText('f-workplaceLocation', fd.workplaceLocation || fd.workplaceMrt || '—');
}

const PREF_ICONS = {
    mrt:         '🚇',
    schools:     '🏫',
    parks:       '🌳',
    malls:       '🛍️',
    supermarkets:'🛒',
    cc:          '🏢',
    parents:     '👨‍👩‍👧',
    workplace:   '💼',
    price:       '💰',
    commute:     '🚌',
};

function populatePreferences(fd) {
    const list = document.getElementById('dbPrefList');
    if (!list) return;

    const prefs = fd.preferences;
    if (!prefs || !prefs.length) {
        list.innerHTML = '<div class="db-pref-empty">No preferences saved yet.</div>';
        return;
    }

    list.innerHTML = prefs
        .sort((a, b) => b.weight - a.weight)
        .map((p, i) => `
            <div class="db-pref-row">
                <span class="db-pref-num">${i + 1}</span>
                <span class="db-pref-icon">${PREF_ICONS[p.factor] || '📌'}</span>
                <span class="db-pref-label">${p.label || p.factor}</span>
            </div>`)
        .join('');
}

/* ---------- Saved Listings ---------- */

function renderSavedListings() {
    const container = document.getElementById('dbSavedListings');
    if (!container) return;

    const savedTowns = JSON.parse(localStorage.getItem('hm_saved_towns') || '[]');

    if (!savedTowns.length) {
        container.innerHTML = `
            <div class="db-empty-state">
                <div class="db-empty-icon">🔖</div>
                <h4>No saved listings yet</h4>
                <p>Browse results and tap <strong>Save</strong> on any location to bookmark it here.</p>
                <button class="db-new-search-btn" onclick="window.location.href='input.html'">Start a Search</button>
            </div>`;
        return;
    }

    container.innerHTML = savedTowns.map(town => `
        <div class="db-listing-card">
            <div class="db-listing-img-wrap">
                <img src="images/hdb-building.png" alt="${town}"
                     onerror="this.parentElement.style.background='#e8e4df'; this.style.display='none'">
            </div>
            <div class="db-listing-body">
                <div class="db-listing-name">${town}</div>
                <div class="db-listing-actions">
                    <button class="db-view-btn" onclick="viewListing('${town}')">View Results →</button>
                    <button class="db-unsave-btn" onclick="unsaveListing('${town}', this)">✕ Remove</button>
                </div>
            </div>
        </div>
    `).join('');
}

function viewListing(town) {
    // Re-run search with the saved form data, filtered to that town
    const raw = sessionStorage.getItem('homematchData');
    if (raw) {
        window.location.href = 'results.html';
    } else {
        window.location.href = 'input.html';
    }
}

function unsaveListing(town, btn) {
    const saved = JSON.parse(localStorage.getItem('hm_saved_towns') || '[]');
    const updated = saved.filter(t => t !== town);
    localStorage.setItem('hm_saved_towns', JSON.stringify(updated));
    btn.closest('.db-listing-card').remove();

    const grid = document.getElementById('dbSavedListings');
    if (grid && !grid.querySelector('.db-listing-card')) {
        renderSavedListings(); // re-render empty state
    }
}

/* ---------- Inline Edit Modal ---------- */

const FIELD_CONFIG = {
    name:               { label: 'Username',             type: 'text' },
    email:              { label: 'Email address',        type: 'email' },
    password:           { label: 'New Password',         type: 'password' },
    citizenship:        { label: 'Citizenship Status',   type: 'select',
                          options: ['sc','pr','foreigner'],
                          labels:  ['Singapore Citizen','Permanent Resident','Foreigner'] },
    marital:            { label: 'Marital Status',       type: 'select',
                          options: ['single','married'],
                          labels:  ['Single','Married'] },
    partnerCitizenship: { label: 'Spouse Citizenship',   type: 'select',
                          options: ['sc','pr','foreigner'],
                          labels:  ['Singapore Citizen','Permanent Resident','Foreigner'] },
    employmentStatus:   { label: 'Employment Status',    type: 'select',
                          options: ['employed','self-employed','unemployed','student'],
                          labels:  ['Employed','Self-Employed','Unemployed','Student'] },
    income:             { label: 'Monthly Income ($)',   type: 'number' },
    flatType:           { label: 'Preferred Flat Type',  type: 'select',
                          options: ['2-room','3-room','4-room','5-room'],
                          labels:  ['2-room Flexi','3-room','4-room','5-room'] },
    purchaseType:       { label: 'Purchase Type',        type: 'select',
                          options: ['bto','resale'],
                          labels:  ['BTO','Resale'] },
    budget:             { label: 'Housing Budget ($)',   type: 'number' },
    loanType:           { label: 'Loan Type',            type: 'select',
                          options: ['hdb','bank'],
                          labels:  ['HDB Loan','Bank Loan'] },
    nearParents:        { label: 'Live near parents?',   type: 'select',
                          options: ['yes','no'],
                          labels:  ['Yes','No'] },
    parentsLocation:    { label: "Parent's Location (MRT)", type: 'text' },
    workplaceLocation:  { label: 'Workplace Location (MRT)', type: 'text' },
};

let _editingField = null;

function editField(fieldKey) {
    const cfg = FIELD_CONFIG[fieldKey];
    if (!cfg) return;
    _editingField = fieldKey;

    document.getElementById('dbEditTitle').textContent = `Edit ${cfg.label}`;

    // Get current value from displayed field (if available)
    const displayEl = document.getElementById(`f-${fieldKey}`);
    const currentDisplay = displayEl?.textContent || '';

    let inputHTML;
    if (cfg.type === 'select') {
        const currentVal = window._formData?.[fieldKey] || '';
        inputHTML = `<select class="db-edit-input" id="dbEditInput">
            ${cfg.options.map((opt, i) =>
                `<option value="${opt}" ${opt === currentVal ? 'selected' : ''}>${cfg.labels[i]}</option>`
            ).join('')}
        </select>`;
    } else {
        const currentVal = fieldKey === 'income' || fieldKey === 'budget'
            ? (window._formData?.[fieldKey] || '')
            : (window._authUser?.[fieldKey] || window._formData?.[fieldKey] || '');
        inputHTML = `<input class="db-edit-input" id="dbEditInput" type="${cfg.type}"
                           value="${currentVal}" placeholder="${cfg.label}">`;
    }

    document.getElementById('dbEditBody').innerHTML = inputHTML;
    document.getElementById('dbEditOverlay').classList.add('open');
    setTimeout(() => document.getElementById('dbEditInput')?.focus(), 50);
}

function closeEditModal(e) {
    if (e.target === document.getElementById('dbEditOverlay')) closeEditModalBtn();
}

function closeEditModalBtn() {
    document.getElementById('dbEditOverlay').classList.remove('open');
    _editingField = null;
}

function saveEditField() {
    if (!_editingField) return;
    const input = document.getElementById('dbEditInput');
    const val   = input?.value?.trim();
    if (!val) return;

    const cfg = FIELD_CONFIG[_editingField];

    // Determine display label
    let display = val;
    if (cfg.type === 'select') {
        const idx = cfg.options.indexOf(val);
        display = idx >= 0 ? cfg.labels[idx] : val;
    } else if (_editingField === 'income' || _editingField === 'budget') {
        display = '$' + Number(val).toLocaleString();
    } else if (_editingField === 'password') {
        display = '••••••••••';
    }

    // Update display
    const displayEl = document.getElementById(`f-${_editingField}`);
    if (displayEl && _editingField !== 'password') displayEl.textContent = display;

    // Persist to form data cache or auth user
    if (['name','email','password'].includes(_editingField)) {
        if (!window._authUser) window._authUser = {};
        window._authUser[_editingField] = val;
    } else {
        if (!window._formData) window._formData = {};
        window._formData[_editingField] = val;
        sessionStorage.setItem('homematchData', JSON.stringify(window._formData));
    }

    closeEditModalBtn();
}

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeEditModalBtn();
});

/* ---------- Load Dashboard ---------- */

async function loadDashboard() {
    const token = typeof getToken === 'function' ? getToken() : localStorage.getItem('hm_token');
    if (!token) { window.location.href = 'index.html'; return; }

    const API = window.HM_API || 'http://localhost:3001';

    /* ---- Auth user (name, email) ---- */
    try {
        const res = await fetch(`${API}/api/auth/me`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (res.status === 401) {
            if (typeof clearAuth === 'function') clearAuth();
            window.location.href = 'index.html';
            return;
        }
        const user = await res.json();
        window._authUser = user;
        const firstName = (user.name || '').split(' ')[0] || 'there';
        setText('dbGreeting', `Hi, ${firstName}.`);
        populateLogin(user);
    } catch {
        const cached = typeof getUser === 'function' ? getUser() : null;
        if (cached) {
            window._authUser = cached;
            const firstName = (cached.name || '').split(' ')[0] || 'there';
            setText('dbGreeting', `Hi, ${firstName}.`);
            populateLogin(cached);
        }
    }

    /* ---- Last form data from sessionStorage ---- */
    const raw = sessionStorage.getItem('homematchData');
    if (raw) {
        try {
            window._formData = JSON.parse(raw);
            populatePersonal(window._formData);
            populateFinancial(window._formData);
            populatePreferences(window._formData);
        } catch { /* ignore parse errors */ }
    }

    /* ---- Saved listings from localStorage ---- */
    renderSavedListings();

    /* ---- Hide loader ---- */
    const loader = document.getElementById('dbLoading');
    if (loader) loader.style.display = 'none';
}

loadDashboard();
