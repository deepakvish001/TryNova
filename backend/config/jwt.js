/**
 * Single source of truth for the JWT signing secret.
 *
 * Previously three call sites each did:
 *   process.env.JWT_SECRET || 'trynova_super_secret_jwt_key_2026'
 *
 * That fallback is a literal published in this repository, so a deployment
 * that forgot to set JWT_SECRET would happily sign and verify tokens with a
 * secret anyone can read — letting anyone mint a valid token for any user id.
 * Fail loudly at startup instead.
 */
const secret = process.env.JWT_SECRET;

if (!secret) {
  throw new Error(
    'JWT_SECRET is not set. Generate one with `openssl rand -hex 32` and put it in backend/.env — ' +
      'the server will not start without it.',
  );
}

module.exports = { JWT_SECRET: secret };
