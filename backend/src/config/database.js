'use strict';

const { PrismaClient } = require('@prisma/client');

/** @type {PrismaClient} */
let prisma;

/**
 * Returns a singleton PrismaClient instance.
 * Reuses the existing instance across hot-reloads in development
 * to avoid exhausting the PostgreSQL connection pool.
 */
function getDb() {
  if (!prisma) {
    prisma = new PrismaClient({
      log:
        process.env.NODE_ENV === 'development'
          ? ['query', 'warn', 'error']
          : ['warn', 'error'],
    });
  }
  return prisma;
}

module.exports = getDb;
