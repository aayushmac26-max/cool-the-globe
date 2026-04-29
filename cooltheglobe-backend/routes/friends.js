// routes/friends.js — Send, accept, reject friend requests & list friends

const express      = require('express');
const { v4: uuidv4 } = require('uuid');
const authenticate = require('../middleware/auth');
const store        = require('../db/store');

const router = express.Router();

// ── POST /api/friends/request  — send a friend request ─────────────────────
router.post('/request', authenticate, (req, res) => {
    const { toUserId } = req.body;
    const fromUserId   = req.userId;

    if (!toUserId) return res.status(400).json({ error: 'toUserId is required' });
    if (toUserId === fromUserId) return res.status(400).json({ error: 'Cannot send request to yourself' });

    if (!store.users.has(toUserId))
        return res.status(404).json({ error: 'Target user not found' });

    // Check if already friends
    const myFriends = store.friends.get(fromUserId) || new Set();
    if (myFriends.has(toUserId))
        return res.status(409).json({ error: 'Already friends' });

    const key = `${fromUserId}:${toUserId}`;
    const reverseKey = `${toUserId}:${fromUserId}`;

    if (store.friendRequests.has(key))
        return res.status(409).json({ error: 'Friend request already sent' });

    // If the other person already sent us a request, auto-accept
    if (store.friendRequests.has(reverseKey)) {
        store.friendRequests.delete(reverseKey);
        _makeFriends(fromUserId, toUserId);
        return res.json({ message: 'Mutual request detected — you are now friends!' });
    }

    const request = {
        id:         uuidv4(),
        fromUserId,
        toUserId,
        status:     'pending',
        createdAt:  new Date().toISOString(),
    };
    store.friendRequests.set(key, request);

    res.status(201).json({ message: 'Friend request sent', request });
});

// ── GET /api/friends/requests/incoming  — pending requests for me ───────────
router.get('/requests/incoming', authenticate, (req, res) => {
    const incoming = [];
    for (const [key, req_] of store.friendRequests) {
        if (req_.toUserId === req.userId && req_.status === 'pending') {
            const sender = store.users.get(req_.fromUserId);
            incoming.push({
                requestId:  req_.id,
                key,
                from: sender ? { id: sender.id, name: sender.name, latestFootprint: sender.latestFootprint } : null,
                createdAt: req_.createdAt,
            });
        }
    }
    res.json(incoming);
});

// ── GET /api/friends/requests/outgoing  — requests I sent ───────────────────
router.get('/requests/outgoing', authenticate, (req, res) => {
    const outgoing = [];
    for (const [key, req_] of store.friendRequests) {
        if (req_.fromUserId === req.userId && req_.status === 'pending') {
            const target = store.users.get(req_.toUserId);
            outgoing.push({
                requestId: req_.id,
                key,
                to: target ? { id: target.id, name: target.name } : null,
                createdAt: req_.createdAt,
            });
        }
    }
    res.json(outgoing);
});

// ── POST /api/friends/accept  — accept a request ───────────────────────────
router.post('/accept', authenticate, (req, res) => {
    const { fromUserId } = req.body;
    if (!fromUserId) return res.status(400).json({ error: 'fromUserId is required' });

    const key = `${fromUserId}:${req.userId}`;
    const request = store.friendRequests.get(key);

    if (!request)
        return res.status(404).json({ error: 'No pending request from this user' });

    store.friendRequests.delete(key);
    _makeFriends(req.userId, fromUserId);

    res.json({ message: 'Friend request accepted 🎉' });
});

// ── POST /api/friends/reject  — reject a request ───────────────────────────
router.post('/reject', authenticate, (req, res) => {
    const { fromUserId } = req.body;
    if (!fromUserId) return res.status(400).json({ error: 'fromUserId is required' });

    const key = `${fromUserId}:${req.userId}`;
    if (!store.friendRequests.has(key))
        return res.status(404).json({ error: 'No pending request from this user' });

    store.friendRequests.delete(key);
    res.json({ message: 'Friend request rejected' });
});

// ── DELETE /api/friends/:friendId  — remove a friend ───────────────────────
router.delete('/:friendId', authenticate, (req, res) => {
    const { friendId } = req.params;
    const myFriends     = store.friends.get(req.userId) || new Set();
    const theirFriends  = store.friends.get(friendId)   || new Set();

    if (!myFriends.has(friendId))
        return res.status(404).json({ error: 'Not in your friend list' });

    myFriends.delete(friendId);
    theirFriends.delete(req.userId);
    store.friends.set(req.userId, myFriends);
    store.friends.set(friendId,   theirFriends);

    res.json({ message: 'Friend removed' });
});

// ── GET /api/friends  — list all friends with their latest footprint ─────────
router.get('/', authenticate, (req, res) => {
    const myFriends = store.friends.get(req.userId) || new Set();
    const list = [];

    for (const friendId of myFriends) {
        const user = store.users.get(friendId);
        if (!user) continue;
        list.push({
            id:             user.id,
            name:           user.name,
            latestFootprint: user.latestFootprint,
        });
    }

    // Sort by footprint (ascending = greener first)
    list.sort((a, b) => (a.latestFootprint ?? Infinity) - (b.latestFootprint ?? Infinity));

    res.json(list);
});

// ── Internal helper ─────────────────────────────────────────────────────────
function _makeFriends(a, b) {
    const aSet = store.friends.get(a) || new Set();
    const bSet = store.friends.get(b) || new Set();
    aSet.add(b);
    bSet.add(a);
    store.friends.set(a, aSet);
    store.friends.set(b, bSet);
}

module.exports = router;
