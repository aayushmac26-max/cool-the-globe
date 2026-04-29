// routes/leaderboard.js — Ranked leaderboards

const express      = require('express');
const authenticate = require('../middleware/auth');
const store        = require('../db/store');

const router = express.Router();

// ── GET /api/leaderboard/friends  — leaderboard of me + my friends ──────────
/**
 * Returns a ranked list (lowest CO₂ = best rank) of the user
 * and all their accepted friends, including latest daily footprint.
 * Also pulls the score from each contact's actual account, not
 * a manually entered number, so it's always live.
 */
router.get('/friends', authenticate, (req, res) => {
    const me      = store.users.get(req.userId);
    const friends = store.friends.get(req.userId) || new Set();

    const people = [];

    // Add myself
    if (me) {
        people.push({
            id:             me.id,
            name:           me.name,
            latestFootprint: me.latestFootprint,
            isMe:           true,
            logs:           _recentLogs(me.id),
        });
    }

    // Add each friend (score pulled from their live account)
    for (const friendId of friends) {
        const user = store.users.get(friendId);
        if (!user) continue;
        people.push({
            id:             user.id,
            name:           user.name,
            latestFootprint: user.latestFootprint,
            isMe:           false,
            logs:           _recentLogs(friendId),
        });
    }

    const ranked = _rankAndScore(people);
    res.json(ranked);
});

// ── GET /api/leaderboard/global  — top-50 public users globally ─────────────
router.get('/global', authenticate, (req, res) => {
    const people = [];

    for (const user of store.users.values()) {
        if (!user.isPublic) continue;
        if (user.latestFootprint === null) continue;
        people.push({
            id:             user.id,
            name:           user.name,
            latestFootprint: user.latestFootprint,
            isMe:           user.id === req.userId,
        });
    }

    const ranked = _rankAndScore(people).slice(0, 50);
    res.json(ranked);
});

// ── GET /api/leaderboard/community/:communityId ──────────────────────────────
router.get('/community/:communityId', authenticate, (req, res) => {
    const { communityId } = req.params;

    const members = store.communityMembers.get(communityId);
    if (!members) return res.status(404).json({ error: 'Community not found' });

    if (!members.has(req.userId))
        return res.status(403).json({ error: 'You are not a member of this community' });

    const people = [];
    for (const memberId of members) {
        const user = store.users.get(memberId);
        if (!user || user.latestFootprint === null) continue;
        people.push({
            id:             user.id,
            name:           user.name,
            latestFootprint: user.latestFootprint,
            isMe:           user.id === req.userId,
        });
    }

    const ranked = _rankAndScore(people);
    res.json(ranked);
});

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Rank array of people by lowest footprint; compute an eco-score 0–100 */
function _rankAndScore(people) {
    // Filter to people with a recorded footprint
    const withScore = people.filter(p => p.latestFootprint !== null);
    const noScore   = people.filter(p => p.latestFootprint === null);

    // Sort ascending (greener = lower CO₂ = rank #1)
    withScore.sort((a, b) => a.latestFootprint - b.latestFootprint);

    const max = withScore.length
        ? withScore[withScore.length - 1].latestFootprint
        : 1;
    const min = withScore.length ? withScore[0].latestFootprint : 0;
    const range = max - min || 1;

    return [
        ...withScore.map((p, i) => ({
            rank:           i + 1,
            id:             p.id,
            name:           p.name,
            latestFootprint: p.latestFootprint,
            ecoScore:       Math.round(100 - ((p.latestFootprint - min) / range) * 100),
            isMe:           p.isMe,
            recentLogs:     p.logs || [],
        })),
        ...noScore.map(p => ({
            rank:           null,
            id:             p.id,
            name:           p.name,
            latestFootprint: null,
            ecoScore:       null,
            isMe:           p.isMe,
            recentLogs:     [],
        })),
    ];
}

/** Return the last 7 daily log summaries for a user */
function _recentLogs(userId) {
    const logs = store.footprintLogs.get(userId) || [];
    return logs
        .slice(-7)
        .reverse()
        .map(l => ({ date: l.recordedAt, totalKg: l.totalKg }));
}

module.exports = router;
