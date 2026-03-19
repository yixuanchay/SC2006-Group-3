const express  = require('express');
const { calculateGrants } = require('../services/grantCalculator');

const router = express.Router();

/* POST /api/grants/calculate
   Body: user profile fields (see grantCalculator.js for full schema)
   Returns: { grants: [...], total: number }
*/
router.post('/calculate', (req, res) => {
    try {
        const result = calculateGrants(req.body);
        res.json(result);
    } catch (err) {
        console.error('grants/calculate:', err.message);
        res.status(500).json({ error: 'Failed to calculate grants' });
    }
});

module.exports = router;
