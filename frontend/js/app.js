/* ---------- Navigation ---------- */

function goHome() {
    window.location.href = "index.html";
}

function continueGuest() {
    window.location.href = "input.html";
}


/* ---------- Modal Controls ---------- */

function openModal() {
    const modal = document.getElementById("loginModal");
    if (!modal) return;
    modal.style.display = "block";

    modal.addEventListener("click", function onBackdrop(e) {
        if (e.target === modal) {
            closeModal();
            modal.removeEventListener("click", onBackdrop);
        }
    });
}

function closeModal() {
    const modal = document.getElementById("loginModal");
    if (modal) modal.style.display = "none";
}


/* ---------- Navbar Injection ---------- */

(function injectNavbar() {
    const slot = document.getElementById("navbar-slot");
    if (!slot) return;
    slot.outerHTML = `
        <nav class="navbar">
            <div class="logo">HomeMatch</div>
            <button class="home-btn" onclick="goHome()">Home</button>
        </nav>
    `;
}());
