// routes/community.js — Create & manage communities (groups via contacts)

const express      = require('express');
const { v4: uuidv4 } = require('uuid');
const authenticate = require('../middleware/auth');
const store        = require('../db/store');

const router = express.Router();

// ── POST /api/community  — create a community ───────────────────────────────
router.post('/', authenticate, (req, res) => {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Community name is required' });

    const id = uuidv4();
    const community = {
        id,
        name: name.trim(),
        description: description?.trim() || '',
        createdBy: req.userId,
        createdAt: new Date().toISOString(),
    };

    store.communities.set(id, community);

    // Creator is automatically a member
    const members = new Set([req.userId]);
    store.communityMembers.set(id, members);

    res.status(201).json({ message: 'Community created', community, memberCount: 1 });
});

// ── GET /api/community  — list communities I belong to ──────────────────────
router.get('/', authenticate, (req, res) => {
    const result = [];
    for (const [comId, members] of store.communityMembers) {
        if (!members.has(req.userId)) continue;
        const community = store.communities.get(comId);
        if (!community) continue;
        result.push({
            ...community,
            memberCount: members.size,
            isAdmin: community.createdBy === req.userId,
        });
    }
    res.json(result);
});

// ── GET /api/community/:id  — community detail + members ────────────────────
router.get('/:id', authenticate, (req, res) => {
    const community = store.communities.get(req.params.id);
    if (!community) return res.status(404).json({ error: 'Community not found' });

    const members = store.communityMembers.get(req.params.id) || new Set();
    if (!members.has(req.userId))
        return res.status(403).json({ error: 'You are not a member of this community' });

    const memberList = [];
    for (const uid of members) {
        const u = store.users.get(uid);
        if (!u) continue;
        memberList.push({
            id:              u.id,
            name:            u.name,
            latestFootprint: u.latestFootprint,
            isAdmin:         community.createdBy === uid,
        });
    }

    res.json({ community, members: memberList });
});

// ── POST /api/community/:id/invite  — invite a contact (must be a friend) ───
/**
 * Only existing friends can be invited, ensuring the
 * "community through contacts" model described in the spec.
 */
router.post('/:id/invite', authenticate, (req, res) => {
    const community = store.communities.get(req.params.id);
    if (!community) return res.status(404).json({ error: 'Community not found' });

    const members = store.communityMembers.get(req.params.id) || new Set();
    if (!members.has(req.userId))
        return res.status(403).json({ error: 'Only members can invite others' });

    const { userId: inviteeId } = req.body;
    if (!inviteeId) return res.status(400).json({ error: 'userId is required' });

    // Must be a friend
    const myFriends = store.friends.get(req.userId) || new Set();
    if (!myFriends.has(inviteeId))
        return res.status(403).json({ error: 'You can only invite friends to a community' });

    if (members.has(inviteeId))
        return res.status(409).json({ error: 'User is already a member' });

    members.add(inviteeId);
    store.communityMembers.set(req.params.id, members);

    const invitee = store.users.get(inviteeId);
    res.json({
        message: `${invitee?.name || 'User'} added to community`,
        memberCount: members.size,
    });
});

// ── POST /api/community/:id/invite-bulk  — invite multiple contacts at once ──
router.post('/:id/invite-bulk', authenticate, (req, res) => {
    const community = store.communities.get(req.params.id);
    if (!community) return res.status(404).json({ error: 'Community not found' });

    const members = store.communityMembers.get(req.params.id) || new Set();
    if (!members.has(req.userId))
        return res.status(403).json({ error: 'Only members can invite others' });

    const { userIds } = req.body;
    if (!Array.isArray(userIds) || !userIds.length)
        return res.status(400).json({ error: 'userIds array is required' });

    const myFriends = store.friends.get(req.userId) || new Set();
    const added = [];
    const skipped = [];

    for (const uid of userIds) {
        if (!myFriends.has(uid))   { skipped.push({ uid, reason: 'not a friend' });    continue; }
        if (members.has(uid))      { skipped.push({ uid, reason: 'already a member' }); continue; }
        if (!store.users.has(uid)) { skipped.push({ uid, reason: 'user not found' });   continue; }
        members.add(uid);
        added.push(uid);
    }

    store.communityMembers.set(req.params.id, members);

    res.json({
        message: `${added.length} member(s) added`,
        added,
        skipped,
        memberCount: members.size,
    });
});

// ── DELETE /api/community/:id/leave  — leave a community ────────────────────
router.delete('/:id/leave', authenticate, (req, res) => {
    const community = store.communities.get(req.params.id);
    if (!community) return res.status(404).json({ error: 'Community not found' });

    const members = store.communityMembers.get(req.params.id) || new Set();
    if (!members.has(req.userId))
        return res.status(400).json({ error: 'You are not a member' });

    members.delete(req.userId);

    // If admin left and there are still members, assign a new admin
    if (community.createdBy === req.userId && members.size > 0) {
        const newAdmin = members.values().next().value;
        community.createdBy = newAdmin;
        store.communities.set(req.params.id, community);
    }

    // Delete community if empty
    if (members.size === 0) {
        store.communities.delete(req.params.id);
        store.communityMembers.delete(req.params.id);
        return res.json({ message: 'Left and deleted empty community' });
    }

    store.communityMembers.set(req.params.id, members);
    res.json({ message: 'Left community', memberCount: members.size });
});

// ── DELETE /api/community/:id  — delete community (admin only) ──────────────
router.delete('/:id', authenticate, (req, res) => {
    const community = store.communities.get(req.params.id);
    if (!community) return res.status(404).json({ error: 'Community not found' });

    if (community.createdBy !== req.userId)
        return res.status(403).json({ error: 'Only the admin can delete this community' });

    store.communities.delete(req.params.id);
    store.communityMembers.delete(req.params.id);
    res.json({ message: 'Community deleted' });
});

module.exports = router;
