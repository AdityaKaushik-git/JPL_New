# JPL — JCC Cricket Sports Meet · Live Player Auction

A real-time cricket player auction built for a projector-first live event.
Franchise **owners** (who do not play) bid from a **₹75,00,00,000** (₹75 Cr) purse to build squads of **15 players**.
Players have **no photos** — identity is carried by initials, role glyphs, rankings, points and statistics from MySQL.

**Stack:** Node.js · Express 5 · Socket.IO 4 · MySQL 8 (mysql2) · JWT · bcrypt · React 18 + Vite · lucide-react

---

## 1. Auction Rules (JPL 2026 Single Source of Truth)

All business rules are strictly enforced by the server in `server/config/auction.js` and under transaction locks in MySQL:

| Rule | Value | Enforcement |
|---|---|---|
| **Starting Purse** | **₹75,00,00,000** (₹75 Cr) | Assigned by server on franchise creation; client values ignored |
| **Squad Size** | **15 players** max | Checked under row locks on every bid and finalize |
| **Batsman Slot** | Max **5** per squad | Squad composition check (`BATSMAN SLOT FULL`) |
| **Bowler Slot** | Max **5** per squad | Squad composition check (`BOWLER SLOT FULL`) |
| **All-Rounder Slot** | Max **3** per squad | Squad composition check (`ALL-ROUNDER SLOT FULL`) |
| **Wicket Keeper Slot** | Max **2** per squad | Squad composition check (`WICKET-KEEPER SLOT FULL`) |
| **Indian Minimum** | Min **3** Indian players | Foreign player purchase blocked if remaining open slots < Indian shortfall |
| **Foreign Players** | **No cap** (Unlimited) | Any number of overseas players permitted as long as Indian minimum can be satisfied |

### Bid Increment Ladder (JPL 2026)
Bid increments scale progressively based on the current bid:
- `< ₹50 L`: **+₹5,00,000** (+₹5 L)
- `₹50 L – ₹1 Cr`: **+₹10,00,000** (+₹10 L)
- `₹1 Cr – ₹2 Cr`: **+₹25,00,000** (+₹25 L)
- `₹2 Cr – ₹5 Cr`: **+₹50,00,000** (+₹50 L)
- `₹5 Cr – ₹10 Cr`: **+₹1,00,00,000** (+₹1 Cr)
- `₹10 Cr – ₹20 Cr`: **+₹2,00,00,000** (+₹2 Cr)
- `≥ ₹20 Cr`: **+₹5,00,00,000** (+₹5 Cr)

---

## 2. Player Queue & Role Slot Ordering

The auction engine sequences players according to the **10-player Role Slot Rule**:
- **Set 1:** 10 random **Batsmen**, 10 random **Bowlers**, 10 random **Wicket Keepers**, 10 random **All-Rounders**
- **Set 2:** Next 10 random **Batsmen**, 10 random **Bowlers**, 10 random **Wicket Keepers**, 10 random **All-Rounders**
- **Subsequent Sets:** Repeats in 10-player chunks until all 280 players across all roles are sequenced.

### Randomization & Queue Controls
- Within each role's pool, players are shuffled randomly using Fisher-Yates, ensuring unpredictable lots while preserving role slots.
- **Admin Control & Admin Pages:** Admins can click **Randomize queue** at any time to re-shuffle the available queue while maintaining the slot rule.
- **Role Progression:** Admins can advance sequentially through the global queue or filter and auction `Next <Role>` players on demand.
- **Auction Start OTP:** Starting or resetting the auction requires email OTP verification and automatically initializes a fresh randomized queue.

---

## 3. Architecture

```
client/  (React + Vite, built to client/dist and served by Express)
  src/components/live/   broadcast stage: PlayerHero, BidPanel, TimerRing, TeamStrip, BidFeed, ResultOverlay
  src/components/        RoleSlots, PlayerCard, Toast, Modal, Initials, TeamMark, RoleIcon
  src/pages/             Live, BidRoom, AdminControl, Admin, Rankings, PlayerProfile, Dashboard, Standings
  src/hooks/useAuctionSocket.js   one socket per page; mirrors server state
  src/lib/format.js      the single currency formatter (₹75,00,00,000 / ₹1.74 Cr)
server/
  config/auction.js      business rules: purse, squad size, timer, bid increments, role limits
  sockets/auctionSocket.js   the auction engine (server-authoritative)
  services/ranking.js    ranking algorithm + randomized slot queue builder (`buildSlotOrderedQueue`)
  services/franchises.js franchise creation — purse/squad assigned here, never from input
  services/emailService.js OTP verification for start/reset auction safety
  controllers/, routes/  REST API
database/
  schema.sql             fresh install
  migrate.js             idempotent migrator (runs on every `npm start`)
  migrations/            incremental schema & rule migrations
  seed.js                demo franchises + players with stats
tests/
  rules.unit.test.js     unit tests for purse, slots, foreign/Indian rules, and randomized slot queue
  auction.integration.test.js
  privacy.test.js
```

### Server is the source of truth
Clients only send *intents*. For every bid the engine:
1. authenticates the socket (JWT) and requires role `user` (franchise owner);
2. **computes the bid amount itself** (client amount is only used to detect a stale click);
3. rejects self-outbidding, closed lots, and expired timers;
4. opens a transaction and locks the franchise row and the auction row (`SELECT … FOR UPDATE`);
5. re-checks franchise `status = active`, **squad < 15**, **purse ≥ bid**, and **role slot limits** from MySQL;
6. records the bid, commits, then broadcasts.

All state-changing socket handlers run through a single serial queue, so simultaneous bids are processed one after another. The SELL step re-checks purse, squad size, and role slots under lock.

### Socket.IO events
| Direction | Event | Notes |
|---|---|---|
| client → server | `user:join` | request a snapshot (also sent automatically on connect) |
| | `user:placeBid {auctionId, amount}` | franchise owners only |
| | `admin:startPlayer {playerId}` | start lot for a specific player |
| | `admin:nextPlayer {role}` | next Available player (overall or filtered by role) |
| | `admin:startAuction` | start/resume auction safely in Paused state |
| | `admin:pauseAuction` / `admin:resumeAuction` | pause/resume clock |
| | `admin:sellPlayer` / `admin:markUnsold` | close lot |
| | `admin:reAuction {playerId}` | Unsold → Available |
| | `admin:randomizeQueue` | randomize player queue following role slot rule |
| | `admin:toggleRankings {enabled}` | toggle live ranking points visibility for bidders |
| server → client | `auction:stateUpdate` | full state (player, lot, bid, bidder, timer, history, result) |
| | `auction:timer` | seconds left, every second |
| | `auction:bidPlaced`, `auction:sold`, `auction:unsold` | drive animations |
| | `teams:update` | purses & squad counts for the team strip |
| | `players:changed`, `auction:playerReset`, `purse:update`, `live:stats`, `auction:notification` | |

**Timer:** starts at `AUCTION_INITIAL_SECONDS` (30), resets to `AUCTION_BID_RESET_SECONDS` (10) when a bid lands with less time left. At 00:00 the lot closes automatically (`AUCTION_AUTO_FINALIZE=false` restores manual closing).
**Restart safety:** if the server restarts mid-lot, the open auction is restored in a *Paused* state.

---

## 4. Local installation

Requirements: Node 20+, MySQL 8.0.16+ (or MariaDB 10.4+).

```bash
git clone https://github.com/AdityaKaushik-git/JPL_New.git
cd JPL_New/JPL_JCC_New
cp .env.example .env          # set DB_* and a long JWT_SECRET
npm install
npm run build                 # builds the React client into client/dist
npm run seed                  # creates/upgrades the schema + demo data (optional)
npm start                     # migrates, then starts on http://localhost:3000
```

For client hot-reload: `npm run start:server` in one terminal and `cd client && npm run dev` in another (Vite proxies `/api` and `/socket.io` to port 3000).

**Demo accounts (after `npm run seed`)**
- Admin: `ADMIN001` / value of `ADMIN_PASSWORD` (default `admin123` — change it)
- Owners: `titans@jpl.com`, `warriors@jpl.com`, `royals@jpl.com`, `strikers@jpl.com` / `Owner@123`

---

## 5. Testing

```bash
# Run unit tests
node --test tests/rules.unit.test.js

# Build client production bundle
npm run build
```
Tests cover: starting purse ₹75 Cr; 15-player squad limit; no foreign cap; min 3 Indian players requirement; role slot limits; randomized queue slot rule; sequential queue advancement; and tamper-proof server bid validation.

