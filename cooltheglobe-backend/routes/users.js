// routes/users.js — User profile management

const express    = require('express');
const bcrypt     = require('bcryptjs');
const authenticate = require('../middleware/auth');
const store      = require('../db/store');

const router = express.Router();

// ── GET /api/users/me  — get own profile ────────────────────────────────────
router.get('/me', authenticate, (req, res) => {
    const user = store.users.get(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(safeUser(user));
});

// ── GET /api/users/admin/all  — get all users ────────────────────────────────
router.get('/admin/all', authenticate, (req, res) => {
    const me = store.users.get(req.userId);
    if (!me || me.email !== 'admin@gmail.com') {
        return res.status(403).json({ error: 'Admin only' });
    }
    
    const results = [];
    for (const user of store.users.values()) {
        const logs = store.footprintLogs.get(user.id) || [];
        results.push({
            id: user.id,
            name: user.name,
            email: user.email,
            latestFootprint: user.latestFootprint,
            createdAt: user.createdAt,
            isPublic: user.isPublic,
            feedbacks: user.feedbacks || [],
            logs: logs
        });
    }
    res.json(results);
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

// ── POST /api/users/feedback  — add feedback ──────────────────────────────────
router.post('/feedback', authenticate, (req, res) => {
    const user = store.users.get(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { rating, suggestion } = req.body;
    if (!rating) return res.status(400).json({ error: 'Rating is required' });

    if (!user.feedbacks) user.feedbacks = [];
    user.feedbacks.push({
        rating,
        suggestion: suggestion || '',
        submittedAt: new Date().toISOString()
    });

    store.users.set(req.userId, user);
    res.json({ message: 'Feedback submitted' });
});

// ── PUT /api/users/me/password  — change password ─────────────────────────────
router.put('/me/password', authenticate, async (req, res) => {
    try {
        const user = store.users.get(req.userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both current and new passwords are required' });

        const valid = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!valid) return res.status(403).json({ error: 'Incorrect current password' });

        user.passwordHash = await bcrypt.hash(newPassword, 10);
        store.users.set(req.userId, user);

        res.json({ message: 'Password updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
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
