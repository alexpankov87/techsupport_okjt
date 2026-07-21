#!/usr/bin/env node
/**
 * Callback / ObjectId parsing self-check.
 * Run after build: node scripts/check-ids.js
 */
const assert = require('assert');
const path = require('path');
const {
  parseObjectId,
  parseWorkerCallback,
  parseCategoryCallback,
} = require(path.join(__dirname, '..', 'dist', 'bot', 'utils', 'ids.js'));

function ok(m) { console.log('OK:', m); }

assert.strictEqual(parseObjectId('507f1f77bcf86cd799439011'), '507f1f77bcf86cd799439011');
assert.strictEqual(parseObjectId(''), undefined);
assert.strictEqual(parseObjectId('category_printer'), undefined);
assert.strictEqual(parseObjectId('6060798375'), undefined); // telegram id
ok('parseObjectId');

assert.strictEqual(parseWorkerCallback('worker_507f1f77bcf86cd799439011'), '507f1f77bcf86cd799439011');
assert.strictEqual(parseWorkerCallback('category_printer'), undefined);
assert.strictEqual(parseWorkerCallback('worker_'), undefined);
assert.strictEqual(parseWorkerCallback('worker_not-an-id'), undefined);
ok('parseWorkerCallback rejects category_/junk');

assert.strictEqual(parseCategoryCallback('category_printer'), 'printer');
assert.strictEqual(parseCategoryCallback('worker_507f1f77bcf86cd799439011'), undefined);
assert.strictEqual(parseCategoryCallback('category_nope'), undefined);
ok('parseCategoryCallback');

console.log('All id/callback checks passed');
