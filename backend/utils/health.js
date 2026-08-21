/**
 * Pure so the route wiring stays a one-liner and the status logic is
 * testable without a live MongoDB connection or an HTTP round trip.
 *
 * readyState comes from mongoose.connection.readyState: 1 is the only
 * "connected" value — 0 disconnected, 2 connecting, 3 disconnecting all mean
 * the app cannot actually serve a DB-backed request right now.
 */
function buildHealthPayload(readyState) {
  const dbConnected = readyState === 1;
  return {
    statusCode: dbConnected ? 200 : 503,
    payload: {
      success: dbConnected,
      db: dbConnected ? 'connected' : 'disconnected',
      uptime: process.uptime(),
    },
  };
}

module.exports = { buildHealthPayload };
