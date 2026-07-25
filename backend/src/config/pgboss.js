'use strict';

// pg-boss v12 exports a named class, NOT a default export
const { PgBoss } = require('pg-boss');

/** @type {InstanceType<typeof PgBoss> | null} */
let boss = null;

/**
 * Returns the singleton pg-boss instance.
 * Must call `startBoss()` before using jobs.
 *
 * NOTE: In pg-boss v12, retry options (retryLimit, retryDelay, retryBackoff)
 * are passed per-job in boss.send(), NOT in the constructor.
 */
function getBoss() {
  if (!boss) {
    boss = new PgBoss({
      connectionString: process.env.DATABASE_URL,
      // How long to retain completed/failed job rows
      deleteAfterDays: 3,
      // How often (in seconds) pg-boss polls for new jobs
      monitorStateIntervalSeconds: 30,
    });

    boss.on('error', (err) => {
      console.error('[pg-boss] Unhandled queue error:', err.message);
    });
  }
  return boss;
}

/**
 * Starts the pg-boss scheduler. Must be called once on server startup,
 * after the database connection is established.
 */
async function startBoss() {
  const instance = getBoss();
  await instance.start();

  // pg-boss v12: queues must be created explicitly before workers can register.
  // createQueue() is idempotent — safe to call on every startup.
  await instance.createQueue('scrape-listing');
  console.log('[pg-boss] Job queue started successfully.');
  return instance;
}

module.exports = { getBoss, startBoss };
