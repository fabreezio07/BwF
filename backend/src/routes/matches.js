import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import pool from '../utils/database.js';
import { NotFoundError, ValidationError, ConflictError } from '../utils/errors.js';

const router = express.Router();

// POST /api/matches/invite
router.post('/invite', requireAuth, async (req, res, next) => {
  const { username } = req.body || {};
  if (!username) return next(new ValidationError('username is required', { field: 'username' }));
  if (username === req.user.username) return next(new ValidationError('Cannot invite yourself'));

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const users = await conn.query('SELECT id, username FROM users WHERE username = ? LIMIT 1', [username]);
    if (!users || users.length === 0) throw new NotFoundError('User not found');
    const invitee = users[0];

    // check existing pending
    const existing = await conn.query('SELECT id FROM invitations WHERE inviter_id = ? AND invitee_id = ? AND status = ? LIMIT 1', [req.user.id, invitee.id, 'pending']);
    if (existing && existing.length) throw new ConflictError('Pending invitation already exists');

    const expiresAtQuery = "DATE_ADD(NOW(), INTERVAL 3 MINUTE)";
    const result = await conn.query(`INSERT INTO invitations (inviter_id, invitee_id, status, expires_at, created_at) VALUES (?, ?, ?, ${expiresAtQuery}, NOW())`, [req.user.id, invitee.id, 'pending']);
    await conn.commit();
    const id = result.insertId;
    return res.status(201).json({ id, inviterId: req.user.id, inviteeId: invitee.id, status: 'pending', expiresAt: new Date(Date.now() + 3 * 60 * 1000).toISOString(), createdAt: new Date().toISOString() });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// GET /api/matches/invites/active
router.get('/invites/active', requireAuth, async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    // expire old
    await conn.query("UPDATE invitations SET status = 'expired' WHERE status = 'pending' AND expires_at < NOW()");
    const rows = await conn.query('SELECT i.id, i.inviter_id AS inviterId, i.invitee_id AS inviteeId, i.status, i.expires_at AS expiresAt, i.created_at AS createdAt, u.username AS inviterUsername FROM invitations i JOIN users u ON i.inviter_id = u.id WHERE i.invitee_id = ? AND i.status = ? ORDER BY i.created_at DESC', [req.user.id, 'pending']);
    const mapped = rows.map(r => ({ id: r.id, inviterId: r.inviterId, inviteeId: r.inviteeId, status: r.status, expiresAt: r.expiresAt, createdAt: r.createdAt, inviterUsername: r.inviterUsername }));
    return res.json(mapped);
  } catch (err) {
    next(err);
  } finally {
    conn.release();
  }
});

// POST /api/matches/invites/:id/accept
router.post('/invites/:id/accept', requireAuth, async (req, res, next) => {
  const id = Number(req.params.id);
  if (!id) return next(new ValidationError('Invalid invitation id'));
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // expire old
    await conn.query("UPDATE invitations SET status = 'expired' WHERE status = 'pending' AND expires_at < NOW()");
    const inv = await conn.query('SELECT * FROM invitations WHERE id = ? LIMIT 1', [id]);
    if (!inv || inv.length === 0) throw new NotFoundError('Invitation not found');
    const invitation = inv[0];
    if (invitation.invitee_id !== req.user.id) throw new ValidationError('Not authorized to accept this invitation');
    if (invitation.status !== 'pending') throw new ConflictError('Invitation not pending');

    // create match
    const matchRes = await conn.query('INSERT INTO matches (player1_id, player2_id, status, created_at) VALUES (?, ?, ?, NOW())', [invitation.inviter_id, invitation.invitee_id, 'pending']);
    await conn.query('UPDATE invitations SET status = ? WHERE id = ?', ['accepted', id]);
    await conn.commit();
    const matchId = matchRes.insertId;
    return res.json({ id: matchId, player1Id: invitation.inviter_id, player2Id: invitation.invitee_id, status: 'pending', createdAt: new Date().toISOString() });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

// GET /api/matches/active - for user
router.get('/active', requireAuth, async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const rows = await conn.query("SELECT * FROM matches WHERE (player1_id = ? OR player2_id = ?) AND status = 'active'", [req.user.id, req.user.id]);
    return res.json(rows.map(r => ({ id: r.id, player1Id: r.player1_id, player2Id: r.player2_id, status: r.status, activatedAt: r.activated_at, createdAt: r.created_at })));
  } catch (err) {
    next(err);
  } finally {
    conn.release();
  }
});

// POST /api/matches/:id/forfeit
router.post('/:id/forfeit', requireAuth, async (req, res, next) => {
  const id = Number(req.params.id);
  if (!id) return next(new ValidationError('Invalid match id'));
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const rows = await conn.query('SELECT * FROM matches WHERE id = ? LIMIT 1', [id]);
    if (!rows || rows.length === 0) throw new NotFoundError('Match not found');
    const match = rows[0];
    if (match.status !== 'active' && match.status !== 'pending') throw new ValidationError('Cannot forfeit match in current state');
    // if pending, treat as cancelled; if active, set winner to other player
    if (match.status === 'pending') {
      await conn.query("UPDATE matches SET status = 'cancelled' WHERE id = ?", [id]);
      await conn.commit();
      return res.json({ id, status: 'cancelled' });
    }
    const winnerId = match.player1_id === req.user.id ? match.player2_id : match.player1_id;
    await conn.query('UPDATE matches SET status = ?, winner_id = ?, activated_at = activated_at WHERE id = ?', ['completed', winnerId, id]);
    // Note: score saving handled elsewhere (game loop / victory handler)
    await conn.commit();
    return res.json({ id, status: 'completed', winnerId });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

export default router;
