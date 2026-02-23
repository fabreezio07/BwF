const apiBase = '/api/auth';

async function postJson(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw data;
  return data;
}

export async function register(username, password) {
  return postJson(apiBase + '/register', { username, password });
}

export async function login(username, password) {
  return postJson(apiBase + '/login', { username, password });
}

// wire up simple forms
if (typeof document !== 'undefined') {
  const regForm = document.getElementById('register-form');
  const loginForm = document.getElementById('login-form');

  if (regForm) regForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('reg-username').value;
    const password = document.getElementById('reg-password').value;
    try {
      const user = await register(username, password);
      alert('Registered: ' + user.username);
    } catch (err) {
      alert('Register error: ' + (err?.error?.message || JSON.stringify(err)));
    }
  });

  if (loginForm) loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    try {
      const data = await login(username, password);
      localStorage.setItem('bwf_token', data.token);
      alert('Logged in as ' + data.username);
    } catch (err) {
      alert('Login error: ' + (err?.error?.message || JSON.stringify(err)));
    }
  });
}
