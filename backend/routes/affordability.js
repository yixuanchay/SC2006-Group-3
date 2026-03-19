const express  = require('express');
const { calculateGrants, calculateFinancials } = require('../services/grantCalculator');

const router = express.Router();

/* POST /api/affordability/calculate
   Body: full user profile (grants + financial fields combined)
   Returns: grant breakdown + full financial figures
*/
router.post('/calculate', (req, res) => {
    try {
        const { budget, income, loanType, ...profile } = req.body;

        const { grants, total: grantTotal } = calculateGrants(profile);
        const financials = calculateFinancials({ budget, income, loanType, grantTotal });

        res.json({ grants, grantTotal, ...financials });
    } catch (err) {
        console.error('affordability/calculate:', err.message);
        res.status(500).json({ error: 'Failed to calculate affordability' });
    }
});

module.exports = router;
