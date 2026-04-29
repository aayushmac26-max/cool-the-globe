// routes/auth.js — Register & Login

const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const store   = require('../db/store');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'cooltheglobe_secret_key_change_in_prod';
const TOKEN_TTL  = '7d';

// ── POST /api/auth/register ─────────────────────────────────────────────────
router.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password)
            return res.status(400).json({ error: 'name, email, and password are required' });

        if (store.emailIndex.has(email.toLowerCase()))
            return res.status(409).json({ error: 'Email already registered' });

        const id           = uuidv4();
        const passwordHash = await bcrypt.hash(password, 10);

        const user = {
            id,
            name: name.trim(),
            email: email.toLowerCase().trim(),
            passwordHash,
            createdAt: new Date().toISOString(),
            // Latest calculated daily footprint (kg CO₂)
            latestFootprint: null,
            // Public profile visibility
            isPublic: true,
        };

        store.users.set(id, user);
        store.emailIndex.set(user.email, id);
        store.footprintLogs.set(id, []);
        store.friends.set(id, new Set());

        const token = jwt.sign({ userId: id }, JWT_SECRET, { expiresIn: TOKEN_TTL });

        res.status(201).json({
            message: 'Account created successfully',
            token,
            user: safeUser(user),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── POST /api/auth/login ────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password)
            return res.status(400).json({ error: 'email and password are required' });

        const userId = store.emailIndex.get(email.toLowerCase().trim());
        if (!userId) return res.status(401).json({ error: 'Invalid credentials' });

        const user = store.users.get(userId);
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: TOKEN_TTL });

        res.json({
            message: 'Login successful',
            token,
            user: safeUser(user),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Helpers ─────────────────────────────────────────────────────────────────
function safeUser(user) {
    const { passwordHash, ...safe } = user;
    return safe;
}

module.exports = router;
