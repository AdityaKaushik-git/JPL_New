const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'database', 'migrate.js');
let content = fs.readFileSync(filePath, 'utf8');

// The logic needs to dynamically find the block in case of slight whitespace differences
content = content.replace(/if \(!\(await tableExists\(db, 'users'\)\)\) \{[\s\S]*?\} else \{[\s\S]*?await upgradeExisting\(db\);\s*\}/m, 
`        const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
        // ALWAYS run schema to ensure missing tables are created.
        const queries = schema.split(';').filter(q => q.trim().length > 0);
        for (const q of queries) {
            await db.query(q);
        }

        if (!(await tableExists(db, 'users'))) {
            console.log('  fresh database: creating schema');
        } else {
            await upgradeExisting(db);
        }

        for (const name of ['001_remove_owner_player_rows', '002_franchise_18cr_12_players', '003_player_codes_and_order', '004_purse_50cr_squad_14', '005_role_counts_reconcile', '006_jpl2026_rules']) {
            await db.query('INSERT IGNORE INTO schema_migrations (name) VALUES (?)', [name]);
        }`);

fs.writeFileSync(filePath, content);
console.log('migrate.js patched successfully');