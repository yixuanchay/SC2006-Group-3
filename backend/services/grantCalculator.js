/* ============================================================
   services/grantCalculator.js
   Full grant eligibility + financial calculations for HomeMatch.
   ============================================================ */

/* ---------- EHG Sliding Scale (Enhanced CPF Housing Grant) ----------
   Source: HDB EHG page. Income brackets per month.
   Singles use halved ceilings (÷2 for the income check; same table).
   ------------------------------------------------------------------- */
const EHG_TABLE = [
    [1500,  80000], [2000,  75000], [2500,  70000], [3000,  65000],
    [3500,  60000], [4000,  55000], [4500,  50000], [5000,  45000],
    [5500,  40000], [6000,  35000], [6500,  30000], [7000,  25000],
    [7500,  20000], [8000,  15000], [8500,  10000], [9000,   5000]
];

function getEHG(income) {
    for (const [ceiling, grant] of EHG_TABLE) {
        if (income <= ceiling) return grant;
    }
    return 0;
}

/* ---------- Grant Calculator ----------
   @param {Object} profile
     marital         'single' | 'married'
     above35         'yes' | 'no'          (singles only)
     citizenship     'sc' | 'pr'
     partnerCitizenship 'sc' | 'pr' | null (married only)
     householdStatus 'first' | 'second'
     income          number  (combined monthly)
     flatType        '2-room' | '3-room' | '4-room' | '5-room' | 'executive'
     purchaseType    'bto' | 'resale'
     nearParents     'yes' | 'no'
     parentSameTown  'yes' | 'no'         (only relevant if nearParents === 'yes')
   @returns {{ grants: Array<{name, amount, type}>, total: number }}
*/
function calculateGrants(profile) {
    const {
        marital, above35, citizenship, partnerCitizenship,
        householdStatus, income, flatType, purchaseType,
        nearParents, parentSameTown
    } = profile;

    const incomeNum = Number(income) || 0;
    const grants    = [];

    const isFirst    = householdStatus === 'first';
    const isSecond   = householdStatus === 'second';
    const isSingle35 = marital === 'single' && above35 === 'yes';
    const isMarried  = marital === 'married';
    const isBTO      = purchaseType === 'bto';
    const isResale   = purchaseType === 'resale';
    const isSmall    = flatType === '2-room' || flatType === '3-room';
    const is4orSmall = isSmall || flatType === '4-room';
    const hasSC      = citizenship === 'sc' || partnerCitizenship === 'sc';

    /* 1. Enhanced CPF Housing Grant (EHG) — up to $80,000
          All purchase types. First-timer. Income ceiling:
          Families ≤ $9,000 | Singles ≤ $4,500 per month.            */
    const ehgCeiling = isSingle35 ? 4500 : 9000;
    if (isFirst && incomeNum > 0 && incomeNum <= ehgCeiling) {
        const ehg = getEHG(incomeNum);
        if (ehg > 0) {
            grants.push({ name: 'Enhanced CPF Housing Grant (EHG)', amount: ehg, type: 'ehg' });
        }
    }

    /* 2. CPF Family Grant — resale only, married, ≥1 SC, first-timer
          $80,000 for 4-room and smaller; $50,000 for 5-room+         */
    if (isMarried && isResale && isFirst && hasSC) {
        const amount = is4orSmall ? 80000 : 50000;
        grants.push({ name: 'CPF Housing Grant (Family)', amount, type: 'family' });
    }

    /* 3. CPF Singles Grant — single 35+, resale, SC, first-timer
          $40,000 (updated 2024 figure)                               */
    if (isSingle35 && isResale && isFirst && citizenship === 'sc') {
        grants.push({ name: 'CPF Housing Grant (Singles)', amount: 40000, type: 'singles' });
    }

    /* 4. Half-Housing Grant — one first-timer + one second-timer,
          married, resale, ≥1 SC.
          $40,000 for 4-room and smaller; $25,000 for 5-room+         */
    if (isSecond && isMarried && isResale && hasSC) {
        const amount = is4orSmall ? 40000 : 25000;
        grants.push({ name: 'CPF Housing Grant (Half-Housing)', amount, type: 'half-housing' });
    }

    /* 5. Step-Up CPF Housing Grant — $15,000
          Second-timer family in 2-room rental → 3-room or smaller BTO
          in non-mature estate.                                        */
    if (isSecond && isMarried && isBTO && isSmall) {
        grants.push({ name: 'Step-Up CPF Housing Grant', amount: 15000, type: 'step-up' });
    }

    /* 6. Proximity Housing Grant (PHG) — resale only
          $30,000 to live with / in same town as parents
          $20,000 to live within 4km of parents                       */
    if (nearParents === 'yes' && isResale) {
        const sameTown = parentSameTown === 'yes';
        grants.push({
            name:   sameTown
                ? 'Proximity Housing Grant – Same Town (PHG)'
                : 'Proximity Housing Grant – Within 4km (PHG)',
            amount: sameTown ? 30000 : 20000,
            type:   'phg'
        });
    }

    const total = grants.reduce((sum, g) => sum + g.amount, 0);
    return { grants, total };
}

/* ---------- Financial Calculator ----------
   @param {{ budget, income, loanType, grantTotal }}
   @returns financial breakdown object or null if budget ≤ 0
*/
function calculateFinancials({ budget, income, loanType, grantTotal = 0 }) {
    const budgetNum = Number(budget) || 0;
    const incomeNum = Number(income) || 0;
    const grants    = Number(grantTotal) || 0;
    if (budgetNum <= 0) return null;

    const TERM_MONTHS = 300; // 25-year loan
    const isHDB       = loanType === 'hdb';
    const ltv         = isHDB ? 0.80 : 0.75;
    const annualRate  = isHDB ? 0.026 : 0.035;
    const minCashPct  = isHDB ? 0.00  : 0.05; // bank: min 5% cash

    const effectivePrice  = Math.max(budgetNum - grants, 0);
    const r               = annualRate / 12;
    const loanAmount      = Math.round(effectivePrice * ltv);
    const totalDown       = Math.round(effectivePrice * (1 - ltv));
    const cashDown        = Math.round(effectivePrice * minCashPct);
    const cpfDown         = totalDown - cashDown;
    const monthlyMortgage = loanAmount > 0
        ? Math.round(loanAmount * r / (1 - Math.pow(1 + r, -TERM_MONTHS)))
        : 0;

    // MSR (Mortgage Servicing Ratio) — HDB rule ≤ 30% of gross income
    const msrRatio  = incomeNum > 0 ? Math.round((monthlyMortgage / incomeNum) * 1000) / 10 : null;
    // TDSR (Total Debt Servicing Ratio) — MAS rule ≤ 55%
    // Using mortgage-only as a baseline; full TDSR needs other debt obligations from user.
    const tdsrRatio = msrRatio;

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
        rateLabel:   isHDB ? '2.6% p.a.' : '~3.5% p.a.',
        termYears:   25
    };
}

module.exports = { calculateGrants, calculateFinancials, getEHG };
