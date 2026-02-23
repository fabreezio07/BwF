const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const matchInput = document.getElementById('match-id');
const connectBtn = document.getElementById('connect');

let ws;
let myId = null;
let state = null;

function draw() {
  if (!state) {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = '#222'; ctx.fillRect(0,0,canvas.width,canvas.height);
    return;
  }
  ctx.clearRect(0,0,canvas.width,canvas.height);
  // draw p1
  ctx.fillStyle = '#ff4444';
  ctx.beginPath(); ctx.arc(state.p1.x, state.p1.y, 20, 0, Math.PI*2); ctx.fill();
  // weapon
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(state.p1.x, state.p1.y); ctx.lineTo(state.p1.x + Math.cos(state.p1.angle)*40, state.p1.y + Math.sin(state.p1.angle)*40); ctx.stroke();

  // draw p2
  ctx.fillStyle = '#4488ff';
  ctx.beginPath(); ctx.arc(state.p2.x, state.p2.y, 20, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(state.p2.x, state.p2.y); ctx.lineTo(state.p2.x + Math.cos(state.p2.angle)*40, state.p2.y + Math.sin(state.p2.angle)*40); ctx.stroke();
}

function setupControls() {
  window.addEventListener('keydown', (e) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (e.key === 'ArrowLeft') {
      ws.send(JSON.stringify({ event: 'player.weapon.rotate', payload: { direction: 'left' } }));
    } else if (e.key === 'ArrowRight') {
      ws.send(JSON.stringify({ event: 'player.weapon.rotate', payload: { direction: 'right' } }));
    }
  });
}

function connect(matchId) {
  const token = localStorage.getItem('bwf_token');
  if (!token) { alert('Please login first (use / index.html)'); return; }
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}/ws?token=${token}`);
  ws.addEventListener('open', () => {
    ws.send(JSON.stringify({ event: 'match.join', payload: { matchId } }));
  });
  ws.addEventListener('message', (m) => {
    try {
      const msg = JSON.parse(m.data);
      if (msg.event === 'match.joined') {
        console.log('joined', msg.payload);
      } else if (msg.event === 'game.start') {
        console.log('game.start', msg.payload);
      } else if (msg.event === 'game.update') {
        state = msg.payload;
        draw();
      } else if (msg.event === 'game.end') {
        alert('Game ended. Winner: ' + msg.payload.winnerId);
      } else if (msg.event === 'match.cancelled') {
        alert('Match cancelled');
      }
    } catch (err) {}
  });
  ws.addEventListener('close', () => { console.log('ws closed'); });
}

connectBtn.addEventListener('click', () => {
  const mid = Number(matchInput.value);
  if (!mid) { alert('Enter numeric match id'); return; }
  connect(mid);
});

setupControls();
draw();
