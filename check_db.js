const pool = require('./server/config/db');
async function check() {
  try {
    const [rows] = await pool.query('SELECT COUNT(*) as c FROM players');
    console.log('Total players in DB:', rows[0].c);
    const [sample] = await pool.query('SELECT name FROM players LIMIT 15');
    console.log('Sample players:', sample.map(s => s.name).join(', '));
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
check();