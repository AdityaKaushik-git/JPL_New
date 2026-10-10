/**
 * Shapes database rows into API payloads.
 * Public payloads never include login credentials, enrollment numbers or contact data.
 */
const { toRupees } = require('../utils/money');

const n = (v) => (v === null || v === undefined ? null : Number(v));

function initialsOf(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function publicPlayer(p, extra = {}) {
    if (!p) return null;
    return {
        id: p.id,
        player_code: p.player_code,
        auction_order: n(p.auction_order),
        name: p.name,
        initials: initialsOf(p.name),
        playing_role: p.playing_role,
        batting_style: p.batting_style || null,
        bowling_style: p.bowling_style || null,
        course: p.course,
        year: p.year,
        // Country & image (proxied via /api/players/:id/photo for reliable 100% loading)
        country: p.country || null,
        country_code: p.country_code || null,
        is_uncapped: p.is_uncapped !== undefined ? Boolean(Number(p.is_uncapped)) : false,
        image_url: p.id ? `/api/players/${p.id}/photo` : (p.image_url || null),
        raw_image_url: p.image_url || null,
        image_source: p.image_source || null,
        base_price_auto: p.base_price_auto !== undefined ? Boolean(Number(p.base_price_auto)) : true,
        base_price: toRupees(p.base_price),
        status: p.status,

        ranking_points: n(p.ranking_points) || 0,
        previous_ranking_points: n(p.previous_ranking_points) || 0,
        current_rank: n(p.current_rank),
        previous_rank: n(p.previous_rank),
        category_rank: n(p.category_rank),
        previous_category_rank: n(p.previous_category_rank),
        set_number: n(p.category_rank) ? Math.ceil(Number(p.category_rank) / 10) : null,
        set_label: n(p.category_rank) ? `Set ${Math.ceil(Number(p.category_rank) / 10)}` : null,
        form_points: n(p.form_points) || 0,

        matches: n(p.matches) || 0,
        innings: n(p.innings) || 0,
        not_outs: n(p.not_outs) || 0,
        runs: n(p.runs) || 0,
        balls_faced: n(p.balls_faced) || 0,
        highest_score: p.highest_score || null,
        batting_average: n(p.batting_average) || 0,
        strike_rate: n(p.strike_rate) || 0,
        fifties: n(p.fifties) || 0,
        hundreds: n(p.hundreds) || 0,

        balls_bowled: n(p.balls_bowled) || 0,
        runs_conceded: n(p.runs_conceded) || 0,
        wickets: n(p.wickets) || 0,
        bowling_average: n(p.bowling_average) || 0,
        economy: n(p.economy) || 0,
        bowling_strike_rate: n(p.bowling_strike_rate) || 0,
        best_bowling: p.best_bowling || null,
        three_wkt_hauls: n(p.three_wkt_hauls) || 0,
        four_wkt_hauls: n(p.four_wkt_hauls) || 0,
        five_wkt_hauls: n(p.five_wkt_hauls) || 0,

        catches: n(p.catches) || 0,
        stumpings: n(p.stumpings) || 0,
        run_outs: n(p.run_outs) || 0,
        player_of_match: n(p.player_of_match) || 0,
        ...extra,
    };
}

/** Admin payload: public data plus the internal identifiers admins manage. */
function adminPlayer(p) {
    return publicPlayer(p, {
        enrollment_number: p.enrollment_number,
        created_at: p.created_at,
        updated_at: p.updated_at,
    });
}

function logoUrl(u) {
    if (!u.logo) return null;
    const version = u.updated_at ? new Date(u.updated_at).getTime() : 0;
    return `/api/franchises/${u.id}/logo?v=${version}`;
}

function publicFranchise(u) {
    if (!u) return null;
    return {
        id: u.id,
        team_name: u.team_name || u.full_name,
        short_name: u.team_short_name || initialsOf(u.team_name || u.full_name),
        owner_name: u.full_name,
        color: u.team_color || '#C8102E',
        logo_url: logoUrl(u),
        starting_purse: toRupees(u.starting_purse),
        remaining_purse: toRupees(u.purse),
        total_spent: toRupees(u.total_spent),
        squad_count: n(u.squad_count) || 0,
        max_squad_size: n(u.max_squad_size) || 15,
        // Role slot counts (squad composition enforcement — 5/5/3/1 = 14)
        batsmen_count: n(u.batsmen_count) || 0,
        bowlers_count: n(u.bowlers_count) || 0,
        allrounders_count: n(u.allrounders_count) || 0,
        keepers_count: n(u.keepers_count) || 0,
        foreign_count: n(u.foreign_count) || 0,
        uncapped_count: n(u.uncapped_count) || 0,
        total_player_points: n(u.total_player_points) || 0,
        batsmen_points: n(u.batsmen_points) || 0,
        status: u.status || 'active',
    };
}

module.exports = { initialsOf, publicPlayer, adminPlayer, publicFranchise, logoUrl };
