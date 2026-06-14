require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log('🚀 Running migrations...');
    const sql = fs.readFileSync(
      path.join(__dirname, '001_init.sql'), 
      'utf8'
    );
    await client.query(sql);
    console.log('✅ Migrations complete.');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();