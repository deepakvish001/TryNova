const { rateLimit } = require('express-rate-limit');

/**
 * Throttles for the credential endpoints.
 *
 * Without these, /api/auth/login accepts unlimited password attempts. The
 * validation added earlier stops a body with no email from testing a guess
 * against an arbitrary account, but a caller who names an address can still
 * try passwords as fast as the network allows.
 *
 * Disabled under NODE_ENV=test so the suite can exercise the same endpoint
 * repeatedly without tripping a limit that is not what those tests assert.
 */
const isTest = process.env.NODE_ENV === 'test';

const message = (retryAfterText) => ({
  success: false,
  message: `Too many attempts. Try again in ${retryAfterText}.`,
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => isTest,
  // Failed attempts are what matter; a user who signs in correctly several
  // times from one office IP should not be locked out.
  skipSuccessfulRequests: true,
  message: message('15 minutes'),
});

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => isTest,
  message: message('an hour'),
});

module.exports = { loginLimiter, signupLimiter };
