# Cool The Globe — Backend API

A Node.js + Express REST API powering the Cool The Globe carbon footprint app.

---

## Quick Start

```bash
npm install
node server.js          # starts on http://localhost:3000
```

Set `JWT_SECRET` in `.env` before deploying.

---

## Architecture

```
server.js               — Express app entry point
middleware/auth.js       — JWT verification middleware
db/store.js             — In-memory data store (swap for MongoDB/PostgreSQL)
routes/
  auth.js               — Register & Login
  users.js              — User profiles & search
  footprint.js          — Save & retrieve carbon scores
  friends.js            — Friend requests & friend list
  leaderboard.js        — Ranked leaderboards
  community.js          — Community groups via contacts
```

---

## Authentication

All routes except `POST /api/auth/register` and `POST /api/auth/login` require a Bearer token.

```
Authorization: Bearer <token>
```

---

## API Reference

### Auth

| Method | Endpoint              | Body                              | Description          |
|--------|-----------------------|-----------------------------------|----------------------|
| POST   | /api/auth/register    | `{ name, email, password }`       | Create account       |
| POST   | /api/auth/login       | `{ email, password }`             | Get JWT token        |

---

### Users

| Method | Endpoint              | Description                            |
|--------|-----------------------|----------------------------------------|
| GET    | /api/users/me         | Own profile                            |
| PUT    | /api/users/me         | Update name / privacy (`isPublic`)     |
| GET    | /api/users/search?q=  | Search users by name or email          |
| GET    | /api/users/:id        | Public profile (respects privacy flag) |

---

### Carbon Footprint

| Method | Endpoint                  | Description                                 |
|--------|---------------------------|---------------------------------------------|
| POST   | /api/footprint            | Save a new footprint calculation            |
| GET    | /api/footprint/me         | Full history (newest first)                 |
| GET    | /api/footprint/me/latest  | Most recent entry                           |
| GET    | /api/footprint/:userId    | A friend's history (friends only)           |

#### POST /api/footprint body
```json
{
  "transport":  { "carKm": 20, "publicKm": 5, "flightHrs": 10 },
  "energy":     { "acHrs": 6, "electricityBill": 2000 },
  "food":       { "diet": "omnivore" },
  "waste":      { "recycle": true, "compost": false },
  "water":      { "showerMins": 10 }
}
```
`diet` options: `vegan` | `vegetarian` | `omnivore` | `meat-heavy`

---

### Friends

| Method | Endpoint                       | Body               | Description                       |
|--------|--------------------------------|--------------------|-----------------------------------|
| POST   | /api/friends/request           | `{ toUserId }`     | Send friend request               |
| GET    | /api/friends/requests/incoming |                    | Incoming pending requests         |
| GET    | /api/friends/requests/outgoing |                    | Outgoing pending requests         |
| POST   | /api/friends/accept            | `{ fromUserId }`   | Accept a request                  |
| POST   | /api/friends/reject            | `{ fromUserId }`   | Reject a request                  |
| GET    | /api/friends                   |                    | List friends with latest footprint|
| DELETE | /api/friends/:friendId         |                    | Remove a friend                   |

---

### Leaderboard

| Method | Endpoint                            | Description                                  |
|--------|-------------------------------------|----------------------------------------------|
| GET    | /api/leaderboard/friends            | Me + all friends ranked by footprint         |
| GET    | /api/leaderboard/global             | Top 50 public users globally                 |
| GET    | /api/leaderboard/community/:id      | Members of a community ranked                |

Leaderboard entries include:
- `rank` — 1 = greenest (lowest CO₂)
- `ecoScore` — 0–100 (100 = best performer in the group)
- `recentLogs` — last 7 daily entries
- `latestFootprint` — live score from the contact's actual account

---

### Community (Groups via Contacts)

| Method | Endpoint                         | Body                        | Description                      |
|--------|----------------------------------|-----------------------------|----------------------------------|
| POST   | /api/community                   | `{ name, description }`     | Create a community               |
| GET    | /api/community                   |                             | Communities I belong to          |
| GET    | /api/community/:id               |                             | Community detail + member list   |
| POST   | /api/community/:id/invite        | `{ userId }`                | Invite a friend (single)         |
| POST   | /api/community/:id/invite-bulk   | `{ userIds: [...] }`        | Invite multiple friends at once  |
| DELETE | /api/community/:id/leave         |                             | Leave community                  |
| DELETE | /api/community/:id               |                             | Delete community (admin only)    |

> **Note:** Only accepted friends can be invited to communities, enforcing the "community through contacts" requirement.

---

## Key Design Decisions

1. **Live footprint scores** — the leaderboard always reads `user.latestFootprint` from each contact's actual account, not a manually typed number. When a friend recalculates, the leaderboard updates automatically.

2. **Friend-gated data** — you can only view a friend's full footprint history if they are an accepted friend. The global leaderboard only shows users who have set `isPublic: true`.

3. **Community via contacts** — you can only invite people to a community who are already in your friend list, mirroring the real-world "community through contacts" pattern.

4. **ecoScore** — a 0–100 relative score computed per leaderboard group, making comparison easy regardless of absolute CO₂ numbers.

---

## Frontend Integration (app.js changes needed)

Replace the mock auth/contact system with real API calls:

```js
// Register
const res = await fetch('/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name, email, password })
});
const { token, user } = await res.json();
localStorage.setItem('ctg_token', token);

// Save footprint after calculation
await fetch('/api/footprint', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('ctg_token')}`
  },
  body: JSON.stringify({ transport, energy, food, waste, water })
});

// Load leaderboard
const lb = await fetch('/api/leaderboard/friends', {
  headers: { 'Authorization': `Bearer ${localStorage.getItem('ctg_token')}` }
});
const ranked = await lb.json();
```

---

## Production Notes

- Replace the in-memory `store.js` with **MongoDB** (Mongoose) or **PostgreSQL** (Prisma).
- Store `JWT_SECRET` in environment variables, never in code.
- Add **rate limiting** (`express-rate-limit`) on `/api/auth` routes.
- Enable **HTTPS** via a reverse proxy (Nginx / Caddy).
