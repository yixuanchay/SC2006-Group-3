/* ============================================================
   js/hdb.js
   Shared HDB business logic: eligibility, grants, financials
   Loaded before input.js and results.js on pages that need it.
   ============================================================ */


/* ---------- Town List ---------- */

const HDB_TOWNS = [
    "Ang Mo Kio", "Bedok", "Bishan", "Bukit Batok", "Bukit Merah",
    "Bukit Panjang", "Bukit Timah", "Central Area", "Choa Chu Kang",
    "Clementi", "Geylang", "Hougang", "Jurong East", "Jurong West",
    "Kallang / Whampoa", "Marine Parade", "Pasir Ris", "Punggol",
    "Queenstown", "Sembawang", "Sengkang", "Serangoon", "Tampines",
    "Toa Payoh", "Woodlands", "Yishun"
];


/* ---------- Eligibility Checker ---------- */

function checkEligibility(state) {
    const { marital, above35, citizenship, partnerCitizenship, income, flatType, purchaseType } = state;
    const incomeNum = Number(income) || 0;

    // Foreigner — ineligible entirely
    if (citizenship === "foreigner") {
        return {
            eligible: false,
            type: "error",
            messages: ["Foreigners are not eligible to purchase HDB flats."]
        };
    }

    const warnings = [];

    // PR-only household cannot buy BTO
    if (citizenship === "pr") {
        const partnerIsPR = partnerCitizenship === "pr" || marital === "single";
        if (partnerIsPR && purchaseType === "bto") {
            warnings.push("PR applicants without a Singapore Citizen co-applicant can only purchase resale flats, not BTO.");
        }
    }

    if (marital === "single") {
        if (above35 === "no") {
            warnings.push(
                "Singles below 35 cannot purchase a flat independently. " +
                "You may apply under the Joint Singles Scheme (JSS) with another eligible single once you are 35."
            );
        } else {
            // Single, 35+
            if (purchaseType === "bto" && flatType && flatType !== "2-room") {
                warnings.push(
                    "Singles (35+) applying for BTO are limited to 2-room Flexi flats only. " +
                    "Consider resale if you need a larger flat."
                );
            }
            if (incomeNum > 7000 && incomeNum > 0) {
                warnings.push(
                    `The income ceiling for singles is $7,000/month. ` +
                    `Your income ($${incomeNum.toLocaleString()}) may affect BTO eligibility and grant amounts.`
                );
            }
        }
    }

    if (marital === "married") {
        if (incomeNum > 14000 && incomeNum > 0) {
            warnings.push(
                `The HDB income ceiling for families is $14,000/month. ` +
                `Your income ($${incomeNum.toLocaleString()}) exceeds this and may affect BTO eligibility.`
            );
        }
    }

    if (warnings.length === 0) {
        return {
            eligible: true,
            type: "ok",
            messages: ["Your profile appears eligible to purchase an HDB flat."]
        };
    }

    return { eligible: true, type: "warning", messages: warnings };
}


/* ---------- EHG Sliding Scale ---------- */

const EHG_TABLE = [
    [1500, 80000], [2000, 75000], [2500, 70000], [3000, 65000],
    [3500, 60000], [4000, 55000], [4500, 50000], [5000, 45000],
    [5500, 40000], [6000, 35000], [6500, 30000], [7000, 25000],
    [7500, 20000], [8000, 15000], [8500, 10000], [9000, 5000]
];

function getEHG(income) {
    for (const [ceiling, grant] of EHG_TABLE) {
        if (income <= ceiling) return grant;
    }
    return 0;
}


/* ---------- Grant Calculator ---------- */

function calculateGrants(state) {
    const { marital, above35, income, householdStatus, nearParents, flatType, purchaseType } = state;
    const incomeNum  = Number(income) || 0;
    const grants     = [];

    const isFirst    = householdStatus === "first";
    const isSecond   = householdStatus === "second";
    const isSingle35 = marital === "single" && above35 === "yes";
    const isMarried  = marital === "married";
    const isResale   = purchaseType === "resale";
    const isSmall    = flatType === "2-room" || flatType === "3-room";

    // Enhanced CPF Housing Grant (EHG) — all purchase types, first timer, income ≤ $9k
    if (isFirst && incomeNum > 0 && incomeNum <= 9000) {
        const ehg = getEHG(incomeNum);
        if (ehg > 0) {
            grants.push({ name: "Enhanced CPF Housing Grant (EHG)", amount: ehg });
        }
    }

    // CPF Family Grant — married couple buying resale, first timer
    if (isMarried && isResale && isFirst) {
        grants.push({ name: "CPF Housing Grant (Family)", amount: isSmall ? 40000 : 50000 });
    }

    // CPF Singles Grant — single 35+, resale, first timer
    if (isSingle35 && isResale && isFirst) {
        grants.push({ name: "CPF Housing Grant (Singles)", amount: 25000 });
    }

    // Half-Housing Grant — one first timer + one second timer (married, resale)
    if (isSecond && isMarried && isResale) {
        grants.push({ name: "CPF Housing Grant (Half-Housing)", amount: isSmall ? 20000 : 25000 });
    }

    // Proximity Housing Grant (PHG) — applies when buying near parents
    if (nearParents === "yes") {
        grants.push({ name: "Proximity Housing Grant (PHG)", amount: isMarried ? 30000 : 20000 });
    }

    const total = grants.reduce((sum, g) => sum + g.amount, 0);
    return { grants, total };
}


/* ---------- Financial Calculator ---------- */

function calculateFinancials(budget, income, loanType) {
    const budgetNum = Number(budget) || 0;
    const incomeNum = Number(income) || 0;
    if (budgetNum <= 0) return null;

    const TERM_MONTHS = 300; // 25-year loan

    const isHDB      = loanType === "hdb";
    const ltv        = isHDB ? 0.80 : 0.75;
    const annualRate = isHDB ? 0.026 : 0.035;
    const minCashPct = isHDB ? 0.00 : 0.05; // bank loan requires min 5% cash

    const r               = annualRate / 12;
    const loanAmount      = Math.round(budgetNum * ltv);
    const totalDown       = Math.round(budgetNum * (1 - ltv));
    const cashDown        = Math.round(budgetNum * minCashPct);
    const cpfDown         = totalDown - cashDown;
    const monthlyMortgage = Math.round(loanAmount * r / (1 - Math.pow(1 + r, -TERM_MONTHS)));
    const msrRatio        = incomeNum > 0
        ? Math.round((monthlyMortgage / incomeNum) * 1000) / 10
        : null;

    return {
        loanAmount,
        totalDown,
        cashDown,
        cpfDown,
        monthlyMortgage,
        msrRatio,
        msrWarning: msrRatio !== null && msrRatio > 30,
        rateLabel:  isHDB ? "2.6% p.a." : "~3.5% p.a."
    };
}


/* ---------- Helpers ---------- */

function fmt(n) {
    return "$" + Math.round(n).toLocaleString();
}
