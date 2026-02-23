import { ValidationError, ConflictError, NotFoundError, AuthenticationError } from '../utils/errors.js';

export function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err instanceof ValidationError || err instanceof ConflictError || err instanceof NotFoundError || err instanceof AuthenticationError) {
    return res.status(err.status).json({ error: err.toJSON() });
  }

  // unexpected error
  // eslint-disable-next-line no-console
  console.error(err);
  return res.status(500).json({ error: { message: 'Internal Server Error', code: 'INTERNAL', status: 500 } });
}
