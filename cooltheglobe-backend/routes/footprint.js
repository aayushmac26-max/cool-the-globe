// routes/footprint.js — Save & retrieve carbon footprint scores

const express      = require('express');
const { v4: uuidv4 } = require('uuid');
const authenticate = require('../middleware/auth');
const store        = require('../db/store');

const router = express.Router();

// ── POST /api/footprint  — save a new calculation ──────────────────────────
/**
 * Body:
 *  transport  { carKm, publicKm, flightHrs }
 *  energy     { acHrs, electricityBill }
 *  food       { diet: 'vegan'|'vegetarian'|'omnivore'|'meat-heavy' }
 *  waste      { recycle, compost }
 *  water      { showerMins }
 */
router.post('/', authenticate, (req, res) => {
    try {
        const { transport = {}, energy = {}, food = {}, waste = {}, water = {} } = req.body;

        // ── Calculation (mirrors frontend logic) ──────────────────────────
        const carKm      = parseFloat(transport.carKm)        || 0;
        const publicKm   = parseFloat(transport.publicKm)     || 0;
        const flightHrs  = parseFloat(transport.flightHrs)    || 0;
        const acHrs      = parseFloat(energy.acHrs)           || 0;
        const elecBill   = parseFloat(energy.electricityBill) || 0;
        const showerMins = parseFloat(water.showerMins)       || 0;
        const diet       = food.diet || 'omnivore';
        const recycle    = Boolean(waste.recycle);
        const compost    = Boolean(waste.compost);

        const transportTotal = (carKm * 0.192) + (publicKm * 0.04) + ((flightHrs * 250) / 365);
        const energyTotal    = (acHrs * 1.5 * 0.85) + ((elecBill / 0.15) / 30 * 0.85);

        const dietMap   = { vegan: 2, vegetarian: 3.5, omnivore: 5, 'meat-heavy': 7.5 };
        const foodDaily = dietMap[diet] ?? 5;

        let wasteDaily = 1.2;
        if (recycle) wasteDaily -= 0.4;
        if (compost)  wasteDaily -= 0.3;
        wasteDaily = Math.max(wasteDaily, 0);

        const waterDaily = showerMins * 0.05;

        const totalKg = parseFloat(
            (transportTotal + energyTotal + foodDaily + wasteDaily + waterDaily).toFixed(2)
        );

        const breakdown = {
            transport: parseFloat(transportTotal.toFixed(2)),
            energy:    parseFloat(energyTotal.toFixed(2)),
            food:      parseFloat(foodDaily.toFixed(2)),
            waste:     parseFloat(wasteDaily.toFixed(2)),
            water:     parseFloat(waterDaily.toFixed(2)),
        };

        // ── Persist log entry ─────────────────────────────────────────────
        const entry = {
            id:        uuidv4(),
            userId:    req.userId,
            totalKg,
            breakdown,
            inputs: { transport, energy, food, waste, water },
            recordedAt: new Date().toISOString(),
        };

        const logs = store.footprintLogs.get(req.userId) || [];
        logs.push(entry);
        store.footprintLogs.set(req.userId, logs);

        // Update user's latest footprint (used by leaderboard)
        const user = store.users.get(req.userId);
        user.latestFootprint = totalKg;
        store.users.set(req.userId, user);

        res.status(201).json({
            message: 'Footprint saved',
            entry,
            annualEstimate: parseFloat((totalKg * 365 / 1000).toFixed(2)), // tons/yr
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── GET /api/footprint/me  — own history ────────────────────────────────────
router.get('/me', authenticate, (req, res) => {
    const logs = store.footprintLogs.get(req.userId) || [];
    // newest first
    res.json(logs.slice().reverse());
});

// ── GET /api/footprint/me/latest  — most recent entry ──────────────────────
router.get('/me/latest', authenticate, (req, res) => {
    const logs = store.footprintLogs.get(req.userId) || [];
    if (!logs.length) return res.json(null);
    res.json(logs[logs.length - 1]);
});

// ── GET /api/footprint/:userId  — a contact's history (friends only) ────────
router.get('/:userId', authenticate, (req, res) => {
    const { userId } = req.params;

    const myFriends = store.friends.get(req.userId) || new Set();
    if (!myFriends.has(userId) && userId !== req.userId) {
        return res.status(403).json({ error: 'You can only view footprints of your friends' });
    }

    const targetUser = store.users.get(userId);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    const logs = store.footprintLogs.get(userId) || [];
    res.json({
        user: { id: targetUser.id, name: targetUser.name },
        logs: logs.slice().reverse(),
    });
});

module.exports = router;
