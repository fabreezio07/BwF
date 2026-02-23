import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import http from 'http';
import authRoutes from './routes/auth.js';
import matchesRoutes from './routes/matches.js';
import leaderboardRoutes from './routes/leaderboard.js';
import { errorHandler } from './middleware/error-handler.js';
import { attachWebsocketServer } from './websocket/ws-server.js';

dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });

const app = express();
app.use(express.json());

// Serve frontend static files from repo-level `frontend/` when available
const frontendDir = path.resolve(process.cwd(), '../frontend');
const frontendDirAlt = path.resolve(process.cwd(), 'frontend');
const staticDir = fs.existsSync(frontendDir) ? frontendDir : frontendDirAlt;
app.use(express.static(staticDir));

app.use('/api/auth', authRoutes);
app.use('/api/matches', matchesRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

app.get('/', (req, res) => res.json({ status: 'ok' }));

// error handler (catch-all)
app.use(errorHandler);

const port = process.env.PORT || 3000;
const server = http.createServer(app);

// Attach WebSocket server (handles /ws)
attachWebsocketServer(server);

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Battle With Friend backend listening on port ${port}`);
});
