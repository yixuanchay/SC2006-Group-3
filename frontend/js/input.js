/* ============================================================
   input.js — HomeMatch Setup Form
   Depends on: hdb.js (loaded first)
   ============================================================ */


/* ---------- Form State ---------- */

const formState = {
    marital:            null,
    above35:            null,
    citizenship:        null,
    partnerCitizenship: null,
    householdStatus:    null,
    employmentStatus:   null,
    income:             null,
    flatType:           "4-room",
    purchaseType:       null,
    budget:             null,
    loanType:           "hdb",
    nearParents:        null,
    parentsTown:        null,
    workplaceMRT:       null,
    preferences:        []
};


/* ---------- Step Wizard ---------- */

let currentStep = 0;

const STEP_LABELS = [
    "Step 1 of 3 — Personal Information",
    "Step 2 of 3 — Financial Information",
    "Step 3 of 3 — Location Preferences"
];

function getSteps()      { return document.querySelectorAll(".form-step"); }

function showStep(index) {
    const steps = getSteps();
    if (!steps.length) return;

    steps.forEach(s => s.classList.remove("active"));
    steps[index].classList.add("active");

    // Update numbered circles
    document.querySelectorAll(".step[data-step]").forEach((ind, i) => {
        ind.classList.remove("active", "completed");
        if      (i < index)  ind.classList.add("completed");
        else if (i === index) ind.classList.add("active");
    });

    // Fill connecting lines
    document.querySelectorAll(".step-line").forEach((line, i) => {
        line.classList.toggle("completed", i < index);
    });

    // Update step progress label
    const label = document.getElementById("stepProgressLabel");
    if (label) label.textContent = STEP_LABELS[index];

    // Update move-button disabled states on pref list
    if (index === 2) updateMoveBtnStates();

    // Swap background image per step
    var bgImages = [
        "images/personal-information.png",
        "images/financial-calc.png",
        "images/bto-choosepreference.jpg"
    ];
    var bgImg = document.querySelector(".input-page-bg img");
    if (bgImg && bgImages[index]) bgImg.src = bgImages[index];

    currentStep = index;
}

function goStep(index) {
    // Only allow navigating back to a completed step
    if (index < currentStep) {
        clearAllErrors();
        showStep(index);
    }
}

function nextStep() {
    if (!validateStep()) return;
    saveStepState();
    const steps = getSteps();
    if (currentStep < steps.length - 1) showStep(currentStep + 1);
}

function prevStep() {
    clearAllErrors();
    if (currentStep > 0) showStep(currentStep - 1);
}


/* ---------- Inline Validation ---------- */

function showFieldError(id, message) {
    const el = document.getElementById("error-" + id);
    if (!el) return;
    el.textContent = message;
    el.classList.add("visible");
    const field = document.getElementById(id);
    if (field) field.classList.add("field-invalid");
}

function clearFieldError(id) {
    const el = document.getElementById("error-" + id);
    if (!el) return;
    el.textContent = "";
    el.classList.remove("visible");
    const field = document.getElementById(id);
    if (field) field.classList.remove("field-invalid");
}

function clearAllErrors() {
    document.querySelectorAll(".field-error").forEach(el => {
        el.textContent = "";
        el.classList.remove("visible");
    });
    document.querySelectorAll(".field-invalid").forEach(el => {
        el.classList.remove("field-invalid");
    });
}

function validateStep() {
    clearAllErrors();
    let valid = true;

    if (currentStep === 0) {
        const marital = document.querySelector('input[name="marital"]:checked');
        if (!marital) {
            showFieldError("marital", "Please select your marital status.");
            valid = false;
        } else if (marital.value === "single") {
            const above35 = document.querySelector('input[name="above35"]:checked');
            if (!above35) {
                showFieldError("above35", "Please indicate if you are above 35.");
                valid = false;
            }
        }
        const income = document.getElementById("income");
        if (!income.value || Number(income.value) < 0) {
            showFieldError("income", "Please enter a valid monthly income (0 if unemployed).");
            valid = false;
        }
    }

    if (currentStep === 1) {
        const purchaseType = document.querySelector('input[name="purchaseType"]:checked');
        if (!purchaseType) {
            showFieldError("purchaseType", "Please select BTO or Resale.");
            valid = false;
        }
        const budget = document.getElementById("budget");
        if (!budget.value || Number(budget.value) <= 0) {
            showFieldError("budget", "Please enter a valid housing budget.");
            valid = false;
        }
        const nearParents = document.querySelector('input[name="nearParents"]:checked');
        if (!nearParents) {
            showFieldError("nearParents", "Please indicate if you want to live near your parents.");
            valid = false;
        }
    }

    // Scroll first error into view
    const firstError = document.querySelector(".field-error.visible");
    if (firstError) firstError.scrollIntoView({ behavior: "smooth", block: "center" });

    return valid;
}


/* ---------- Personal Info Handlers ---------- */

function handleMarital() {
    const marital = document.querySelector('input[name="marital"]:checked')?.value;
    const singleAge       = document.getElementById("singleAge");
    const partnerCitizenDiv = document.getElementById("partnerCitizenDiv");

    if (marital === "single") {
        singleAge.style.display = "block";
        partnerCitizenDiv.style.display = "none";
    } else if (marital === "married") {
        singleAge.style.display = "none";
        partnerCitizenDiv.style.display = "block";
    }

    updateEligibilityBanner();
    updateFinancialSummary();
}

function handleIncomeChange() {
    clearFieldError("income");
    updateEligibilityBanner();
    updateFinancialSummary();
}

function handleFlatTypeChange() {
    updateEligibilityBanner();
    updateFinancialSummary();
}

function handlePurchaseTypeChange() {
    clearFieldError("purchaseType");
    updateEligibilityBanner();
    updateFinancialSummary();
}

function handleNearParents() {
    const nearParents = document.querySelector('input[name="nearParents"]:checked')?.value;
    const div = document.getElementById("parentsTownDiv");
    if (div) div.style.display = nearParents === "yes" ? "block" : "none";
    clearFieldError("nearParents");
    updateFinancialSummary();
}


/* ---------- Save Step State ---------- */

function saveStepState() {
    if (currentStep === 0) {
        formState.marital            = document.querySelector('input[name="marital"]:checked')?.value ?? null;
        formState.above35            = document.querySelector('input[name="above35"]:checked')?.value ?? null;
        formState.citizenship        = document.getElementById("citizenship")?.value ?? null;
        formState.partnerCitizenship = document.getElementById("partnerCitizenship")?.value ?? null;
        formState.householdStatus    = document.getElementById("householdStatus")?.value ?? null;
        formState.employmentStatus   = document.getElementById("employmentStatus")?.value ?? null;
        formState.income             = document.getElementById("income")?.value ?? null;
        formState.flatType           = document.getElementById("flatType")?.value ?? null;
    }
    if (currentStep === 1) {
        formState.purchaseType = document.querySelector('input[name="purchaseType"]:checked')?.value ?? null;
        formState.budget       = document.getElementById("budget")?.value ?? null;
        formState.loanType     = document.getElementById("loanType")?.value ?? null;
        formState.nearParents  = document.querySelector('input[name="nearParents"]:checked')?.value ?? null;
        formState.parentsTown  = document.getElementById("parentsTown")?.value ?? null;
        formState.workplaceMRT = document.getElementById("workplaceMRT")?.value ?? null;
    }
}


/* ---------- Eligibility Banner ---------- */

function updateEligibilityBanner() {
    const banner = document.getElementById("eligibilityBanner");
    if (!banner) return;

    const snap = {
        marital:            document.querySelector('input[name="marital"]:checked')?.value,
        above35:            document.querySelector('input[name="above35"]:checked')?.value,
        citizenship:        document.getElementById("citizenship")?.value,
        partnerCitizenship: document.getElementById("partnerCitizenship")?.value,
        income:             document.getElementById("income")?.value,
        flatType:           document.getElementById("flatType")?.value,
        purchaseType:       document.querySelector('input[name="purchaseType"]:checked')?.value
    };

    if (!snap.marital) {
        banner.style.display = "none";
        return;
    }

    const result = checkEligibility(snap);
    const icons  = {
        ok:      '<img src="images/Checkmark Icon.png" alt="Eligible">',
        warning: '<img src="images/Caution Icon.png" alt="Warning">',
        error:   '<img src="images/Close Icon.png" alt="Not Eligible">'
    };

    banner.className = `eligibility-banner ${result.type}`;
    banner.style.display = "block";
    banner.innerHTML = `
        <div class="eligibility-banner-title">
            ${icons[result.type]} Eligibility Check
        </div>
        ${result.messages.map(m => `<p>${m}</p>`).join("")}
    `;
}


/* ---------- Real-Time Financial Summary ---------- */

function updateFinancialSummary() {
    const budget   = document.getElementById("budget")?.value;
    const income   = document.getElementById("income")?.value;
    const loanType = document.getElementById("loanType")?.value || "hdb";

    // Build a partial formState for grant calculation
    const snap = {
        marital:       document.querySelector('input[name="marital"]:checked')?.value,
        above35:       document.querySelector('input[name="above35"]:checked')?.value,
        income,
        householdStatus: document.getElementById("householdStatus")?.value,
        nearParents:   document.querySelector('input[name="nearParents"]:checked')?.value,
        flatType:      document.getElementById("flatType")?.value,
        purchaseType:  document.querySelector('input[name="purchaseType"]:checked')?.value
    };

    const fin    = calculateFinancials(budget, income, loanType);
    const { grants, total: grantTotal } = calculateGrants(snap);

    // Rate label
    const rateLabel = document.getElementById("summaryRate");
    if (fin) {
        rateLabel.textContent = `Based on ${fin.rateLabel} interest, 25-year loan term`;
    } else {
        rateLabel.textContent = "Enter your budget above to see estimates";
    }

    // Financial rows
    setText("calc-downpayment", fin ? fmt(fin.totalDown)       : "—");
    setText("calc-cash",        fin ? fmt(fin.cashDown)        : "—");
    setText("calc-cpf",         fin ? fmt(fin.cpfDown)         : "—");
    setText("calc-loan",        fin ? fmt(fin.loanAmount)      : "—");
    setText("calc-mortgage",    fin ? fmt(fin.monthlyMortgage) + "/mo" : "—");

    // MSR warning
    const msrRow = document.getElementById("msrWarningRow");
    if (msrRow) msrRow.classList.toggle("visible", !!(fin?.msrWarning));

    // Grants display
    const grantsDiv = document.getElementById("grantsDisplay");
    if (grantsDiv) {
        if (!snap.marital) {
            grantsDiv.innerHTML = `<p class="no-grants-msg">Complete Step 1 to see grant eligibility</p>`;
        } else if (grants.length === 0) {
            grantsDiv.innerHTML = `<p class="no-grants-msg">No grants estimated for your current profile</p>`;
        } else {
            grantsDiv.innerHTML = `
                <ul class="grants-list">
                    ${grants.map(g => `
                        <li>
                            <span>${g.name}</span>
                            <span class="grant-amount">+${fmt(g.amount)}</span>
                        </li>
                    `).join("")}
                </ul>
                <div class="grants-total">
                    <span>Total estimated grants</span>
                    <span style="color:#166534;">+${fmt(grantTotal)}</span>
                </div>
            `;
        }
    }

    // Effective price
    const budgetNum = Number(budget) || 0;
    const effective = budgetNum > 0
        ? fmt(Math.max(0, budgetNum - grantTotal))
        : "—";
    setText("calc-effective", effective);
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}


/* ---------- Drag Ranking ---------- */

const prefList = document.getElementById("preferenceList");

if (prefList) {
    let draggedItem = null;

    document.querySelectorAll(".pref-item").forEach(item => {
        item.setAttribute("draggable", true);

        item.addEventListener("dragstart", () => { draggedItem = item; });
        item.addEventListener("dragover",  e => { e.preventDefault(); });

        item.addEventListener("dragenter", () => {
            if (draggedItem !== item) item.classList.add("drag-over");
        });

        item.addEventListener("dragleave", () => {
            item.classList.remove("drag-over");
        });

        item.addEventListener("drop", () => {
            item.classList.remove("drag-over");
            if (draggedItem && draggedItem !== item) {
                const items = [...prefList.children];
                if (items.indexOf(draggedItem) < items.indexOf(item)) item.after(draggedItem);
                else item.before(draggedItem);
                updateRanking();
            }
        });
    });

    updateRanking();
}

function updateRanking() {
    document.querySelectorAll("#preferenceList .pref-item").forEach((item, index) => {
        const rank = item.querySelector(".rank");
        if (rank) rank.textContent = (index + 1) + ".";
    });
    updateMoveBtnStates();
}


/* ---------- Keyboard Navigation (↑/↓ buttons) ---------- */

function movePref(btn, direction) {
    const item = btn.closest(".pref-item");
    if (!item) return;

    if (direction === -1 && item.previousElementSibling) {
        item.previousElementSibling.before(item);
    } else if (direction === 1 && item.nextElementSibling) {
        item.nextElementSibling.after(item);
    }

    updateRanking();
}

function updateMoveBtnStates() {
    const items = document.querySelectorAll("#preferenceList .pref-item");
    items.forEach((item, index) => {
        const [upBtn, downBtn] = item.querySelectorAll(".pref-move-btn");
        if (upBtn)   upBtn.disabled   = index === 0;
        if (downBtn) downBtn.disabled = index === items.length - 1;
    });
}


/* ---------- Submit ---------- */

function submitForm() {
    if (!validateStep()) return;
    saveStepState();

    const items = document.querySelectorAll("#preferenceList li");
    formState.preferences = [];
    items.forEach((item, index) => {
        formState.preferences.push({
            factor: item.dataset.factor,
            label:  item.dataset.label,
            weight: items.length - index
        });
    });

    sessionStorage.setItem("homematchData", JSON.stringify(formState));
    window.location.href = "results.html";
}


/* ---------- Populate Parents' Town Dropdown ---------- */

(function populateParentsTown() {
    const select = document.getElementById("parentsTown");
    if (!select || typeof HDB_TOWNS === "undefined") return;
    HDB_TOWNS.forEach(town => {
        const opt = document.createElement("option");
        opt.value = town;
        opt.textContent = town;
        select.appendChild(opt);
    });
}());
