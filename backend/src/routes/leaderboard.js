import express from 'express';
import pool from '../utils/database.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    // Basic leaderboard: sum score_change per player
    const rows = await conn.query(`
      SELECT u.id, u.username, IFNULL(SUM(s.score_change), 0) AS total_score
      FROM users u
      LEFT JOIN scores s ON u.id = s.player_id
      GROUP BY u.id
      ORDER BY total_score DESC
      LIMIT 100
    `);
    return res.json(rows.map(r => ({ id: r.id, username: r.username, totalScore: r.total_score })));
  } catch (err) {
    next(err);
  } finally {
    conn.release();
  }
});

export default router;
