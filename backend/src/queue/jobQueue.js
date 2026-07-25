'use strict';

const { getBoss } = require('../config/pgboss');

const SCRAPE_JOB_NAME = 'scrape-listing';

/**
 * Enqueues a scraping job for a specific MerchantListing.
 *
 * pg-boss will:
 * - Persist the job in PostgreSQL (survives server restarts)
 * - Retry automatically up to `retryLimit` times with backoff (configured in pgboss.js)
 * - Track job state: created → active → completed / failed
 *
 * @param {string} listingId - The MerchantListing ID to scrape
 * @returns {Promise<string>} The pg-boss job ID
 */
async function enqueueScrapingJob(listingId) {
  const boss = getBoss();

  const jobId = await boss.send(SCRAPE_JOB_NAME, { listingId }, {
    // Prevent duplicate jobs for the same listing within 60 seconds
    singletonKey: `scrape-${listingId}`,
    singletonSeconds: 60,
    // Per-job retry config (pg-boss v12 — set here, not in constructor)
    retryLimit: 3,
    retryDelay: 30,       // seconds between retries
    retryBackoff: true,   // exponential backoff
    expireInSeconds: 600, // expire if not started within 10 min
  });

  console.log(`[Queue] Enqueued scraping job for listing ${listingId} → jobId: ${jobId}`);
  return jobId;
}

/**
 * The job name constant — used by both the queue and the worker
 * to ensure they reference the same queue channel.
 */
module.exports = { enqueueScrapingJob, SCRAPE_JOB_NAME };
