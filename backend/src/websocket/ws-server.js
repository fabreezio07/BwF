import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import url from 'url';
import pool from '../utils/database.js';

// Game constants
const TICK_RATE = 60; // FPS
const SPEED = 2.0; // px per frame
const CANVAS = { width: 600, height: 800 };
const FIGURE_RADIUS = 20;
const WEAPON_LENGTH = 40;

// In-memory match state: matchId -> { players: Map(userId->ws), state }
const matches = new Map();

function randAngle() {
  return Math.random() * Math.PI * 2;
}

function normalizeVelocity(vx, vy) {
  const mag = Math.sqrt(vx * vx + vy * vy) || 1;
  const nx = (vx / mag) * SPEED;
  const ny = (vy / mag) * SPEED;
  return [nx, ny];
}

function createInitialState() {
  // Two players will be positioned opposite
  const p1 = { x: 100, y: 100, vx: 0, vy: 0, angle: 0 };
  const p2 = { x: CANVAS.width - 100, y: CANVAS.height - 100, vx: 0, vy: 0, angle: Math.PI };
  // give random velocities
  const a1 = randAngle();
  const a2 = randAngle();
  [p1.vx, p1.vy] = normalizeVelocity(Math.cos(a1), Math.sin(a1));
  [p2.vx, p2.vy] = normalizeVelocity(Math.cos(a2), Math.sin(a2));
  return { players: { }, p1, p2, running: false };
}

function stepPhysics(state) {
  // update positions
  [state.p1.x, state.p1.y] = [state.p1.x + state.p1.vx, state.p1.y + state.p1.vy];
  [state.p2.x, state.p2.y] = [state.p2.x + state.p2.vx, state.p2.y + state.p2.vy];

  // boundary collisions
  [[state.p1], [state.p2]].forEach((arr, idx) => {
    const p = arr[0];
    if (p.x - FIGURE_RADIUS < 0) { p.x = FIGURE_RADIUS; p.vx = Math.abs(p.vx); }
    if (p.x + FIGURE_RADIUS > CANVAS.width) { p.x = CANVAS.width - FIGURE_RADIUS; p.vx = -Math.abs(p.vx); }
    if (p.y - FIGURE_RADIUS < 0) { p.y = FIGURE_RADIUS; p.vy = Math.abs(p.vy); }
    if (p.y + FIGURE_RADIUS > CANVAS.height) { p.y = CANVAS.height - FIGURE_RADIUS; p.vy = -Math.abs(p.vy); }
    // normalize
    [p.vx, p.vy] = normalizeVelocity(p.vx, p.vy);
  });
}

function weaponEndpoint(px, py, angle) {
  return { x: px + Math.cos(angle) * WEAPON_LENGTH, y: py + Math.sin(angle) * WEAPON_LENGTH };
}

function checkWeaponHit(weaponOwner, target) {
  const end = weaponEndpoint(weaponOwner.x, weaponOwner.y, weaponOwner.angle);
  const dx = end.x - target.x;
  const dy = end.y - target.y;
  return Math.sqrt(dx * dx + dy * dy) <= FIGURE_RADIUS;
}

async function persistMatchResult(matchId, winnerId, loserId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('UPDATE matches SET status = ?, winner_id = ? WHERE id = ?', ['completed', winnerId, matchId]);
    // Simplified: Insert two score rows with score_change +10/-5 and set score equal to previous + change
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
    // eslint-disable-next-line no-console
    console.error('Failed to persist match result', err);
  } finally {
    conn.release();
  }
}

export function attachWebsocketServer(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const pathname = url.parse(request.url).pathname;
    if (pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', (ws, request) => {
    // authenticate via token query param
    const q = url.parse(request.url, true).query;
    const token = q.token;
    if (!token) {
      ws.close(4001, 'Auth required');
      return;
    }
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET || 'changeme');
    } catch (err) {
      ws.close(4002, 'Invalid token');
      return;
    }
    const userId = payload.id;
    ws.userId = userId;
    ws.isAlive = true;

    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', async (msg) => {
      try {
        const data = JSON.parse(msg.toString());
        const { event, payload } = data;
        if (event === 'match.join') {
          const matchId = Number(payload.matchId);
          if (!matches.has(matchId)) matches.set(matchId, { players: new Map(), state: createInitialState(), interval: null });
          const m = matches.get(matchId);
          m.players.set(userId, ws);
          // attach user's id to state players mapping (player1 or player2)
          // assign player slot
          if (!m.state.players.p1) m.state.players.p1 = userId;
          else if (!m.state.players.p2 && m.state.players.p1 !== userId) m.state.players.p2 = userId;

          ws.matchId = matchId;
          // notify joined
          ws.send(JSON.stringify({ event: 'match.joined', payload: { matchId } }));

          // if both present and not running, start countdown and game
          if (m.state.players.p1 && m.state.players.p2 && !m.state.running) {
            // find sockets
            const s1 = m.players.get(m.state.players.p1);
            const s2 = m.players.get(m.state.players.p2);
            // send game.start with countdown
            const startPayload = { countdown: [3,2,1], matchId };
            if (s1) s1.send(JSON.stringify({ event: 'game.start', payload: startPayload }));
            if (s2) s2.send(JSON.stringify({ event: 'game.start', payload: startPayload }));

            // initialize weapon angles to current angle
            m.state.p1.angle = 0;
            m.state.p2.angle = Math.PI;
            m.state.running = true;

            // start loop
            m.interval = setInterval(() => {
              stepPhysics(m.state);
              // check collisions: weapon of p1 vs p2
              const p1Owner = { x: m.state.p1.x, y: m.state.p1.y, angle: m.state.p1.angle };
              const p2Owner = { x: m.state.p2.x, y: m.state.p2.y, angle: m.state.p2.angle };
              let ended = false;
              if (checkWeaponHit(p1Owner, m.state.p2)) {
                // p1 wins
                ended = true;
                // broadcast game.end
                const s1socket = m.players.get(m.state.players.p1);
                const s2socket = m.players.get(m.state.players.p2);
                if (s1socket) s1socket.send(JSON.stringify({ event: 'game.end', payload: { winnerId: m.state.players.p1 } }));
                if (s2socket) s2socket.send(JSON.stringify({ event: 'game.end', payload: { winnerId: m.state.players.p1 } }));
                // persist
                persistMatchResult(matchId, m.state.players.p1, m.state.players.p2);
              } else if (checkWeaponHit(p2Owner, m.state.p1)) {
                ended = true;
                const s1socket = m.players.get(m.state.players.p1);
                const s2socket = m.players.get(m.state.players.p2);
                if (s1socket) s1socket.send(JSON.stringify({ event: 'game.end', payload: { winnerId: m.state.players.p2 } }));
                if (s2socket) s2socket.send(JSON.stringify({ event: 'game.end', payload: { winnerId: m.state.players.p2 } }));
                persistMatchResult(matchId, m.state.players.p2, m.state.players.p1);
              }

              // broadcast game.update
              const update = {
                p1: { x: m.state.p1.x, y: m.state.p1.y, angle: m.state.p1.angle },
                p2: { x: m.state.p2.x, y: m.state.p2.y, angle: m.state.p2.angle }
              };
              m.players.forEach((sock) => {
                try { sock.send(JSON.stringify({ event: 'game.update', payload: update })); } catch {}
              });

              if (ended) {
                clearInterval(m.interval);
                m.state.running = false;
                // mark match cleaned up after short delay
                setTimeout(() => { matches.delete(matchId); }, 2000);
              }
            }, 1000 / TICK_RATE);
          }
        } else if (event === 'player.weapon.rotate') {
          const matchId = ws.matchId;
          if (!matchId) return;
          const m = matches.get(matchId);
          if (!m) return;
          // determine which player this is
          if (m.state.players.p1 === userId) {
            if (payload.direction === 'left') m.state.p1.angle -= Math.PI / 4;
            else m.state.p1.angle += Math.PI / 4;
          } else if (m.state.players.p2 === userId) {
            if (payload.direction === 'left') m.state.p2.angle -= Math.PI / 4;
            else m.state.p2.angle += Math.PI / 4;
          }
        } else if (event === 'system.heartbeat.ack') {
          ws.isAlive = true;
        }
      } catch (err) {
        // ignore malformed
      }
    });

    ws.on('close', () => {
      // remove from matches
      const matchId = ws.matchId;
      if (matchId && matches.has(matchId)) {
        const m = matches.get(matchId);
        m.players.delete(userId);
        // if a player disconnected during running match, cancel match
        if (m.state.running) {
          m.players.forEach((s) => s.send(JSON.stringify({ event: 'match.cancelled', payload: {} }))); 
          clearInterval(m.interval);
          matches.delete(matchId);
        }
      }
    });
  });

  // heartbeat
  setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      try { ws.ping(); } catch { }
    });
  }, 30000);
}
