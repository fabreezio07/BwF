import pool from '../utils/database.js';

export async function createUser(username, passwordHash) {
  const conn = await pool.getConnection();
  try {
    // check exists
    const exists = await conn.query('SELECT id FROM users WHERE username = ?', [username]);
    if (exists.length) {
      const err = new Error('User exists');
      err.code = 'USER_EXISTS';
      throw err;
    }

    const result = await conn.query('INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, NOW())', [username, passwordHash]);
    const id = result.insertId;
    return { id, username, createdAt: new Date().toISOString() };
  } finally {
    conn.release();
  }
}

export async function findByUsername(username) {
  const conn = await pool.getConnection();
  try {
    const rows = await conn.query('SELECT id, username, password_hash AS passwordHash, created_at AS createdAt FROM users WHERE username = ? LIMIT 1', [username]);
    if (!rows || rows.length === 0) return null;
    const r = rows[0];
    return { id: r.id, username: r.username, passwordHash: r.passwordHash, createdAt: r.createdAt };
  } finally {
    conn.release();
  }
}
