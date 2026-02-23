import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createUser, findByUsername } from '../models/user-model.js';
import { ValidationError, ConflictError } from '../utils/errors.js';

const router = express.Router();

router.post('/register', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || typeof username !== 'string' || username.length < 3) {
      throw new ValidationError('Invalid username', { field: 'username' });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      throw new ValidationError('Invalid password', { field: 'password' });
    }

    const hash = await bcrypt.hash(password, 10);
    try {
      const user = await createUser(username, hash);
      return res.status(201).json(user);
    } catch (err) {
      if (err && err.code === 'USER_EXISTS') {
        throw new ConflictError('Username already taken');
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      throw new ValidationError('Invalid credentials');
    }
    const user = await findByUsername(username);
    if (!user) {
      return next(new ValidationError('Invalid username or password'));
    }
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return next(new ValidationError('Invalid username or password'));

    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET || 'changeme', { expiresIn: '24h' });
    return res.json({ token, id: user.id, username: user.username });
  } catch (err) {
    next(err);
  }
});

export default router;
