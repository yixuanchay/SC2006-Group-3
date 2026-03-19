/* ============================================================
   services/dataGovService.js
   Fetches resale flat price data from data.gov.sg.
   Dataset: d_8b84c4ee58e3cfc0ece0d773c8ca6abc (Jan 2017–now)
   ============================================================ */

const https = require('https');

const RESALE_RESOURCE_ID = 'd_8b84c4ee58e3cfc0ece0d773c8ca6abc';
const BASE_URL = 'https://data.gov.sg/api/action/datastore_search';

function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (err) { reject(new Error(`JSON parse error: ${err.message}`)); }
            });
        }).on('error', reject);
    });
}

/**
 * Fetch raw resale records for a town (and optional flat type).
 * @param {string} town      e.g. "TAMPINES"
 * @param {string} flatType  e.g. "4 ROOM" (optional)
 * @param {number} limit
 * @returns {Promise<Array>}
 */
async function getResalePrices(town, flatType = null, limit = 500) {
    const filters = { town: town.toUpperCase() };
    if (flatType) filters.flat_type = flatType.toUpperCase();

    const encoded = encodeURIComponent(JSON.stringify(filters));
    const url = `${BASE_URL}?resource_id=${RESALE_RESOURCE_ID}&filters=${encoded}&limit=${limit}&sort=month%20desc`;

    const data = await fetchJSON(url);
    return data?.result?.records ?? [];
}

/**
 * Summarise recent resale prices for a town + flat type.
 * @param {string} town
 * @param {string} flatType
 * @param {number} months   look-back window
 * @returns {Promise<{avg, min, max, count, trend} | null>}
 */
async function getResalePriceSummary(town, flatType, months = 12) {
    const records = await getResalePrices(town, flatType, 500);
    if (!records.length) return null;

    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);

    const recent = records.filter(r => new Date(r.month + '-01') >= cutoff);
    if (!recent.length) return null;

    const prices = recent.map(r => Number(r.resale_price));
    const avg    = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
    const min    = Math.min(...prices);
    const max    = Math.max(...prices);

    // Trend: compare older half vs. newer half of the window
    const mid      = Math.floor(prices.length / 2) || 1;
    const olderAvg = prices.slice(mid).reduce((a, b) => a + b, 0) / (prices.length - mid);
    const newerAvg = prices.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
    const trend    = olderAvg > 0
        ? Math.round(((newerAvg - olderAvg) / olderAvg) * 1000) / 10
        : 0;

    return { avg, min, max, count: recent.length, trend };
}

// All HDB towns we score
const ALL_TOWNS = [
    'ANG MO KIO', 'BEDOK', 'BISHAN', 'BUKIT BATOK', 'BUKIT MERAH',
    'BUKIT PANJANG', 'CHOA CHU KANG', 'CLEMENTI', 'GEYLANG', 'HOUGANG',
    'JURONG EAST', 'JURONG WEST', 'KALLANG/WHAMPOA', 'MARINE PARADE',
    'PASIR RIS', 'PUNGGOL', 'QUEENSTOWN', 'SEMBAWANG', 'SENGKANG',
    'SERANGOON', 'TAMPINES', 'TOA PAYOH', 'WOODLANDS', 'YISHUN'
];

/**
 * Fetch average price for every town for a given flat type.
 * Returns array sorted by ascending average price.
 * @param {string} flatType e.g. "4 ROOM"
 * @returns {Promise<Array>}
 */
async function getAllTownsPrices(flatType = '4 ROOM') {
    const results = await Promise.allSettled(
        ALL_TOWNS.map(town =>
            getResalePriceSummary(town, flatType, 12)
                .then(s => s ? { town, ...s } : null)
        )
    );

    return results
        .filter(r => r.status === 'fulfilled' && r.value)
        .map(r => r.value)
        .sort((a, b) => a.avg - b.avg);
}

module.exports = { getResalePrices, getResalePriceSummary, getAllTownsPrices };
