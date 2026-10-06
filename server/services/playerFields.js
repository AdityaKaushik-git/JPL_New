/**
 * Whitelist + validation for admin-managed player data.
 * Only these fields can ever be written from an API request.
 * Derived stats (averages, strike rates, economy) and ranking fields are
 * computed by services/ranking.js and are never accepted from the client.
 */
const { parseMoney } = require('../utils/money');

const ROLES = ['Batsman', 'Bowler', 'All-Rounder', 'Wicket Keeper'];

const TEXT_FIELDS = {
    name:          { required: true,  max: 100 },
    enrollment_number: { required: true, max: 50 },
    course:        { required: false, max: 50 },
    year:          { required: false, max: 20 },
    batting_style: { required: false, max: 40 },
    bowling_style: { required: false, max: 60 },
    highest_score: { required: false, max: 10 },
    best_bowling:  { required: false, max: 10 },
    // New: country and image fields
    country:       { required: false, max: 60 },
    country_code:  { required: false, max: 4 },
    image_url:     { required: false, max: 500 },
    image_source:  { required: false, max: 255 },
};

// name: [min, max]
const INT_FIELDS = {
    auction_order:    [0, 100000],
    matches:          [0, 1000],
    innings:          [0, 1000],
    not_outs:         [0, 1000],
    runs:             [0, 100000],
    balls_faced:      [0, 100000],
    fifties:          [0, 500],
    hundreds:         [0, 500],
    balls_bowled:     [0, 100000],
    runs_conceded:    [0, 100000],
    wickets:          [0, 5000],
    three_wkt_hauls:  [0, 500],
    four_wkt_hauls:   [0, 500],
    five_wkt_hauls:   [0, 500],
    catches:          [0, 5000],
    stumpings:        [0, 5000],
    run_outs:         [0, 5000],
    player_of_match:  [0, 500],
    form_points:      [0, 100],
};

/**
 * Validates a player payload.
 * @param {object} body     request body
 * @param {boolean} partial when true, only fields present are validated (update)
 * @returns {{ values: object, errors: string[] }}
 */
function validatePlayer(body, partial = false) {
    const values = {};
    const errors = [];
    body = body || {};

    for (const [field, rule] of Object.entries(TEXT_FIELDS)) {
        if (!(field in body)) {
            if (!partial && rule.required) errors.push(`${field} is required`);
            continue;
        }
        const v = body[field] === null || body[field] === undefined ? '' : String(body[field]).trim();
        if (rule.required && !v) { errors.push(`${field} is required`); continue; }
        if (v.length > rule.max) { errors.push(`${field} must be at most ${rule.max} characters`); continue; }

        // country_code: uppercase
        if (field === 'country_code' && v) {
            values[field] = v.toUpperCase().slice(0, 4);
        } else {
            values[field] = v || (field === 'course' || field === 'year' ? 'N/A' : null);
        }
    }

    if ('playing_role' in body || !partial) {
        if (!ROLES.includes(body.playing_role)) errors.push(`playing_role must be one of: ${ROLES.join(', ')}`);
        else values.playing_role = body.playing_role;
    }

    if ('base_price' in body || !partial) {
        // Max ₹50 Cr (500,000,000) to match the new starting purse
        const price = parseMoney(body.base_price, { min: 1000, max: 500000000 });
        if (price === null) errors.push('base_price must be a whole rupee amount between ₹1,000 and ₹50,00,00,000');
        else values.base_price = price;
    }

    // base_price_auto: boolean flag (1 = auto-calculate from points, 0 = admin override)
    if ('base_price_auto' in body) {
        values.base_price_auto = body.base_price_auto ? 1 : 0;
    }

    for (const [field, [min, max]] of Object.entries(INT_FIELDS)) {
        if (!(field in body)) {
            if (!partial) values[field] = field === 'auction_order' ? null : 0;
            continue;
        }
        if (body[field] === '' || body[field] === null) { values[field] = field === 'auction_order' ? null : 0; continue; }
        const v = Number(body[field]);
        if (!Number.isInteger(v) || v < min || v > max) {
            errors.push(`${field} must be a whole number between ${min} and ${max}`);
            continue;
        }
        values[field] = v;
    }

    if (values.not_outs !== undefined && values.innings !== undefined && values.not_outs > values.innings) {
        errors.push('not_outs cannot exceed innings');
    }
    if (values.innings !== undefined && values.matches !== undefined && values.innings > values.matches) {
        errors.push('innings cannot exceed matches');
    }

    return { values, errors };
}

module.exports = { ROLES, TEXT_FIELDS, INT_FIELDS, validatePlayer };
