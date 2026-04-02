/* ============================================================
   dashboard.js — HomeMatch Personal Dashboard
   Depends on: app.js (getToken, getUser, isLoggedIn, HM_API)
   ============================================================ */


/* ============================================================
   Helpers
   ============================================================ */

function fmt(n) { return '$' + Number(n).toLocaleString('en-SG'); }

function getInitials(name, email) {
    if (name) return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
    if (email) return email[0].toUpperCase();
    return '?';
}

/** Derive a consistent hue from a string (for avatar bg colour) */
function nameHue(str) {
    let h = 0;
    for (const c of (str || 'U')) h = c.charCodeAt(0) + (h << 5) - h;
    return Math.abs(h) % 360;
}

function timeAgo(isoString) {
    const diff  = Date.now() - new Date(isoString).getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(diff / 86400000);
    if (mins  < 1)  return 'Just now';
    if (mins  < 60) return `${mins} min ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (days  < 7)  return `${days} day${days > 1 ? 's' : ''} ago`;
    return new Date(isoString).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });
}

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

function citizenLabel(code) {
    return { sc: 'Singapore Citizen', pr: 'Permanent Resident', foreigner: 'Foreigner' }[code] || '—';
}


/* ============================================================
   Render Profile
   ============================================================ */

function renderProfile(user) {
    const name   = user.name  || '';
    const email  = user.email || '';
    const hue    = nameHue(name || email);
    const initials = getInitials(name, email);

    const avatar = document.getElementById('profileAvatar');
    if (avatar) {
        avatar.textContent = initials;
        avatar.style.background = `hsl(${hue}, 58%, 46%)`;
    }

    setText('profileName',       name  || 'Account');
    setText('profileEmail',      email);
    setText('sidebarName',       name  || '—');
    setText('sidebarEmail',      email || '—');
    setText('sidebarCitizenship', citizenLabel(user.citizenship));
}

function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}


/* ============================================================
   Render Saved Searches
   ============================================================ */

function renderSearches(searches) {
    const list     = document.getElementById('savedSearchesList');
    const badge    = document.getElementById('sectionCountBadge');
    const statEl   = document.getElementById('statSearches');
    const clearBtn = document.getElementById('clearAllBtn');

    if (badge)  badge.textContent  = searches.length || '';
    if (statEl) statEl.textContent = searches.length;
    if (clearBtn) clearBtn.style.display = searches.length ? 'block' : 'none';

    if (!list) return;

    if (searches.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔍</div>
                <h4>No saved searches yet</h4>
                <p>Run a search and tap <strong>Save Search</strong> to store it here.</p>
                <button class="sidebar-btn sidebar-btn--primary" style="margin-top:16px;"
                        onclick="window.location.href='input.html'">Start a Search</button>
            </div>`;
        return;
    }

    list.innerHTML = searches.map(s => buildSearchCard(s)).join('');
}

function buildSearchCard(s) {
    const fd      = s.form_data || {};
    const towns   = Array.isArray(s.top_results) ? s.top_results : [];
    const dateStr = timeAgo(s.created_at || s.timestamp || new Date().toISOString());
    const title   = s.name || buildTitle(fd);

    /* Preference chips */
    const chips = [
        fd.marital     && `<span class="info-chip">${capitalize(fd.marital)}</span>`,
        fd.purchaseType && `<span class="info-chip">${fd.purchaseType === 'bto' ? 'BTO' : 'Resale'}</span>`,
        fd.flatType     && `<span class="info-chip">${fd.flatType}</span>`,
        fd.budget       && `<span class="info-chip">Budget ${fmt(fd.budget)}</span>`,
        fd.nearParents === 'yes' && `<span class="info-chip">Near Parents</span>`,
    ].filter(Boolean).join('');

    /* Top result pills */
    const townPills = towns.length
        ? towns.map(t => `<span class="result-town-pill">${t}</span>`).join('')
        : '<span class="no-results-text">No results saved</span>';

    return `
        <div class="saved-search-card" id="sc-${s.id}">
            <div class="saved-search-top">
                <div>
                    <div class="saved-search-title">${title}</div>
                    <div class="saved-search-date">${dateStr}</div>
                </div>
                <button class="delete-search-btn" onclick="deleteSearch(${s.id})" title="Delete search">✕</button>
            </div>

            <div class="saved-search-towns">
                <span class="saved-search-towns-label">Top results</span>
                <div class="saved-search-town-pills">${townPills}</div>
            </div>

            ${chips ? `<div class="saved-search-chips">${chips}</div>` : ''}

            <div class="saved-search-actions">
                <button class="view-results-btn" onclick="viewSearch(${s.id})">View Results →</button>
            </div>
        </div>`;
}

function buildTitle(fd) {
    const parts = [];
    if (fd.purchaseType) parts.push(fd.purchaseType === 'bto' ? 'BTO' : 'Resale');
    if (fd.flatType)     parts.push(fd.flatType + ' flat');
    return parts.join(' · ') || 'Search';
}


/* ============================================================
   Actions
   ============================================================ */

function viewSearch(id) {
    // Grab the form_data from the rendered card's cached search list
    const search = window._searches?.find(s => s.id === id || String(s.id) === String(id));
    if (!search?.form_data) return;
    sessionStorage.setItem('homematchData', JSON.stringify(search.form_data));
    window.location.href = 'results.html';
}

async function deleteSearch(id) {
    const card = document.getElementById(`sc-${id}`);
    if (card) { card.style.opacity = '0.4'; card.style.pointerEvents = 'none'; }

    const token = getToken();
    try {
        if (token) {
            const res = await fetch(`${window.HM_API}/api/auth/saved-searches/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Delete failed');
        }
        window._searches = (window._searches || []).filter(s => String(s.id) !== String(id));
        renderSearches(window._searches);
    } catch {
        if (card) { card.style.opacity = ''; card.style.pointerEvents = ''; }
    }
}

function clearAllSearches() {
    if (!confirm('Delete all saved searches? This cannot be undone.')) return;
    (window._searches || []).forEach(s => deleteSearch(s.id));
}


/* ============================================================
   Load Dashboard Data
   ============================================================ */

function showDashState(state) {
    document.getElementById('dashLoadingState').style.display = state === 'loading' ? 'flex'  : 'none';
    document.getElementById('dashErrorState').style.display   = state === 'error'   ? 'flex'  : 'none';
    document.getElementById('dashContent').style.display      = state === 'ready'   ? 'block' : 'none';
}

async function loadDashboard() {
    const token = getToken();
    if (!token) { window.location.href = 'index.html'; return; }

    showDashState('loading');

    const API = window.HM_API || 'http://localhost:3001';

    /* ---- Profile ---- */
    try {
        const res  = await fetch(`${API}/api/auth/me`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (res.status === 401) { clearAuth(); window.location.href = 'index.html'; return; }
        if (!res.ok) throw new Error();
        const user = await res.json();
        renderProfile(user);
    } catch {
        /* Fallback: use locally cached user */
        const cached = getUser();
        if (cached) renderProfile(cached);
    }

    /* ---- Saved Searches ---- */
    try {
        const res     = await fetch(`${API}/api/auth/saved-searches`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error();
        const searches = await res.json();
        window._searches = searches;
        renderSearches(searches);
        showDashState('ready');
    } catch {
        /* Show a friendly error with a retry button */
        document.getElementById('dashErrorMsg').textContent =
            'Could not reach the server. Check that the backend is running.';
        showDashState('error');
    }
}


/* ============================================================
   Init
   ============================================================ */

loadDashboard();
