/* ============================================================
   js/app.js
   Navigation, auth modal, JWT helpers, navbar injection.
   ============================================================ */

/* ---- API base URL — update when backend is deployed ---- */
window.HM_API = 'http://localhost:3001';

/* ---- Navigation ---- */
function goHome()       { window.location.href = 'index.html'; }
function continueGuest(){ window.location.href = 'input.html'; }
function goDashboard()  { window.location.href = 'dashboard.html'; }

/* ================================================================
   JWT Helpers
   ================================================================ */

function getToken() {
    return localStorage.getItem('hm_token');
}

function setToken(token, user) {
    localStorage.setItem('hm_token', token);
    localStorage.setItem('hm_user',  JSON.stringify(user));
}

function clearAuth() {
    localStorage.removeItem('hm_token');
    localStorage.removeItem('hm_user');
}

function getUser() {
    try { return JSON.parse(localStorage.getItem('hm_user')); }
    catch { return null; }
}

function isLoggedIn() {
    return !!getToken();
}

/* ================================================================
   Modal Controls
   ================================================================ */

function openModal(tab = 'login') {
    const modal = document.getElementById('authModal');
    if (!modal) return;
    modal.style.display = 'flex';
    switchTab(tab);

    modal.addEventListener('click', function onBackdrop(e) {
        if (e.target === modal) {
            closeModal();
            modal.removeEventListener('click', onBackdrop);
        }
    });
}

function closeModal() {
    const modal = document.getElementById('authModal');
    if (modal) modal.style.display = 'none';
    clearAuthErrors();
}

function switchTab(tab) {
    const loginForm    = document.getElementById('form-login');
    const registerForm = document.getElementById('form-register');
    const tabLogin     = document.getElementById('tab-login');
    const tabRegister  = document.getElementById('tab-register');
    if (!loginForm || !registerForm) return;

    if (tab === 'login') {
        loginForm.style.display    = 'block';
        registerForm.style.display = 'none';
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
    } else {
        loginForm.style.display    = 'none';
        registerForm.style.display = 'block';
        tabLogin.classList.remove('active');
        tabRegister.classList.add('active');
    }
    clearAuthErrors();
}

function showAuthError(formId, message) {
    const el = document.getElementById(formId);
    if (el) { el.textContent = message; el.style.display = 'block'; }
}

function clearAuthErrors() {
    ['loginError', 'registerError'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.textContent = ''; el.style.display = 'none'; }
    });
}

/* ================================================================
   Auth Handlers
   ================================================================ */

async function handleLogin() {
    const email    = document.getElementById('loginEmail')?.value.trim();
    const password = document.getElementById('loginPassword')?.value;
    if (!email || !password) {
        showAuthError('loginError', 'Please enter your email and password.');
        return;
    }

    try {
        const res = await fetch(`${window.HM_API}/api/auth/login`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok) { showAuthError('loginError', data.error || 'Login failed.'); return; }

        setToken(data.token, data.user);
        closeModal();
        refreshNavbar();
        // If on landing page, go to dashboard; otherwise stay on current page
        if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/') {
            goDashboard();
        }
    } catch {
        showAuthError('loginError', 'Network error — is the backend running?');
    }
}

async function handleRegister() {
    const name        = document.getElementById('regName')?.value.trim();
    const email       = document.getElementById('regEmail')?.value.trim();
    const password    = document.getElementById('regPassword')?.value;

    if (!email || !password) {
        showAuthError('registerError', 'Email and password are required.');
        return;
    }
    if (password.length < 8) {
        showAuthError('registerError', 'Password must be at least 8 characters.');
        return;
    }

    try {
        const res = await fetch(`${window.HM_API}/api/auth/register`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ name, email, password })
        });
        const data = await res.json();
        if (!res.ok) { showAuthError('registerError', data.error || 'Registration failed.'); return; }

        setToken(data.token, data.user);
        closeModal();
        refreshNavbar();
        goDashboard();
    } catch {
        showAuthError('registerError', 'Network error — is the backend running?');
    }
}

function showForgotPassword() {
    const email = prompt('Enter your email address and we\'ll send a reset link:');
    if (!email) return;
    fetch(`${window.HM_API}/api/auth/forgot-password`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email })
    })
    .then(r => r.json())
    .then(d => alert(d.message || 'If that email exists, a reset link has been sent.'))
    .catch(() => alert('Network error.'));
}

function handleLogout() {
    clearAuth();
    refreshNavbar();
    window.location.href = 'index.html';
}

/* ================================================================
   Navbar Injection
   ================================================================ */

function refreshNavbar() {
    const slot = document.getElementById('navbar-slot');
    // slot may already have been replaced; find the nav instead
    const existing = document.querySelector('nav.navbar');
    const target   = existing || slot;
    if (!target) return;

    const loggedIn = isLoggedIn();

    const navHTML = `
        <nav class="navbar">
            <div class="logo" onclick="goHome()" style="cursor:pointer;">
                <img src="images/logo-homematch.png" alt="HomeMatch" class="logo-img" style="height:56px;width:56px;object-fit:contain;">
            </div>
            <div class="navbar-center">
                <a class="navbar-link" href="index.html">Home</a>
                <a class="navbar-link" href="index.html#how-it-works">How it Works</a>
                <a class="navbar-link" href="index.html#features">Features</a>
            </div>
            <div class="navbar-actions">
                ${loggedIn ? `
                    <a class="navbar-link" href="dashboard.html">Dashboard</a>
                    <button class="nav-btn nav-btn-logout" onclick="handleLogout()">Log Out</button>
                ` : `
                    <button class="nav-btn nav-btn-signup" onclick="openModal('register')">Sign Up</button>
                    <button class="nav-btn nav-btn-login" onclick="openModal('login')">Log In</button>
                `}
            </div>
        </nav>`;

    if (existing) {
        existing.outerHTML = navHTML;
    } else if (slot) {
        slot.outerHTML = navHTML;
    }
}

/* ---- Init: inject navbar on every page load ---- */
(function init() {
    refreshNavbar();
}());
