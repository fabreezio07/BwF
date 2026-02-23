import pool from '../utils/database.js';

export async function saveMatchResults(matchId, winnerId, loserId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('UPDATE matches SET status = ?, winner_id = ? WHERE id = ?', ['completed', winnerId, matchId]);
    const prevWinner = await conn.query('SELECT IFNULL(SUM(score_change),0) as total FROM scores WHERE player_id = ?', [winnerId]);
    const prevLoser = await conn.query('SELECT IFNULL(SUM(score_change),0) as total FROM scores WHERE player_id = ?', [loserId]);
    const winnerTotal = (prevWinner && prevWinner[0] && prevWinner[0].total) ? prevWinner[0].total : 0;
    const loserTotal = (prevLoser && prevLoser[0] && prevLoser[0].total) ? prevLoser[0].total : 0;
    const wNew = winnerTotal + 10;
    const lNew = loserTotal - 5;
    await conn.query('INSERT INTO scores (match_id, player_id, score, score_change, created_at) VALUES (?, ?, ?, ?, NOW())', [matchId, winnerId, wNew, 10]);
    await conn.query('INSERT INTO scores (match_id, player_id, score, score_change, created_at) VALUES (?, ?, ?, ?, NOW())', [matchId, loserId, lNew, -5]);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
