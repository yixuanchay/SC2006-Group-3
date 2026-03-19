const express = require('express');
const cors    = require('cors');
const dotenv  = require('dotenv');

dotenv.config();

const app = express();

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
