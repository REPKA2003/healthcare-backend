let token = localStorage.getItem('token') || '';

export function setToken(t) {
  token = t;
  if (t) localStorage.setItem('token', t);
  else localStorage.removeItem('token');
}

export function getToken() { return token; }

export function getRole() { return localStorage.getItem('role') || ''; }

export function setRole(r) {
  if (r) localStorage.setItem('role', r);
  else localStorage.removeItem('role');
}

export function clearAuth() {
  setToken('');
  setRole('');
}