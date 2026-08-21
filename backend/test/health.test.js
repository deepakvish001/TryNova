/**
 * buildHealthPayload is pure, so the status-code logic is tested directly
 * without a live MongoDB connection. The second block confirms the route
 * actually wires that function to the HTTP response, following the pattern
 * in rateLimit.test.js — a minimal express app on an ephemeral port, hit
 * with fetch.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const { buildHealthPayload } = require('../utils/health');

test('buildHealthPayload', async (t) => {
  await t.test('readyState 1 (connected) -> 200, success: true', () => {
    const { statusCode, payload } = buildHealthPayload(1);
    assert.equal(statusCode, 200);
    assert.equal(payload.success, true);
    assert.equal(payload.db, 'connected');
  });

  for (const readyState of [0, 2, 3]) {
    await t.test(`readyState ${readyState} -> 503, success: false`, () => {
      const { statusCode, payload } = buildHealthPayload(readyState);
      assert.equal(statusCode, 503);
      assert.equal(payload.success, false);
      assert.equal(payload.db, 'disconnected');
    });
  }

  await t.test('uptime is a non-negative number', () => {
    const { payload } = buildHealthPayload(1);
    assert.equal(typeof payload.uptime, 'number');
    assert.ok(payload.uptime >= 0);
  });
});

function serve(readyState) {
  const app = express();
  app.get('/api/health', (req, res) => {
    const { statusCode, payload } = buildHealthPayload(readyState);
    res.status(statusCode).json(payload);
  });
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve({ server, port: server.address().port }));
  });
}

test('GET /api/health', async (t) => {
  await t.test('200 with JSON body when the DB is connected', async () => {
    const { server, port } = await serve(1);
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`);
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('content-type').includes('application/json'), true);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.db, 'connected');
    } finally {
      server.close();
    }
  });

  await t.test('503 when the DB is not connected', async () => {
    const { server, port } = await serve(0);
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`);
      assert.equal(res.status, 503);
      const body = await res.json();
      assert.equal(body.success, false);
      assert.equal(body.db, 'disconnected');
    } finally {
      server.close();
    }
  });
});
