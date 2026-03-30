const express    = require('express');
const bcrypt     = require('bcrypt');
const jwt        = require('jsonwebtoken');
const crypto     = require('crypto');
const nodemailer = require('nodemailer');
const db         = require('../models/db');
const auth       = require('../middleware/auth');

const router = express.Router();
const SALT_ROUNDS = 12;

function signToken(user) {
    return jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );
}

function safeUser(row) {
    return { id: row.id, email: row.email, name: row.name, citizenship: row.citizenship };
}

/* ------------------------------------------------------------------ */
/* POST /api/auth/register                                             */
/* ------------------------------------------------------------------ */
router.post('/register', async (req, res) => {
    const { email, password, name, citizenship } = req.body;

    if (!email || !password)
        return res.status(400).json({ error: 'Email and password are required' });
    if (password.length < 8)
        return res.status(400).json({ error: 'Password must be at least 8 characters' });

    try {
        const exists = await db.query(
            'SELECT id FROM users WHERE email = ?',
            [email.toLowerCase()]
        );
        if (exists.rows.length)
            return res.status(409).json({ error: 'An account with that email already exists' });

        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
        const insert = await db.query(
            'INSERT INTO users (email, password_hash, name, citizenship) VALUES (?, ?, ?, ?)',
            [email.toLowerCase(), passwordHash, name || null, citizenship || null]
        );

        const newId = insert.rows[0].insertId;
        const user  = { id: newId, email: email.toLowerCase(), name: name || null, citizenship: citizenship || null };
        const token = signToken(user);
        res.status(201).json({ token, user: safeUser(user) });

    } catch (err) {
        console.error('register:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

/* ------------------------------------------------------------------ */
/* POST /api/auth/login                                                */
/* ------------------------------------------------------------------ */
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password)
        return res.status(400).json({ error: 'Email and password are required' });

    try {
        const result = await db.query(
            'SELECT * FROM users WHERE email = ?',
            [email.toLowerCase()]
        );
        const user = result.rows[0];
        if (!user) return res.status(401).json({ error: 'Invalid email or password' });

        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) return res.status(401).json({ error: 'Invalid email or password' });

        const token = signToken(user);
        res.json({ token, user: safeUser(user) });

    } catch (err) {
        console.error('login:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

/* ------------------------------------------------------------------ */
/* POST /api/auth/forgot-password                                      */
/* ------------------------------------------------------------------ */
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const MSG = { message: 'If that address is registered, a reset link has been sent.' };

    try {
        const result = await db.query(
            'SELECT id, email FROM users WHERE email = ?',
            [email.toLowerCase()]
        );
        if (!result.rows.length) return res.json(MSG);

        const user    = result.rows[0];
        const token   = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        await db.query(
            'UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?',
            [token, expires, user.id]
        );

        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT) || 587,
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        });

        const resetUrl = `${process.env.FRONTEND_URL}/reset-password.html?token=${token}`;
        await transporter.sendMail({
            from:    process.env.SMTP_FROM || 'noreply@homematch.sg',
            to:      user.email,
            subject: 'HomeMatch — Password Reset',
            html:    `<p>Click <a href="${resetUrl}">here</a> to reset your HomeMatch password.
                      This link expires in 1 hour.</p>`
        });

        res.json(MSG);

    } catch (err) {
        console.error('forgot-password:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

/* ------------------------------------------------------------------ */
/* POST /api/auth/reset-password                                       */
/* ------------------------------------------------------------------ */
router.post('/reset-password', async (req, res) => {
    const { token, password } = req.body;
    if (!token || !password)
        return res.status(400).json({ error: 'Token and new password are required' });
    if (password.length < 8)
        return res.status(400).json({ error: 'Password must be at least 8 characters' });

    try {
        const result = await db.query(
            'SELECT id FROM users WHERE reset_token = ? AND reset_expires > NOW()',
            [token]
        );
        if (!result.rows.length)
            return res.status(400).json({ error: 'Invalid or expired reset token' });

        const hash = await bcrypt.hash(password, SALT_ROUNDS);
        await db.query(
            'UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?',
            [hash, result.rows[0].id]
        );

        res.json({ message: 'Password reset successfully. You can now log in.' });

    } catch (err) {
        console.error('reset-password:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

/* ------------------------------------------------------------------ */
/* GET /api/auth/me  (protected)                                       */
/* ------------------------------------------------------------------ */
router.get('/me', auth, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT id, email, name, citizenship, is_first_timer FROM users WHERE id = ?',
            [req.user.userId]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

/* ------------------------------------------------------------------ */
/* POST /api/auth/saved-searches  (protected)                          */
/* ------------------------------------------------------------------ */
router.post('/saved-searches', auth, async (req, res) => {
    const { formData, results, name } = req.body;
    if (!formData) return res.status(400).json({ error: 'formData is required' });

    try {
        const insert = await db.query(
            'INSERT INTO saved_searches (user_id, name, form_data, results) VALUES (?, ?, ?, ?)',
            [req.user.userId, name || null, JSON.stringify(formData), results ? JSON.stringify(results) : null]
        );
        res.status(201).json({ id: insert.rows[0].insertId });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

/* ------------------------------------------------------------------ */
/* GET /api/auth/saved-searches  (protected)                           */
/* ------------------------------------------------------------------ */
router.get('/saved-searches', auth, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT id, name, form_data, results, created_at FROM saved_searches WHERE user_id = ? ORDER BY created_at DESC',
            [req.user.userId]
        );
        // Parse JSON columns
        const rows = result.rows.map(r => ({
            ...r,
            form_data: typeof r.form_data === 'string' ? JSON.parse(r.form_data) : r.form_data,
            results:   r.results && typeof r.results === 'string' ? JSON.parse(r.results) : r.results,
        }));
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

/* ------------------------------------------------------------------ */
/* DELETE /api/auth/saved-searches/:id  (protected)                    */
/* ------------------------------------------------------------------ */
router.delete('/saved-searches/:id', auth, async (req, res) => {
    try {
        await db.query(
            'DELETE FROM saved_searches WHERE id = ? AND user_id = ?',
            [req.params.id, req.user.userId]
        );
        res.json({ message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

/* ------------------------------------------------------------------ */
/* GET /api/auth/profile  (protected) — full profile                   */
/* ------------------------------------------------------------------ */
router.get('/profile', auth, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT id, email, name, citizenship, marital_status, partner_citizenship,
                    employment_status, income, flat_type, purchase_type, budget,
                    loan_type, near_parents, parents_town, workplace_mrt, preferences
             FROM users WHERE id = ?`,
            [req.user.userId]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
        const u = result.rows[0];
        if (u.preferences && typeof u.preferences === 'string') {
            try { u.preferences = JSON.parse(u.preferences); } catch (_) {}
        }
        res.json(u);
    } catch (err) {
        console.error('get profile:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

/* ------------------------------------------------------------------ */
/* PATCH /api/auth/profile  (protected) — update profile fields        */
/* ------------------------------------------------------------------ */
router.patch('/profile', auth, async (req, res) => {
    const allowed = [
        'name', 'email', 'citizenship', 'marital_status', 'partner_citizenship',
        'employment_status', 'income', 'flat_type', 'purchase_type', 'budget',
        'loan_type', 'near_parents', 'parents_town', 'workplace_mrt', 'preferences'
    ];
    const updates = {};
    for (const key of allowed) {
        if (key in req.body) updates[key] = req.body[key];
    }
    if (Object.keys(updates).length === 0)
        return res.status(400).json({ error: 'No valid fields to update' });

    if ('preferences' in updates && typeof updates.preferences !== 'string') {
        updates.preferences = JSON.stringify(updates.preferences);
    }

    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values     = [...Object.values(updates), req.user.userId];

    try {
        await db.query(`UPDATE users SET ${setClauses} WHERE id = ?`, values);
        const result = await db.query(
            'SELECT id, email, name, citizenship FROM users WHERE id = ?',
            [req.user.userId]
        );
        const user = result.rows[0];
        const response = { message: 'Profile updated' };
        if ('email' in updates || 'name' in updates) {
            response.token = signToken(user);
            response.user  = safeUser(user);
        }
        res.json(response);
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY')
            return res.status(409).json({ error: 'That email is already in use' });
        console.error('patch profile:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

/* ------------------------------------------------------------------ */
/* PATCH /api/auth/password  (protected) — change password             */
/* ------------------------------------------------------------------ */
router.patch('/password', auth, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
        return res.status(400).json({ error: 'Both current and new password are required' });
    if (newPassword.length < 8)
        return res.status(400).json({ error: 'New password must be at least 8 characters' });

    try {
        const result = await db.query(
            'SELECT password_hash FROM users WHERE id = ?',
            [req.user.userId]
        );
        const match = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
        if (!match) return res.status(401).json({ error: 'Current password is incorrect' });

        const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
        await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.userId]);
        res.json({ message: 'Password changed successfully' });
    } catch (err) {
        console.error('patch password:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
