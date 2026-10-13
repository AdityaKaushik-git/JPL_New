const { test } = require('node:test');
const assert = require('node:assert/strict');
const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config({ path: '.env' });

const BASE = 'http://localhost:3000';

test('1. Database has exactly 280 players matching Excel points', async () => {
  const sslFlag = String(process.env.DB_SSL || '').toLowerCase() === 'true'
    || (process.env.DB_HOST && process.env.DB_HOST.includes('aivencloud.com'));
  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT) || 3306,
    ssl: sslFlag ? { rejectUnauthorized: false } : undefined,
  });

  const [players] = await db.query('SELECT name, playing_role, ranking_points, country FROM players');
  assert.equal(players.length, 280, 'Total players in DB should be 280');

  // Verify key players
  const byName = {};
  for (const p of players) {
    byName[p.name.trim().toLowerCase()] = p;
  }

  assert.equal(byName['abhishek sharma'].ranking_points, 887, 'Abhishek Sharma points');
  assert.equal(byName['ishan kishan'].ranking_points, 902, 'Ishan Kishan points');
  assert.equal(byName['rashid khan'].ranking_points, 720, 'Rashid Khan points');
  assert.equal(byName['sahibzada farhan'].ranking_points, 818, 'Sahibzada Farhan points');
  assert.equal(byName['harry brook'].ranking_points, 793, 'Harry Brook points');
  assert.equal(byName['dewald brevis'].ranking_points, 789, 'Dewald Brevis points');
  assert.equal(byName['jos buttler'].ranking_points, 789, 'Jos Buttler points');
  assert.equal(byName['sikandar raza'].ranking_points, 321, 'Sikandar Raza points');
  assert.equal(byName['anuj rawat'].ranking_points, 130, 'Anuj Rawat points');
  assert.equal(byName['shreyas iyer'].ranking_points, 786, 'Shreyas Iyer points');

  // Users table has indian_count column
  const [cols] = await db.query("SHOW COLUMNS FROM users LIKE 'indian_count'");
  assert.equal(cols.length, 1, 'indian_count column must exist on users');

  await db.end();
});

test('2. /api/franchises returns indian_count and total_player_points', async () => {
  const res = await fetch(`${BASE}/api/franchises`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.franchises && Array.isArray(data.franchises));
  assert.ok(data.franchises.length > 0);
  for (const f of data.franchises) {
    assert.ok('indian_count' in f, `Franchise ${f.team_name} missing indian_count`);
    assert.ok('total_player_points' in f, `Franchise ${f.team_name} missing total_player_points`);
    assert.ok('foreign_count' in f, `Franchise ${f.team_name} missing foreign_count`);
  }
});

test('3. /api/players returns correct ranking_points from DB', async () => {
  const res = await fetch(`${BASE}/api/players`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.players && Array.isArray(data.players));
  assert.equal(data.players.length, 280);

  const abhi = data.players.find(p => p.name === 'Abhishek Sharma');
  assert.ok(abhi);
  assert.equal(abhi.ranking_points, 887);

  const ishan = data.players.find(p => p.name === 'Ishan Kishan');
  assert.ok(ishan);
  assert.equal(ishan.ranking_points, 902);
});

test('4. Rules in auction.js config reflect no foreign limit and min 3 Indian players', async () => {
  const config = require('../server/config/auction');
  assert.equal(config.MAX_FOREIGN_PLAYERS, Infinity, 'No limit on foreign players');
  assert.equal(config.MIN_INDIAN_PLAYERS, 3, 'Minimum 3 Indian players per squad');
  assert.equal(config.MAX_SQUAD_SIZE, 15, 'Squad size is 15');
  assert.equal(config.STARTING_PURSE, 750000000, 'Starting purse is 75 Cr');
});

console.log('Running test suite for new rules and player points...');
