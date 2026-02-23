import jwt from 'jsonwebtoken';
import { AuthenticationError } from '../utils/errors.js';

export function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    throw new AuthenticationError('Authentication required');
  }
  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'changeme');
    req.user = { id: payload.id, username: payload.username };
    next();
  } catch (err) {
    throw new AuthenticationError('Invalid or expired token');
  }
}
