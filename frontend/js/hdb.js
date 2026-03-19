/* ============================================================
   js/hdb.js
   Shared HDB business logic: eligibility, grants, financials.
   Mirrors backend/services/grantCalculator.js for client-side
   real-time previews (no network required).
   ============================================================ */


/* ---------- Town List ---------- */

const HDB_TOWNS = [
    "Ang Mo Kio", "Bedok", "Bishan", "Bukit Batok", "Bukit Merah",
    "Bukit Panjang", "Choa Chu Kang", "Clementi", "Geylang", "Hougang",
    "Jurong East", "Jurong West", "Kallang / Whampoa", "Marine Parade",
    "Pasir Ris", "Punggol", "Queenstown", "Sembawang", "Sengkang",
    "Serangoon", "Tampines", "Toa Payoh", "Woodlands", "Yishun"
];


/* ---------- Eligibility Checker ---------- */

function checkEligibility(state) {
    const { marital, above35, citizenship, partnerCitizenship, income, flatType, purchaseType } = state;
    const incomeNum = Number(income) || 0;

    if (citizenship === "foreigner") {
        return {
            eligible: false,
            type: "error",
            messages: ["Foreigners are not eligible to purchase HDB flats."]
        };
    }

    const warnings = [];

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
                "You may apply under the Joint Singles Scheme (JSS) once you are 35."
            );
        } else {
            if (purchaseType === "bto" && flatType && flatType !== "2-room") {
                warnings.push(
                    "Singles (35+) applying for BTO are limited to 2-room Flexi flats only. " +
                    "Consider resale if you need a larger flat."
                );
            }
            if (incomeNum > 7000 && incomeNum > 0) {
                warnings.push(
                    `The income ceiling for singles applying for BTO is $7,000/month. ` +
                    `Your income ($${incomeNum.toLocaleString()}) exceeds this.`
                );
            }
        }
    }

    if (marital === "married" && incomeNum > 14000 && incomeNum > 0) {
        warnings.push(
            `The HDB income ceiling for families is $14,000/month. ` +
            `Your income ($${incomeNum.toLocaleString()}) exceeds this and may affect BTO eligibility.`
        );
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
    [7500, 20000], [8000, 15000], [8500, 10000], [9000,  5000]
];

function getEHG(income) {
    for (const [ceiling, grant] of EHG_TABLE) {
        if (income <= ceiling) return grant;
    }
    return 0;
}


/* ---------- Grant Calculator ----------
   Mirrors backend/services/grantCalculator.js exactly.
   @param {Object} state - form state from input.js
   @returns {{ grants: Array, total: number }}
*/

function calculateGrants(state) {
    const {
        marital, above35, citizenship, partnerCitizenship,
        householdStatus, income, flatType, purchaseType,
        nearParents, parentSameTown
    } = state;

    const incomeNum  = Number(income) || 0;
    const grants     = [];

    const isFirst    = householdStatus === "first";
    const isSecond   = householdStatus === "second";
    const isSingle35 = marital === "single" && above35 === "yes";
    const isMarried  = marital === "married";
    const isBTO      = purchaseType === "bto";
    const isResale   = purchaseType === "resale";
    const isSmall    = flatType === "2-room" || flatType === "3-room";
    const is4orSmall = isSmall || flatType === "4-room";
    const hasSC      = citizenship === "sc" || partnerCitizenship === "sc";

    /* 1. Enhanced CPF Housing Grant (EHG) — up to $80,000
          All purchase types. First-timer only. Income ceiling:
          Families ≤ $9,000 | Singles ≤ $4,500 per month.   */
    const ehgCeiling = isSingle35 ? 4500 : 9000;
    if (isFirst && incomeNum > 0 && incomeNum <= ehgCeiling) {
        const ehg = getEHG(incomeNum);
        if (ehg > 0) {
            grants.push({ name: "Enhanced CPF Housing Grant (EHG)", amount: ehg, type: "ehg" });
        }
    }

    /* 2. CPF Family Grant — resale only, married, ≥1 SC, first-timer
          $80,000 for 4-room and smaller; $50,000 for 5-room+         */
    if (isMarried && isResale && isFirst && hasSC) {
        grants.push({ name: "CPF Housing Grant (Family)", amount: is4orSmall ? 80000 : 50000, type: "family" });
    }

    /* 3. CPF Singles Grant — single 35+, resale, SC, first-timer     */
    if (isSingle35 && isResale && isFirst && citizenship === "sc") {
        grants.push({ name: "CPF Housing Grant (Singles)", amount: 40000, type: "singles" });
    }

    /* 4. Half-Housing Grant — one first-timer + one second-timer,
          married, resale, ≥1 SC.                                      */
    if (isSecond && isMarried && isResale && hasSC) {
        grants.push({ name: "CPF Housing Grant (Half-Housing)", amount: is4orSmall ? 40000 : 25000, type: "half-housing" });
    }

    /* 5. Step-Up CPF Housing Grant — $15,000
          Second-timer family in 2-room rental → 3-room or smaller BTO */
    if (isSecond && isMarried && isBTO && isSmall) {
        grants.push({ name: "Step-Up CPF Housing Grant", amount: 15000, type: "step-up" });
    }

    /* 6. Proximity Housing Grant (PHG) — resale only
          $30,000 same town; $20,000 within 4km                        */
    if (nearParents === "yes" && isResale) {
        const sameTown = parentSameTown === "yes";
        grants.push({
            name:   sameTown
                ? "Proximity Housing Grant – Same Town (PHG)"
                : "Proximity Housing Grant – Within 4km (PHG)",
            amount: sameTown ? 30000 : 20000,
            type:   "phg"
        });
    }

    const total = grants.reduce((sum, g) => sum + g.amount, 0);
    return { grants, total };
}


/* ---------- Financial Calculator ----------
   Includes effective price (budget − grants), MSR and TDSR.
*/

function calculateFinancials(budget, income, loanType, grantTotal = 0) {
    const budgetNum = Number(budget) || 0;
    const incomeNum = Number(income) || 0;
    if (budgetNum <= 0) return null;

    const TERM_MONTHS    = 300; // 25-year loan
    const isHDB          = loanType === "hdb";
    const ltv            = isHDB ? 0.80 : 0.75;
    const annualRate     = isHDB ? 0.026 : 0.035;
    const minCashPct     = isHDB ? 0.00  : 0.05;

    const effectivePrice  = Math.max(budgetNum - grantTotal, 0);
    const r               = annualRate / 12;
    const loanAmount      = Math.round(effectivePrice * ltv);
    const totalDown       = Math.round(effectivePrice * (1 - ltv));
    const cashDown        = Math.round(effectivePrice * minCashPct);
    const cpfDown         = totalDown - cashDown;
    const monthlyMortgage = loanAmount > 0
        ? Math.round(loanAmount * r / (1 - Math.pow(1 + r, -TERM_MONTHS)))
        : 0;

    // MSR (Mortgage Servicing Ratio) — HDB rule ≤ 30%
    const msrRatio  = incomeNum > 0 ? Math.round((monthlyMortgage / incomeNum) * 1000) / 10 : null;
    // TDSR (Total Debt Servicing Ratio) — MAS rule ≤ 55%
    const tdsrRatio = msrRatio; // simplified; add other debt repayments when collected

    return {
        effectivePrice,
        loanAmount,
        totalDown,
        cashDown,
        cpfDown,
        monthlyMortgage,
        msrRatio,
        tdsrRatio,
        msrWarning:  msrRatio  !== null && msrRatio  > 30,
        tdsrWarning: tdsrRatio !== null && tdsrRatio > 55,
        rateLabel:   isHDB ? "2.6% p.a." : "~3.5% p.a."
    };
}


/* ---------- Helpers ---------- */

function fmt(n) {
    return "$" + Math.round(n).toLocaleString();
}
