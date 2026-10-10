// Public, read-only player data for spectators, franchise owners and the live screen.
const pool = require('../config/db');
const { publicPlayer } = require('../services/serializers');
const { ROLE_CATEGORY } = require('../services/ranking');
const { listFranchises } = require('../services/franchises');
const { toRupees } = require('../utils/money');

const CATEGORY_ROLE = {
    batters: 'Batsman',
    bowlers: 'Bowler',
    'all-rounders': 'All-Rounder',
    allrounders: 'All-Rounder',
    wicketkeepers: 'Wicket Keeper',
};

async function ownershipMap() {
    const [rows] = await pool.query('SELECT player_id, user_id, purchase_price FROM teams');
    const teams = await listFranchises(pool);
    const byId = new Map(teams.map(t => [t.id, t]));
    const map = new Map();
    for (const r of rows) {
        const t = byId.get(r.user_id);
        map.set(r.player_id, {
            sold_price: toRupees(r.purchase_price),
            team: t ? { id: t.id, team_name: t.team_name, short_name: t.short_name, color: t.color, logo_url: t.logo_url } : null,
        });
    }
    return map;
}

exports.getAllPlayers = async (req, res) => {
    try {
        const [players] = await pool.query('SELECT * FROM players ORDER BY COALESCE(auction_order, id), id');
        const owners = await ownershipMap();
        res.json({ players: players.map(p => publicPlayer(p, owners.get(p.id) || { sold_price: null, team: null })) });
    } catch (error) {
        console.error('GET PLAYERS ERROR:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.getRankings = async (req, res) => {
    try {
        const category = String(req.query.category || 'overall').toLowerCase();
        const role = CATEGORY_ROLE[category];
        if (category !== 'overall' && !role) {
            return res.status(400).json({ message: 'category must be overall, batters, bowlers, all-rounders or wicketkeepers' });
        }
        const [players] = role
            ? await pool.query(
                'SELECT * FROM players WHERE playing_role = ? ORDER BY category_rank IS NULL, category_rank, name', [role])
            : await pool.query('SELECT * FROM players ORDER BY current_rank IS NULL, current_rank, name');
        const owners = await ownershipMap();
        const rows = players.map(p => {
            const pp = publicPlayer(p, owners.get(p.id) || { sold_price: null, team: null });
            const rank = role ? pp.category_rank : pp.current_rank;
            const prev = role ? pp.previous_category_rank : pp.previous_rank;
            return {
                ...pp,
                category: ROLE_CATEGORY[pp.playing_role],
                rank,
                previous: prev,
                movement: rank !== null && prev !== null ? prev - rank : 0,
                form: pp.ranking_points - pp.previous_ranking_points,
            };
        });
        res.json({ category, players: rows });
    } catch (error) {
        console.error('GET RANKINGS ERROR:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.getPlayerById = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id)) return res.status(400).json({ message: 'Invalid player id' });
        const [players] = await pool.query('SELECT * FROM players WHERE id = ?', [id]);
        if (players.length === 0) return res.status(404).json({ message: 'Player not found' });

        const owners = await ownershipMap();
        const player = publicPlayer(players[0], owners.get(id) || { sold_price: null, team: null });

        const [history] = await pool.query(
            'SELECT ranking_points, overall_rank, category_rank, recorded_at FROM ranking_history WHERE player_id = ? ORDER BY recorded_at, id',
            [id]
        );
        const [matches] = await pool.query(
            `SELECT id, match_label, match_date, runs, balls_faced, wickets, balls_bowled, runs_conceded, catches, stumpings
             FROM player_matches WHERE player_id = ? ORDER BY match_date DESC, id DESC`, [id]
        );
        const [bids] = await pool.query(
            `SELECT b.bid_amount, b.created_at, u.team_name, u.team_short_name, u.team_color
             FROM bids b JOIN auctions a ON a.id = b.auction_id JOIN users u ON u.id = b.user_id
             WHERE a.player_id = ? ORDER BY b.id DESC LIMIT 20`, [id]
        );

        res.json({
            player: { ...player, category: ROLE_CATEGORY[player.playing_role] },
            rankingHistory: history.map(h => ({
                points: Number(h.ranking_points), rank: h.overall_rank, categoryRank: h.category_rank, at: h.recorded_at,
            })),
            matches,
            bids: bids.map(b => ({
                amount: toRupees(b.bid_amount), at: b.created_at,
                team_name: b.team_name, short_name: b.team_short_name, color: b.team_color,
            })),
        });
    } catch (error) {
        console.error('GET PLAYER ERROR:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.getPlayerPhoto = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) return res.status(400).send('Invalid player ID');

        const [players] = await pool.query('SELECT name, image_url FROM players WHERE id = ?', [id]);
        if (!players.length) return res.status(404).send('Player not found');

        const p = players[0];
        let photoUrl = p.image_url;

        if (!photoUrl) {
            photoUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&size=500&background=1a1f2e&color=f2c14e&bold=true&format=png`;
        }

        try {
            const resp = await fetch(photoUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image// ,*;q=0.8'
                }
            });

            if (resp.ok) {
                const contentType = resp.headers.get('content-type') || 'image/jpeg';
                const buffer = Buffer.from(await resp.arrayBuffer());
                res.setHeader('Content-Type', contentType);
                res.setHeader('Cache-Control', 'public, max-age=86400');
                return res.send(buffer);
            }
        } catch (err) {
            console.error(`Error proxying photo for player ${id}:`, err.message);
        }

        // Fallback to UI Avatars
        const fallbackResp = await fetch(`https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&size=500&background=1a1f2e&color=f2c14e&bold=true&format=png`);
        const fallbackBuffer = Buffer.from(await fallbackResp.arrayBuffer());
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.send(fallbackBuffer);
    } catch (error) {
        console.error('GET PLAYER PHOTO PROXY ERROR:', error.message);
        res.status(500).send('Server error');
    }
};
