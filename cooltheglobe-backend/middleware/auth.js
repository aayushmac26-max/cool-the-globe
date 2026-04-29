// middleware/auth.js — JWT verification middleware

const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'cooltheglobe_secret_key_change_in_prod';

module.exports = function authenticate(req, res, next) {
    const header = req.headers['authorization'];
    if (!header) return res.status(401).json({ error: 'No token provided' });

    const token = header.startsWith('Bearer ') ? header.slice(7) : header;

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};
