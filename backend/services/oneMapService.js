/* ============================================================
   services/oneMapService.js
   OneMap API wrapper — geocoding and route times.
   Docs: https://www.onemap.gov.sg/apidocs/
   ============================================================ */

const https = require('https');

// Seed from env so the first request works without credentials
let _token       = process.env.ONEMAP_TOKEN || null;
let _tokenExpiry = _token ? Date.now() + 24 * 60 * 60 * 1000 : 0; // assume ~1 day if pre-set

function fetchJSON(url, options = {}) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, options, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (err) { reject(new Error(`JSON parse: ${err.message}`)); }
            });
        });
        req.on('error', reject);
    });
}

function postJSON(url, body) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify(body);
        const parsed  = new URL(url);
        const options = {
            hostname: parsed.hostname,
            path:     parsed.pathname + parsed.search,
            method:   'POST',
            headers:  {
                'Content-Type':   'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (err) { reject(new Error(`JSON parse: ${err.message}`)); }
            });
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

/**
 * Retrieve (or refresh) the OneMap access token.
 * Credentials come from ONEMAP_EMAIL and ONEMAP_PASSWORD env vars.
 */
async function getToken() {
    if (_token && Date.now() < _tokenExpiry) return _token;

    if (!process.env.ONEMAP_EMAIL || !process.env.ONEMAP_PASSWORD) {
        throw new Error('ONEMAP_EMAIL and ONEMAP_PASSWORD must be set in .env');
    }

    const data = await postJSON('https://www.onemap.gov.sg/api/auth/post/getToken', {
        email:    process.env.ONEMAP_EMAIL,
        password: process.env.ONEMAP_PASSWORD
    });

    _token       = data.access_token;
    // expiry_timestamp is seconds-since-epoch; give 60s buffer
    _tokenExpiry = data.expiry_timestamp
        ? data.expiry_timestamp * 1000 - 60_000
        : Date.now() + 23 * 60 * 60 * 1000; // fallback: 23 h

    return _token;
}

/**
 * Geocode a search string → { lat, lng, address, postalCode } or null.
 * @param {string} searchVal  e.g. "Tampines MRT" or a postal code
 */
async function geocode(searchVal) {
    const encoded = encodeURIComponent(searchVal);
    const url     = `https://www.onemap.gov.sg/api/common/elastic/search`
        + `?searchVal=${encoded}&returnGeom=Y&getAddrDetails=Y&pageNum=1`;

    const data = await fetchJSON(url);
    if (!data.results?.length) return null;

    const r = data.results[0];
    return {
        lat:        parseFloat(r.LATITUDE),
        lng:        parseFloat(r.LONGITUDE),
        address:    r.ADDRESS,
        postalCode: r.POSTAL
    };
}

/**
 * Get travel time between two coordinates.
 * @param {number} startLat
 * @param {number} startLng
 * @param {number} endLat
 * @param {number} endLng
 * @param {'transit'|'drive'|'walk'|'cycle'} routeType
 * @returns {Promise<{duration_mins: number, distance_km: number} | null>}
 */
async function getRoute(startLat, startLng, endLat, endLng, routeType = 'transit') {
    const token = await getToken();
    const url   = `https://www.onemap.gov.sg/api/public/routingsvc/route`
        + `?start=${startLat},${startLng}&end=${endLat},${endLng}`
        + `&routeType=${routeType}&token=${encodeURIComponent(token)}`;

    const data = await fetchJSON(url);

    if (routeType === 'transit') {
        const itins = data?.plan?.itineraries;
        if (!itins?.length) return null;
        const best = itins[0];
        return {
            duration_mins: Math.round(best.duration / 60),
            distance_km:   Math.round((best.walkDistance ?? 0) / 100) / 10
        };
    } else {
        const summary = data?.route_summary;
        if (!summary) return null;
        return {
            duration_mins: Math.round(summary.total_time / 60),
            distance_km:   Math.round(summary.total_distance / 100) / 10
        };
    }
}

module.exports = { geocode, getRoute, getToken };
