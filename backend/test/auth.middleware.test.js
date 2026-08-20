/**
 * Regression tests for the Bearer-token guard.
 *
 * The header-parsing cases below are the ones that used to send two responses
 * and raise ERR_HTTP_HEADERS_SENT, so an unauthenticated request could take
 * down any protected route. Keep them.
 *
 * Uses node:test and the built-in fetch — no extra dependencies.
 */
process.env.JWT_SECRET = 'test-secret-not-used-anywhere-real';

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { protect } = require('../middleware/auth.middleware');

function startServer() {
  const app = express();
  app.get('/protected', protect, (req, res) => res.json({ ok: true, user: req.user }));
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve({ server, port: server.address().port }));
  });
}

async function request(port, headers) {
  return fetch(`http://127.0.0.1:${port}/protected`, { headers });
}

test('auth middleware', async (t) => {
  const { server, port } = await startServer();
  t.after(() => server.close());

  await t.test('rejects a request with no Authorization header', async () => {
    const res = await request(port, {});
    assert.equal(res.status, 401);
    assert.equal((await res.json()).message, 'Not authorized, no token');
  });

  await t.test('rejects "Bearer" with no credential without crashing', async () => {
    const res = await request(port, { Authorization: 'Bearer' });
    assert.equal(res.status, 401);
  });

  await t.test('rejects "Bearer " with only trailing whitespace', async () => {
    const res = await request(port, { Authorization: 'Bearer ' });
    assert.equal(res.status, 401);
  });

  await t.test('rejects a scheme that merely starts with Bearer', async () => {
    const res = await request(port, { Authorization: 'BearerX some.token.here' });
    assert.equal(res.status, 401);
  });

  await t.test('rejects a malformed token', async () => {
    const res = await request(port, { Authorization: 'Bearer abc.def.ghi' });
    assert.equal(res.status, 401);
    assert.equal((await res.json()).message, 'Not authorized, token failed');
  });

  await t.test('rejects a token signed with a different secret', async () => {
    const forged = jwt.sign({ id: 'attacker' }, 'some-other-secret');
    const res = await request(port, { Authorization: `Bearer ${forged}` });
    assert.equal(res.status, 401);
  });

  await t.test('rejects an expired token', async () => {
    const expired = jwt.sign({ id: 'u1' }, process.env.JWT_SECRET, { expiresIn: -10 });
    const res = await request(port, { Authorization: `Bearer ${expired}` });
    assert.equal(res.status, 401);
  });

  await t.test('accepts a valid token and exposes the payload on req.user', async () => {
    const good = jwt.sign({ id: 'user-123' }, process.env.JWT_SECRET);
    const res = await request(port, { Authorization: `Bearer ${good}` });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.user.id, 'user-123');
  });
});
