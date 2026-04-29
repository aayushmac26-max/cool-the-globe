// routes/users.js — User profile management

const express    = require('express');
const authenticate = require('../middleware/auth');
const store      = require('../db/store');

const router = express.Router();

// ── GET /api/users/me  — get own profile ────────────────────────────────────
router.get('/me', authenticate, (req, res) => {
    const user = store.users.get(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(safeUser(user));
});

// ── PUT /api/users/me  — update name / privacy ─────────────────────────────
router.put('/me', authenticate, (req, res) => {
    const user = store.users.get(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { name, isPublic } = req.body;
    if (name !== undefined) user.name = name.trim();
    if (isPublic !== undefined) user.isPublic = Boolean(isPublic);

    store.users.set(req.userId, user);
    res.json({ message: 'Profile updated', user: safeUser(user) });
});

// ── GET /api/users/search?q=  — search users by name or email ──────────────
// ⚠️  MUST be defined before /:id so Express doesn't treat "search" as an ID
router.get('/search', authenticate, (req, res) => {
    const q = (req.query.q || '').toLowerCase().trim();
    if (!q) return res.json([]);

    const results = [];
    for (const user of store.users.values()) {
        if (user.id === req.userId) continue;
        if (user.name.toLowerCase().includes(q) || user.email.toLowerCase().includes(q)) {
            results.push({
                id: user.id,
                name: user.name,
                email: user.email,
                latestFootprint: user.isPublic ? user.latestFootprint : null,
            });
        }
        if (results.length >= 20) break;
    }
    res.json(results);
});

// ── GET /api/users/:id  — public profile of any user ───────────────────────
router.get('/:id', authenticate, (req, res) => {
    const user = store.users.get(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Respect privacy setting for non-friends
    const myFriends = store.friends.get(req.userId) || new Set();
    const isFriend  = myFriends.has(req.params.id);
    const isSelf    = req.params.id === req.userId;

    if (!user.isPublic && !isFriend && !isSelf) {
        return res.status(403).json({ error: 'This profile is private' });
    }

    res.json({
        id: user.id,
        name: user.name,
        latestFootprint: user.latestFootprint,
        createdAt: user.createdAt,
        isPublic: user.isPublic,
    });
});

function safeUser(user) {
    const { passwordHash, ...safe } = user;
    return safe;
}

module.exports = router;
