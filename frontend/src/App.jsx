import { useEffect, useState } from 'react';

const API = import.meta.env.VITE_API_BASE_URL + '/api';
const BASE = import.meta.env.VITE_API_BASE_URL;

export default function App() {
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(null);
  const [toasts, setToasts] = useState([]);

  const pushToast = (message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => {
      setToasts(t => t.filter(x => x.id !== id));
    }, 3500);
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetch(`${BASE}/health`)
      .then(r => setOnline(r.ok))
      .catch(() => setOnline(false));
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const url = debouncedSearch
        ? `${API}/patients?search=${encodeURIComponent(debouncedSearch)}`
        : `${API}/patients`;
      const [p, a] = await Promise.all([
        fetch(url).then(r => r.json()),
        fetch(`${API}/appointments`).then(r => r.json()),
      ]);
      setPatients(p);
      setAppointments(a);
    } catch (e) {
      pushToast('Не удалось загрузить данные. Проверьте соединение.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [debouncedSearch]);

  const addPatient = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API}/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: name, phone }),
      });
      if (!res.ok) throw new Error();
      setName(''); setPhone('');
      pushToast('Пациент добавлен');
      load();
    } catch (e) {
      pushToast('Не удалось добавить пациента', 'error');
    }
  };

  const uploadPhoto = async (patientId, file) => {
    if (!file) return;
    const form = new FormData();
    form.append('photo', file);
    try {
      const res = await fetch(`${API}/patients/${patientId}/photo`, {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка загрузки');
      pushToast(`Файл ${data.filename} загружен`);
    } catch (e) {
      pushToast(e.message, 'error');
    }
  };

  const goTo = (id) => (e) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.history.replaceState(null, '', `#${id}`);
  };

  const cancelledCount = appointments.filter(a => a.status === 'cancelled').length;

  return (
    <div className="page">
      <header className="app-header">
        <div className="inner">
          <a href="/" className="brand" onClick={goTo('add')}>
            <span className="logo">М</span>
            МедУчёт
          </a>
          <nav className="nav">
            <a href="#add" onClick={goTo('add')}>Добавить</a>
            <a href="#patients" onClick={goTo('patients')}>Пациенты</a>
            <a href="#appointments" onClick={goTo('appointments')}>Записи</a>
          </nav>
          <div className="header-status">
            <span className={`status-dot ${online === false ? 'offline' : ''}`}></span>
            <span className="status-text">
              {online === null ? 'Проверка...' : online ? 'Сервер доступен' : 'Сервер недоступен'}
            </span>
          </div>
        </div>
      </header>

      <div className="page-content">
        <div className="dashboard">
          <div className="stat-card">
            <div className="label">Пациентов</div>
            <div className="value">{loading ? '…' : patients.length}</div>
          </div>
          <div className="stat-card">
            <div className="label">Записей</div>
            <div className="value">{loading ? '…' : appointments.length}</div>
          </div>
          <div className="stat-card">
            <div className="label">Отменено</div>
            <div className="value danger">{loading ? '…' : cancelledCount}</div>
          </div>
        </div>

        <section className="card" id="add">
          <h2>Добавить пациента</h2>
          <form onSubmit={addPatient} className="form-row">
            <div className="field">
              <label htmlFor="patient-name">ФИО</label>
              <input
                id="patient-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Иванов Иван Иванович"
                autoComplete="name"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="patient-phone">Телефон</label>
              <input
                id="patient-phone"
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+7 999 000-00-00"
                autoComplete="tel"
                inputMode="tel"
                required
              />
            </div>
            <button type="submit" className="btn-primary btn-block">Добавить</button>
          </form>
        </section>

        <section className="card" id="patients">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ margin: 0 }}>Пациенты</h2>
            <a href={`${API}/patients/export`} className="btn-ghost" style={{ padding: '8px 12px', textDecoration: 'none' }}>
              Экспорт в CSV
            </a>
          </div>

          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по ФИО или телефону..."
            style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 12 }}
          />

          {loading ? (
            <div>
              <div className="skeleton skeleton-row"></div>
              <div className="skeleton skeleton-row"></div>
              <div className="skeleton skeleton-row"></div>
            </div>
          ) : patients.length === 0 ? (
            <div className="empty-state">
              <div className="icon">👤</div>
              <div>Пока нет пациентов. Добавьте первого!</div>
            </div>
          ) : (
            <ul className="list">
              {patients.map(p => (
                <li key={p.id}>
                  <span>{p.full_name}</span>
                  <span className="meta" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {p.phone}
                    <label style={{ cursor: 'pointer', fontSize: '.8rem', color: '#2563eb' }}>
                      Фото
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={e => uploadPhoto(p.id, e.target.files[0])}
                      />
                    </label>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card" id="appointments">
          <h2>Записи на приём</h2>
          {loading ? (
            <div>
              <div className="skeleton skeleton-row"></div>
              <div className="skeleton skeleton-row"></div>
            </div>
          ) : appointments.length === 0 ? (
            <div className="empty-state">
              <div className="icon">📅</div>
              <div>Пока нет записей на приём.</div>
            </div>
          ) : (
            <ul className="list">
              {appointments.map(a => (
                <li key={a.id}>
                  <span>
                    {a.patient_name} → {a.doctor_name}
                    <div className="meta">
                      {new Date(a.appointment_time).toISOString().slice(0, 16).replace('T', ' ')}
                    </div>
                  </span>
                  <span className={`badge badge-${a.status || 'scheduled'}`}>
                    {a.status === 'cancelled' ? 'Отменена' : 'Запланирована'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <footer className="app-footer">
        <div className="inner">
          <div>
            <div className="footer-brand">МедУчёт</div>
            <div>© {new Date().getFullYear()} Учебный проект.</div>
          </div>
          <div className="footer-links">
            <a href="#add" onClick={goTo('add')}>Добавить</a>
            <a href="#patients" onClick={goTo('patients')}>Пациенты</a>
            <a href="#appointments" onClick={goTo('appointments')}>Записи</a>
            <a href={`${BASE}/health`} target="_blank" rel="noopener noreferrer">API</a>
          </div>
        </div>
      </footer>

      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type === 'error' ? 'error' : ''}`}>
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}