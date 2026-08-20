/**
 * Request-body validation for the auth routes.
 *
 * Without these, a body missing `password` reached bcrypt, which throws
 * "data and salt arguments required". The controller's catch-all turned that
 * into a 500 carrying the raw bcrypt message — a malformed request answered
 * as a server fault, with internals attached.
 */

// Deliberately permissive: enough to reject obvious garbage without
// rejecting addresses that are legal but unusual.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MIN_PASSWORD_LENGTH = 8;

const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;

const fail = (res, message) => res.status(400).json({ success: false, message });

const validateSignup = (req, res, next) => {
  const { name, email, password } = req.body ?? {};

  if (!isNonEmptyString(name)) return fail(res, 'Name is required');
  if (!isNonEmptyString(email)) return fail(res, 'Email is required');
  if (!EMAIL.test(email.trim())) return fail(res, 'Email is not valid');
  if (typeof password !== 'string') return fail(res, 'Password is required');
  if (password.length < MIN_PASSWORD_LENGTH) {
    return fail(res, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  // Normalise so Foo@Example.com and foo@example.com cannot become two
  // accounts — the schema's unique index is case-sensitive.
  req.body.name = name.trim();
  req.body.email = email.trim().toLowerCase();
  return next();
};

const validateLogin = (req, res, next) => {
  const { email, password } = req.body ?? {};

  if (!isNonEmptyString(email)) return fail(res, 'Email is required');
  if (!isNonEmptyString(password)) return fail(res, 'Password is required');

  req.body.email = email.trim().toLowerCase();
  return next();
};

module.exports = { validateSignup, validateLogin, MIN_PASSWORD_LENGTH };
