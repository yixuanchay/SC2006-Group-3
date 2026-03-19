const express = require('express');
const { calculateGrants, calculateFinancials } = require('../services/grantCalculator');
const { getAllTownsPrices }                     = require('../services/dataGovService');
const { scoreTown, TOWN_COORDS }               = require('../services/locationScoring');
const { geocode }                              = require('../services/oneMapService');

const router = express.Router();

const BTO_FACTOR = 0.55; // BTO ≈ 55% of resale market price

const FLAT_TYPE_MAP = {
    '2-room':    '2 ROOM',
    '3-room':    '3 ROOM',
    '4-room':    '4 ROOM',
    '5-room':    '5 ROOM',
    'executive': 'EXECUTIVE'
};

const TOWN_REGIONS = {
    'ANG MO KIO': 'North', 'BISHAN': 'Central', 'TOA PAYOH': 'Central',
    'QUEENSTOWN': 'Central', 'BUKIT MERAH': 'Central', 'KALLANG/WHAMPOA': 'Central',
    'MARINE PARADE': 'East', 'BEDOK': 'East', 'TAMPINES': 'East',
    'PASIR RIS': 'East', 'GEYLANG': 'East', 'SERANGOON': 'Northeast',
    'HOUGANG': 'Northeast', 'SENGKANG': 'Northeast', 'PUNGGOL': 'Northeast',
    'JURONG EAST': 'West', 'JURONG WEST': 'West', 'BUKIT BATOK': 'West',
    'BUKIT PANJANG': 'West', 'CHOA CHU KANG': 'West', 'CLEMENTI': 'West',
    'WOODLANDS': 'North', 'SEMBAWANG': 'North', 'YISHUN': 'North'
};

/* POST /api/recommendations
   Returns top-10 towns ranked by match score, filtered by budget.
*/
router.post('/', async (req, res) => {
    try {
        const {
            income, loanType, budget, flatType, purchaseType = 'resale',
            preferences = [], workplaceLocation, nearParents, parentsTown,
            ...profileRest
        } = req.body;

        // Geocode workplace for commute scoring
        let workplaceLat = null, workplaceLng = null;
        if (workplaceLocation) {
            try {
                const geo = await geocode(workplaceLocation);
                if (geo) { workplaceLat = geo.lat; workplaceLng = geo.lng; }
            } catch { /* OneMap down — skip commute scoring */ }
        }

        // Grant calculation
        const profile = { income, flatType, purchaseType, nearParents, ...profileRest };
        const { grants, total: grantTotal } = calculateGrants(profile);

        // Fetch live resale prices for requested flat type
        const apiFlatType  = FLAT_TYPE_MAP[flatType] || '4 ROOM';
        const allPrices    = await getAllTownsPrices(apiFlatType);

        // Score + price every town in parallel
        const towns  = Object.keys(TOWN_COORDS);
        const settle = await Promise.allSettled(
            towns.map(async (town) => {
                const priceData = allPrices.find(p => p.town === town)
                    ?? { avg: 500000, trend: 0, min: 400000, max: 650000 };

                const basePrice     = purchaseType === 'bto'
                    ? Math.round(priceData.avg * BTO_FACTOR)
                    : priceData.avg;
                const effectivePrice = Math.max(basePrice - grantTotal, 0);

                // Filter out towns above budget
                const budgetNum = Number(budget);
                if (budgetNum > 0 && effectivePrice > budgetNum) return null;

                const score      = await scoreTown(town, {
                    workplaceLat, workplaceLng,
                    parentsTown: nearParents === 'yes' ? parentsTown : null,
                    preferences
                });
                const financials = calculateFinancials({ budget: basePrice, income, loanType, grantTotal });

                return {
                    town,
                    region:       TOWN_REGIONS[town] ?? 'Unknown',
                    score,
                    basePrice,
                    effectivePrice,
                    priceMin:     priceData.min,
                    priceMax:     priceData.max,
                    trend:        priceData.trend ?? 0,
                    coords:       TOWN_COORDS[town],
                    grants,
                    grantTotal,
                    financials
                };
            })
        );

        const results = settle
            .filter(r => r.status === 'fulfilled' && r.value)
            .map(r => r.value)
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);

        res.json({ results, grants, grantTotal });

    } catch (err) {
        console.error('recommendations:', err.message);
        res.status(500).json({ error: 'Failed to generate recommendations' });
    }
});

module.exports = router;
