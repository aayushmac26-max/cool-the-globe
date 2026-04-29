// db/store.js — In-memory store (swap with MongoDB/PostgreSQL for production)
// All data is stored in JavaScript Maps for fast O(1) lookups.

const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'data.json');

const store = {
    // ── USERS ──────────────────────────────────────────────
    users: new Map(),
    emailIndex: new Map(),

    // ── FOOTPRINT LOGS ─────────────────────────────────────
    footprintLogs: new Map(),

    // ── FRIEND SYSTEM ──────────────────────────────────────
    friends: new Map(),
    friendRequests: new Map(),

    // ── COMMUNITY ──────────────────────────────────────────
    communities: new Map(),
    communityMembers: new Map(),

    save: function() {
        try {
            const data = {
                users: Array.from(this.users.entries()),
                emailIndex: Array.from(this.emailIndex.entries()),
                footprintLogs: Array.from(this.footprintLogs.entries()),
                friends: Array.from(this.friends.entries()).map(([k, set]) => [k, Array.from(set)]),
                friendRequests: Array.from(this.friendRequests.entries()),
                communities: Array.from(this.communities.entries()),
                communityMembers: Array.from(this.communityMembers.entries()).map(([k, set]) => [k, Array.from(set)])
            };
            fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
        } catch (error) {
            console.error('Failed to save DB:', error);
        }
    },

    load: function() {
        if (!fs.existsSync(DB_FILE)) return;
        try {
            const fileData = fs.readFileSync(DB_FILE, 'utf-8');
            const data = JSON.parse(fileData);
            
            if (data.users) this.users = new Map(data.users);
            if (data.emailIndex) this.emailIndex = new Map(data.emailIndex);
            if (data.footprintLogs) this.footprintLogs = new Map(data.footprintLogs);
            if (data.friends) {
                this.friends = new Map();
                for (const [k, arr] of data.friends) {
                    this.friends.set(k, new Set(arr));
                }
            }
            if (data.friendRequests) this.friendRequests = new Map(data.friendRequests);
            if (data.communities) this.communities = new Map(data.communities);
            if (data.communityMembers) {
                this.communityMembers = new Map();
                for (const [k, arr] of data.communityMembers) {
                    this.communityMembers.set(k, new Set(arr));
                }
            }
        } catch (error) {
            console.error('Failed to load DB:', error);
        }
    }
};

// Load existing data at startup
store.load();

// Auto-save every 5 seconds so we don't lose data and don't need to update all routes manually
setInterval(() => store.save(), 5000);

module.exports = store;
