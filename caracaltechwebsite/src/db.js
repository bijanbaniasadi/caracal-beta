/**
 * Database Connection
 * PostgreSQL via Knex.js
 */

const knex = require('knex');
require('dotenv').config();

const db = knex({
  client: 'postgresql',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'caracaltech',
    password: process.env.DB_PASSWORD || 'caracaltech',
    database: process.env.DB_NAME || 'caracaltech_ecu',
  },
  migrations: {
    directory: './migrations',
    extension: 'js',
  },
  seeds: {
    directory: './seeds',
    extension: 'js',
  },
  pool: {
    min: 2,
    max: 10,
  },
});

// Health check
async function healthCheck() {
  try {
    await db.raw('SELECT 1');
    console.log('✓ Database connected');
    return true;
  } catch (error) {
    console.error('✗ Database connection failed:', error.message);
    return false;
  }
}

// Run pending migrations on startup (optional)
async function runMigrations() {
  try {
    const [batchNo, migrateResult] = await db.migrate.latest();
    if (batchNo === 0) {
      console.log('✓ No pending migrations');
    } else {
      console.log(`✓ Ran ${migrateResult.length} migrations (batch ${batchNo})`);
    }
  } catch (error) {
    console.error('✗ Migration failed:', error.message);
    throw error;
  }
}

module.exports = {
  db,
  healthCheck,
  runMigrations,
};
