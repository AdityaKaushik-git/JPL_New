# JPL — JCC Cricket Sports Meet · Live Player Auction

A real-time cricket player auction built for a projector-first live event.
Franchise **owners** (who do not play) bid from a **₹18,00,00,000** purse to build squads of at most **12 players**.
Players have **no photos** — identity is carried by initials, role glyphs, rankings and statistics from MySQL.

**Stack:** Node.js · Express 5 · Socket.IO 4 · MySQL 8 (mysql2) · JWT · bcrypt · React 18 + Vite · lucide-react

---

## 1. Architecture

```
client/  (React + Vite, built to client/dist and served by Express)
  src/components/live/   broadcast stage: PlayerHero, BidPanel, TimerRing, TeamStrip, BidFeed, ResultOverlay
  src/pages/             Live, BidRoom, AdminControl, Admin, Rankings, PlayerProfile, Dashboard, …
  src/hooks/useAuctionSocket.js   one socket per page; mirrors server state
  src/lib/format.js      the single currency formatter (₹18,00,00,000 / ₹1.74 Cr)
server/
  config/auction.js      business rules: purse, squad size, timer, bid increments
  sockets/auctionSocket.js   the auction engine (server-authoritative)
  services/ranking.js    JPL ranking algorithm (documented in the file header)
  services/franchises.js franchise creation — purse/squad assigned here, never from input
  controllers/, routes/  REST API
database/
  schema.sql             fresh install
  migrate.js             idempotent migrator (runs on every `npm start`)
  migrations/001_premium_auction.sql   manual one-shot upgrade of the original schema
  seed.js                demo franchises + 24 players with stats
tests/auction.integration.test.js
```

### Server is the source of truth
Clients only send *intents*. For every bid the engine:
1. authenticates the socket (JWT) and requires role `user` (franchise owner);
2. **computes the bid amount itself** (client amount is only used to detect a stale click);
3. rejects self-outbidding, closed lots and expired timers;
4. opens a transaction and locks the franchise row and the auction row (`SELECT … FOR UPDATE`);
5. re-checks franchise `status = active`, **squad < 12** and **purse ≥ bid** from MySQL;
6. records the bid, commits, then broadcasts.

All state-changing socket handlers run through a single serial queue, so simultaneous bids are processed one after another (verified by test: two identical bids in the same instant → exactly one accepted).
The SELL step re-checks purse and squad under lock. CHECK constraints (`purse ≥ 0`, `squad_count ≤ max_squad_size`) back this up in the database.

### Socket.IO events
| Direction | Event | Notes |
|---|---|---|
| client → server | `user:join` | request a snapshot (also sent automatically on connect) |
| | `user:placeBid {auctionId, amount}` | franchise owners only |
| | `admin:startPlayer {playerId}` / `admin:nextPlayer` | next = lowest `auction_order` that is Available |
| | `admin:pauseAuction` / `admin:resumeAuction` | |
| | `admin:sellPlayer` / `admin:markUnsold` | |
| | `admin:reAuction {playerId}` | Unsold → Available |
| server → client | `auction:stateUpdate` | full state (player, lot, bid, bidder, timer, history, result) |
| | `auction:timer` | seconds left, every second |
| | `auction:bidPlaced`, `auction:sold`, `auction:unsold` | drive animations |
| | `teams:update` | purses & squad counts for the team strip |
| | `players:changed`, `auction:playerReset`, `purse:update`, `live:stats`, `auction:notification` | |

**Timer:** starts at `AUCTION_INITIAL_SECONDS` (30), resets to `AUCTION_BID_RESET_SECONDS` (15) when a bid lands with less time left. At 00:00 the lot closes automatically — SOLD to the highest bidder, otherwise UNSOLD (`AUCTION_AUTO_FINALIZE=false` restores manual closing).
**Restart safety:** if the server restarts mid-lot, the open auction is restored in a *Paused* state.
**Bid increments:** +₹1,00,000 below ₹1 Cr · +₹5,00,000 up to ₹5 Cr · +₹10,00,000 above.

### Accounts
| Role | Created by | Can |
|---|---|---|
| `admin` | bootstrap (env) | everything; runs the auction |
| `user` = franchise owner | **admin only** | bid, view dashboard/squad/bids |
| `player` (legacy) | existing data | view own card; change own base price twice while Available |
| spectator | — | `/live`, rankings, teams, results, player profiles (read-only) |

There is **no public registration** (`/api/auth/register` no longer exists; `/register` redirects to login).

### JPL ranking
Original model, not ICC. Batting, bowling, all-rounder (√(B×W)) and wicketkeeper scores on a 0–1000 scale, adjusted for experience and player-of-the-match impact. Full formula is documented at the top of `server/services/ranking.js`. Rankings recompute whenever player data changes; movement, form (points delta) and history are stored.

---

## 2. Local installation

Requirements: Node 20+, MySQL 8.0.16+ (or MariaDB 10.4+).

```bash
git clone https://github.com/AdityaKaushik-git/JPL_JCC.git
cd JPL_JCC
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

## 3. Environment variables
See `.env.example`. Required: `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME`, `JWT_SECRET` (≥16 chars).
Optional: `DB_PORT`, `DB_SSL`, `DB_POOL_SIZE`, `PORT`, `CORS_ORIGIN`, `ADMIN_LOGIN_ID`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `AUCTION_INITIAL_SECONDS`, `AUCTION_BID_RESET_SECONDS`, `AUCTION_AUTO_FINALIZE`.

## 4. Database setup
- **Fresh database:** `npm run migrate` (creates tables from `schema.sql` and a bootstrap admin).
- **Existing database from the original version:** back it up, then `npm run migrate`. It is idempotent and:
  widens money columns to `DECIMAL(15,2)`, drops `players.photo_url`, adds stats/ranking/franchise columns and tables,
  removes owners that the old registration inserted as ₹0 "players", sets every franchise to ₹18 Cr (remaining = ₹18 Cr − actual spend) with a 12-player limit, and recalculates rankings.
  The same upgrade exists as plain SQL in `database/migrations/001_premium_auction.sql`.

## 5. Deploying on Render
Render has no managed MySQL, so `render.yaml` runs **MySQL 8 as a private service with a persistent disk**, and the app as a Docker web service.

1. Push this repo to GitHub.
2. Render → **New → Blueprint** → select the repo. Render reads `render.yaml`.
3. Set `ADMIN_PASSWORD` when prompted. `JWT_SECRET` and the MySQL passwords are generated.
4. Deploy. The container builds the client, runs `database/migrate.js`, then starts the server. Health check: `/api/health`.
5. Sign in as the admin → **Manage → Franchises → Create franchise**, add players, then open **/live** on the projector.

Keep the web service at **one instance** — the live auction clock lives in that process. Private services and disks need a paid Render plan.
Using an external MySQL instead? Delete the `pserv` block, set `DB_*` manually and `DB_SSL=true` if required.

## 6. Testing
```bash
npm run seed
AUCTION_INITIAL_SECONDS=5 AUCTION_BID_RESET_SECONDS=3 npm run start:server
# in another terminal
TEST_BASE_URL=http://localhost:3000 npm test
```
Covers: registration removed; franchise always gets ₹18 Cr / 12 slots even if the request tries to set them; owner cannot call admin APIs; spectators cannot bid; tampered bid amounts rejected; concurrent identical bids → one accepted; self-outbid blocked; auto SOLD / UNSOLD at 00:00; purse arithmetic; 12-player limit → SQUAD FULL.

**Manual event rehearsal:** open `/live` on a second screen (press **F** for fullscreen), sign in two owners in separate browsers at `/auction`, run players from `/admin/control`, and check SOLD/UNSOLD overlays, the team strip pulse, and the purse/squad counts in each owner's dashboard.
