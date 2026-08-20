/**
 * Auth body validation.
 *
 * Before these guards a body missing `password` reached bcrypt, which throws
 * "data and salt arguments required" — the controller's catch-all returned
 * that as a 500 with the raw message attached. These cases pin the 400s.
 */
process.env.JWT_SECRET = 'test-secret-not-used-anywhere-real';

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { validateSignup, validateLogin } = require('../middleware/validate');

function startServer() {
  const app = express();
  app.use(express.json());
  // Echo the (possibly normalised) body so the tests can assert on it.
  app.post('/signup', validateSignup, (req, res) => res.json({ ok: true, body: req.body }));
  app.post('/login', validateLogin, (req, res) => res.json({ ok: true, body: req.body }));
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve({ server, port: server.address().port }));
  });
}

const post = (port, path, body) =>
  fetch(`http://127.0.0.1:${port}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

test('signup validation', async (t) => {
  const { server, port } = await startServer();
  t.after(() => server.close());

  const cases = [
    ['empty body', {}, 'Name is required'],
    ['missing name', { email: 'a@b.co', password: 'longenough' }, 'Name is required'],
    ['blank name', { name: '   ', email: 'a@b.co', password: 'longenough' }, 'Name is required'],
    ['missing email', { name: 'A', password: 'longenough' }, 'Email is required'],
    ['malformed email', { name: 'A', email: 'not-an-email', password: 'longenough' }, 'Email is not valid'],
    ['missing password', { name: 'A', email: 'a@b.co' }, 'Password is required'],
    ['non-string password', { name: 'A', email: 'a@b.co', password: 12345678 }, 'Password is required'],
    ['short password', { name: 'A', email: 'a@b.co', password: 'short' }, 'Password must be at least 8 characters'],
  ];

  for (const [label, body, message] of cases) {
    await t.test(`rejects ${label}`, async () => {
      const res = await post(port, '/signup', body);
      assert.equal(res.status, 400);
      assert.equal((await res.json()).message, message);
    });
  }

  await t.test('accepts a valid body and normalises name and email', async () => {
    const res = await post(port, '/signup', {
      name: '  Deepak  ',
      email: '  Foo@Example.COM ',
      password: 'longenough',
    });
    assert.equal(res.status, 200);
    const { body } = await res.json();
    assert.equal(body.name, 'Deepak');
    // Lower-cased so it cannot slip past the schema's case-sensitive unique index.
    assert.equal(body.email, 'foo@example.com');
  });
});

test('login validation', async (t) => {
  const { server, port } = await startServer();
  t.after(() => server.close());

  await t.test('rejects a missing email', async () => {
    const res = await post(port, '/login', { password: 'x' });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).message, 'Email is required');
  });

  await t.test('rejects a missing password', async () => {
    const res = await post(port, '/login', { email: 'a@b.co' });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).message, 'Password is required');
  });

  await t.test('lower-cases the email so login matches the stored record', async () => {
    const res = await post(port, '/login', { email: 'Foo@Example.COM', password: 'x' });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).body.email, 'foo@example.com');
  });

  await t.test('does not enforce a length rule on login', async () => {
    // An existing account may predate the signup minimum; login must still
    // let them through to the password check.
    const res = await post(port, '/login', { email: 'a@b.co', password: 'old' });
    assert.equal(res.status, 200);
  });
});
