/**
 * The auth throttles.
 *
 * The middleware skips itself under NODE_ENV=test so the rest of the suite can
 * hit the same endpoint repeatedly. This file therefore loads it with the flag
 * cleared, proving both halves: that the limit fires, and that the skip works.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const express = require('express');

const MODULE = path.join(__dirname, '..', 'middleware', 'rateLimit.js');

function loadLimiters({ nodeEnv }) {
  const saved = process.env.NODE_ENV;
  if (nodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = nodeEnv;
  delete require.cache[require.resolve(MODULE)];
  const mod = require(MODULE);
  if (saved === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = saved;
  delete require.cache[require.resolve(MODULE)];
  return mod;
}

function serve(limiter) {
  const app = express();
  app.set('trust proxy', 1);
  // Always 401, so skipSuccessfulRequests cannot mask the count.
  app.post('/login', limiter, (req, res) => res.status(401).json({ success: false }));
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve({ server, port: server.address().port }));
  });
}

const post = (port) =>
  fetch(`http://127.0.0.1:${port}/login`, { method: 'POST' }).then((r) => r.status);

test('login limiter', async (t) => {
  const { loginLimiter } = loadLimiters({ nodeEnv: 'production' });
  const { server, port } = await serve(loginLimiter);
  t.after(() => server.close());

  await t.test('allows the first 10 failed attempts', async () => {
    for (let i = 1; i <= 10; i++) {
      assert.equal(await post(port), 401, `attempt ${i} should reach the handler`);
    }
  });

  await t.test('rejects the 11th with 429', async () => {
    assert.equal(await post(port), 429);
  });

  await t.test('the 429 body explains the wait', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/login`, { method: 'POST' });
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.message, /15 minutes/);
  });

  await t.test('sends a standard RateLimit header, not the legacy one', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/login`, { method: 'POST' });
    assert.ok(res.headers.get('ratelimit'), 'expected a draft-7 RateLimit header');
    assert.equal(res.headers.get('x-ratelimit-limit'), null, 'legacy headers should be off');
  });
});

test('signup limiter is stricter than login', async (t) => {
  const { signupLimiter } = loadLimiters({ nodeEnv: 'production' });
  const { server, port } = await serve(signupLimiter);
  t.after(() => server.close());

  for (let i = 1; i <= 5; i++) {
    assert.equal(await post(port), 401, `attempt ${i} should reach the handler`);
  }
  assert.equal(await post(port), 429, '6th signup should be throttled');
});

test('limiters stand down under NODE_ENV=test', async (t) => {
  const { loginLimiter } = loadLimiters({ nodeEnv: 'test' });
  const { server, port } = await serve(loginLimiter);
  t.after(() => server.close());

  for (let i = 1; i <= 25; i++) {
    assert.equal(await post(port), 401, `attempt ${i} must not be throttled in tests`);
  }
});
