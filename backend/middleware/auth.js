const jwt = require('jsonwebtoken');

/**
 * Middleware: verify JWT from Authorization: Bearer <token>
 * Attaches req.user = { userId, email } on success.
 */
function authMiddleware(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const token = header.slice(7);
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.user = payload;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

module.exports = authMiddleware;
