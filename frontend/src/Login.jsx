import { useState } from 'react';
import { setToken, setRole } from './api';

const BASE = import.meta.env.VITE_API_BASE_URL;

export default function Login({ onSuccess }) {
  const [email, setEmail] = useState('staff@example.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка входа');
      setToken(data.token);
      setRole(data.role);
      onSuccess(data.role);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="card" style={{ maxWidth: 420, margin: '80px auto' }}>
        <h2>Вход в МедУчёт</h2>
        <form onSubmit={submit} className="form-row" style={{ flexDirection: 'column' }}>
          <div className="field">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="login-password">Пароль</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <button type="submit" className="btn-primary btn-block" disabled={loading}>
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>
        {error && <div className="alert alert-error" style={{ marginTop: 12 }}>{error}</div>}
        <p style={{ fontSize: '.8rem', color: '#6b7280', marginTop: 16 }}>
          Тестовые аккаунты: <br />
          staff@example.com / staff123 <br />
          patient@example.com / patient123
        </p>
      </div>
    </div>
  );
}