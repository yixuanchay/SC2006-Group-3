/* ============================================================
   services/locationScoring.js
   Scores HDB towns against a user's ranked preferences.
   Uses OneMap routing for commute time when possible;
   falls back to proxy heuristics for other criteria.
   ============================================================ */

const { getRoute } = require('./oneMapService');

/* ---------- Town centroids (WGS-84, approximate) ---------- */
const TOWN_COORDS = {
    'ANG MO KIO':      [1.3691, 103.8454],
    'BEDOK':           [1.3236, 103.9273],
    'BISHAN':          [1.3526, 103.8352],
    'BUKIT BATOK':     [1.3590, 103.7637],
    'BUKIT MERAH':     [1.2819, 103.8239],
    'BUKIT PANJANG':   [1.3774, 103.7719],
    'CHOA CHU KANG':   [1.3840, 103.7470],
    'CLEMENTI':        [1.3152, 103.7649],
    'GEYLANG':         [1.3201, 103.8918],
    'HOUGANG':         [1.3612, 103.8863],
    'JURONG EAST':     [1.3329, 103.7436],
    'JURONG WEST':     [1.3404, 103.7090],
    'KALLANG/WHAMPOA': [1.3100, 103.8651],
    'MARINE PARADE':   [1.3022, 103.9071],
    'PASIR RIS':       [1.3721, 103.9494],
    'PUNGGOL':         [1.4043, 103.9021],
    'QUEENSTOWN':      [1.2942, 103.7861],
    'SEMBAWANG':       [1.4491, 103.8185],
    'SENGKANG':        [1.3868, 103.8914],
    'SERANGOON':       [1.3554, 103.8679],
    'TAMPINES':        [1.3496, 103.9568],
    'TOA PAYOH':       [1.3343, 103.8563],
    'WOODLANDS':       [1.4382, 103.7890],
    'YISHUN':          [1.4304, 103.8354]
};

/* ---------- Proxy heuristic scores per criterion ----------
   These approximate real data until live MOE/NParks APIs
   are integrated. Values are 0–100.                        */
const HEURISTICS = {
    mrt: {
        'BISHAN': 90, 'TOA PAYOH': 88, 'ANG MO KIO': 87, 'QUEENSTOWN': 86,
        'BEDOK': 84, 'TAMPINES': 83, 'JURONG EAST': 85, 'SERANGOON': 82,
        'KALLANG/WHAMPOA': 81, 'BUKIT MERAH': 80, 'CLEMENTI': 79,
        'GEYLANG': 78, 'HOUGANG': 72, 'SENGKANG': 75, 'PUNGGOL': 70,
        'MARINE PARADE': 71, 'BUKIT BATOK': 68, 'PASIR RIS': 66,
        'JURONG WEST': 65, 'BUKIT PANJANG': 63, 'CHOA CHU KANG': 67,
        'WOODLANDS': 64, 'SEMBAWANG': 60, 'YISHUN': 69
    },
    schools: {
        'BISHAN': 90, 'ANG MO KIO': 88, 'TAMPINES': 86, 'BEDOK': 85,
        'QUEENSTOWN': 87, 'TOA PAYOH': 84, 'SERANGOON': 82, 'CLEMENTI': 83,
        'KALLANG/WHAMPOA': 80, 'BUKIT MERAH': 79, 'JURONG EAST': 78,
        'HOUGANG': 76, 'SENGKANG': 75, 'PUNGGOL': 72, 'MARINE PARADE': 78,
        'BUKIT BATOK': 70, 'GEYLANG': 71, 'PASIR RIS': 74, 'JURONG WEST': 69,
        'BUKIT PANJANG': 68, 'CHOA CHU KANG': 72, 'WOODLANDS': 70,
        'SEMBAWANG': 65, 'YISHUN': 71
    },
    parks: {
        'PUNGGOL': 92, 'SENGKANG': 88, 'PASIR RIS': 87, 'BEDOK': 85,
        'JURONG WEST': 84, 'BUKIT PANJANG': 83, 'CLEMENTI': 80,
        'TAMPINES': 79, 'HOUGANG': 78, 'BUKIT BATOK': 76, 'QUEENSTOWN': 75,
        'ANG MO KIO': 74, 'BISHAN': 73, 'WOODLANDS': 82, 'SEMBAWANG': 80,
        'CHOA CHU KANG': 77, 'BUKIT MERAH': 70, 'TOA PAYOH': 68,
        'SERANGOON': 72, 'GEYLANG': 60, 'KALLANG/WHAMPOA': 65,
        'JURONG EAST': 71, 'MARINE PARADE': 74, 'YISHUN': 79
    },
    malls: {
        'JURONG EAST': 92, 'TAMPINES': 90, 'BEDOK': 88, 'ANG MO KIO': 87,
        'QUEENSTOWN': 84, 'TOA PAYOH': 83, 'BISHAN': 81, 'SERANGOON': 80,
        'KALLANG/WHAMPOA': 79, 'BUKIT MERAH': 78, 'CLEMENTI': 82,
        'HOUGANG': 76, 'SENGKANG': 77, 'PUNGGOL': 73, 'MARINE PARADE': 78,
        'BUKIT BATOK': 70, 'GEYLANG': 72, 'PASIR RIS': 74, 'JURONG WEST': 75,
        'BUKIT PANJANG': 71, 'CHOA CHU KANG': 76, 'WOODLANDS': 75,
        'SEMBAWANG': 65, 'YISHUN': 78
    },
    supermarkets: {
        default: 72 // fairly uniform across all towns
    },
    community: {
        default: 70 // community clubs exist in every town
    }
};

function heuristicScore(criterion, town) {
    const table = HEURISTICS[criterion];
    if (!table) return 65;
    return table[town] ?? table.default ?? 65;
}

function haversineKm(lat1, lng1, lat2, lng2) {
    const R    = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a    = Math.sin(dLat / 2) ** 2
        + Math.cos(lat1 * Math.PI / 180)
        * Math.cos(lat2 * Math.PI / 180)
        * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Score a single town against the user's preference ranking.
 *
 * @param {string} town                  e.g. 'TAMPINES'
 * @param {Object} options
 *   workplaceLat  {number|null}
 *   workplaceLng  {number|null}
 *   parentsTown   {string|null}
 *   preferences   {string[]}  ordered preference keys, index 0 = highest weight
 *     Keys: 'mrt' | 'commute' | 'schools' | 'parks' | 'malls' | 'supermarkets' | 'community' | 'parents'
 * @returns {Promise<number>}  score 0–100
 */
async function scoreTown(town, { workplaceLat, workplaceLng, parentsTown, preferences = [] }) {
    const coords = TOWN_COORDS[town.toUpperCase()];
    if (!coords) return 50;
    const [lat, lng] = coords;

    // Build weight map: rank 0 → weight 8, rank 7 → weight 1
    const weights = {};
    preferences.forEach((pref, i) => { weights[pref] = Math.max(8 - i, 1); });

    // Compute individual criterion scores
    const scores = {
        mrt:          heuristicScore('mrt', town),
        schools:      heuristicScore('schools', town),
        parks:        heuristicScore('parks', town),
        malls:        heuristicScore('malls', town),
        supermarkets: heuristicScore('supermarkets', town),
        community:    heuristicScore('community', town),
        commute:      70, // default if no workplace
        parents:      50  // default if no parent info
    };

    // Commute score via OneMap (live, 20→100 … 80→0 mins)
    if (workplaceLat != null && workplaceLng != null) {
        try {
            const route = await getRoute(lat, lng, workplaceLat, workplaceLng, 'transit');
            if (route) {
                scores.commute = Math.max(0, Math.min(100,
                    Math.round(100 - (route.duration_mins - 15) * (100 / 60))
                ));
            }
        } catch { /* leave default */ }
    }

    // Parent proximity score
    if (parentsTown) {
        const parentCoords = TOWN_COORDS[parentsTown.toUpperCase()];
        if (parentCoords) {
            const km = haversineKm(lat, lng, parentCoords[0], parentCoords[1]);
            scores.parents = km < 1 ? 100
                : km < 4  ? 80
                : km < 8  ? 55
                : 30;
        }
    }

    // Weighted average
    const prefKeys = ['mrt', 'commute', 'schools', 'parks', 'malls', 'supermarkets', 'community', 'parents'];
    let weightedSum = 0, totalWeight = 0;
    for (const key of prefKeys) {
        const w = weights[key] ?? 3;
        weightedSum  += w * scores[key];
        totalWeight  += w;
    }

    return Math.round(weightedSum / totalWeight);
}

module.exports = { scoreTown, TOWN_COORDS };
