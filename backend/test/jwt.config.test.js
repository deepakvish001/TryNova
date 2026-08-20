/**
 * config/jwt.js must refuse to load without a secret, rather than silently
 * falling back to a value published in this repository.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const CONFIG = path.join(__dirname, '..', 'config', 'jwt.js');

test('jwt config', async (t) => {
  await t.test('throws when JWT_SECRET is missing', () => {
    delete require.cache[require.resolve(CONFIG)];
    const saved = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    try {
      assert.throws(() => require(CONFIG), /JWT_SECRET is not set/);
    } finally {
      if (saved !== undefined) process.env.JWT_SECRET = saved;
      delete require.cache[require.resolve(CONFIG)];
    }
  });

  await t.test('exposes the configured secret', () => {
    delete require.cache[require.resolve(CONFIG)];
    process.env.JWT_SECRET = 'configured-secret';
    const { JWT_SECRET } = require(CONFIG);
    assert.equal(JWT_SECRET, 'configured-secret');
    delete require.cache[require.resolve(CONFIG)];
  });
});
