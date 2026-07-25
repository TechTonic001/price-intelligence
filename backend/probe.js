// Probe all installed modules for correct export shapes
const results = {};

try {
  const pgBoss = require('pg-boss');
  results.pgBoss = {
    type: typeof pgBoss,
    keys: Object.keys(pgBoss),
    isFunction: typeof pgBoss === 'function',
    hasPgBossKey: !!pgBoss.PgBoss,
  };
} catch(e) { results.pgBoss = { error: e.message }; }

try {
  const puppeteer = require('puppeteer');
  results.puppeteer = {
    type: typeof puppeteer,
    keys: Object.keys(puppeteer).slice(0, 8),
    hasLaunch: typeof puppeteer.launch === 'function',
    hasPuppeteer: !!puppeteer.default,
  };
} catch(e) { results.puppeteer = { error: e.message }; }

try {
  const express = require('express');
  results.express = { version: require('express/package.json').version };
} catch(e) { results.express = { error: e.message }; }

try {
  const jwt = require('jsonwebtoken');
  results.jwt = { hasSign: typeof jwt.sign === 'function' };
} catch(e) { results.jwt = { error: e.message }; }

try {
  const bcrypt = require('bcrypt');
  results.bcrypt = { hasHash: typeof bcrypt.hash === 'function' };
} catch(e) { results.bcrypt = { error: e.message }; }

try {
  const { PrismaClient } = require('@prisma/client');
  results.prisma = { hasPrismaClient: typeof PrismaClient === 'function' };
} catch(e) { results.prisma = { error: e.message }; }

console.log(JSON.stringify(results, null, 2));
