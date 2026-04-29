const express = require('express');
const cors    = require('cors');
const dotenv  = require('dotenv');
const path    = require('path');

dotenv.config();

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

// ── Serve the frontend (parent directory) as static files ──────────────────
const frontendDir = path.join(__dirname, '..');
app.use(express.static(frontendDir));

// ── API Routes ─────────────────────────────────────────────────────────────
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/users',       require('./routes/users'));
app.use('/api/footprint',   require('./routes/footprint'));
app.use('/api/friends',     require('./routes/friends'));
app.use('/api/leaderboard', require('./routes/leaderboard'));
app.use('/api/community',   require('./routes/community'));

// ── Catch-all: serve index.html for any non-API route ─────────────────────
app.get('/{*path}', (req, res) => {
    res.sendFile(path.join(frontendDir, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅  Cool The Globe running → http://localhost:${PORT}`);
    console.log(`    Frontend + API served from the same port.`);
});
