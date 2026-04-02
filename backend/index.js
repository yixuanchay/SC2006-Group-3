const express = require('express');
const cors    = require('cors');
const dotenv  = require('dotenv');

dotenv.config();

const app = express();

/* ---- Auto-migrate new profile columns ---- */
(async function migrate() {
    const db = require('./models/db');
    const cols = [
        ['marital_status',      'VARCHAR(20)'],
        ['partner_citizenship', 'VARCHAR(10)'],
        ['employment_status',   'VARCHAR(50)'],
        ['income',              'DECIMAL(10,2)'],
        ['flat_type',           'VARCHAR(20)'],
        ['purchase_type',       'VARCHAR(20)'],
        ['budget',              'DECIMAL(10,2)'],
        ['loan_type',           'VARCHAR(20)'],
        ['near_parents',        'TINYINT(1)'],
        ['parents_town',        'VARCHAR(100)'],
        ['workplace_mrt',       'VARCHAR(100)'],
        ['preferences',         'JSON'],
    ];
    for (const [col, type] of cols) {
        try {
            await db.query(`ALTER TABLE users ADD COLUMN ${col} ${type}`);
        } catch (e) {
            if (e.code !== 'ER_DUP_FIELDNAME') console.warn('migrate:', e.message);
        }
    }
}());

app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true
}));
app.use(express.json());

/* ---- Routes ---- */
app.use('/api/auth',            require('./routes/auth'));
app.use('/api/grants',          require('./routes/grants'));
app.use('/api/affordability',   require('./routes/affordability'));
app.use('/api/recommendations', require('./routes/recommendations'));

/* ---- Health check ---- */
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

/* ---- 404 handler ---- */
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

/* ---- Error handler ---- */
app.use((err, _req, res, _next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`HomeMatch backend running on http://localhost:${PORT}`);
});
