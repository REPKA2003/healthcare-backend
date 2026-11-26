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
  const [error, setError] = useState('');
  const [uploadMsg, setUploadMsg] = useState('');
  const [online, setOnline] = useState(null);

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
    setError('');
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
      setError('Не удалось загрузить данные. Проверьте соединение.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [debouncedSearch]);

  const addPatient = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(`${API}/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: name, phone }),
      });
      if (!res.ok) throw new Error('Ошибка сохранения');
      setName(''); setPhone('');
      load();
    } catch (e) {
      setError('Не удалось добавить пациента.');
    }
  };

  const uploadPhoto = async (patientId, file) => {
    if (!file) return;
    setUploadMsg('');
    const form = new FormData();
    form.append('photo', file);
    try {
      const res = await fetch(`${API}/patients/${patientId}/photo`, {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка загрузки');
      setUploadMsg(`Файл ${data.filename} (${data.size} байт) загружен`);
    } catch (e) {
      setUploadMsg(e.message);
    }
  };

  const goTo = (id) => (e) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.history.replaceState(null, '', `#${id}`);
  };

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
            {online === null ? 'Проверка...' : online ? 'Сервер доступен' : 'Сервер недоступен'}
          </div>
        </div>
      </header>

      <div className="page-content">
        {error && <div className="alert alert-error">{error}</div>}
        {uploadMsg && <div className="alert" style={{ background: '#ecfdf5', color: '#059669' }}>{uploadMsg}</div>}

        <section className="card" id="add">
          <h2>Добавить пациента</h2>
          <form onSubmit={addPatient} className="form-row">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="ФИО" required />
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Телефон" required />
            <button type="submit" className="btn-primary">Добавить</button>
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
            <div className="loading">Загрузка...</div>
          ) : patients.length === 0 ? (
            <div className="empty">Пока нет пациентов</div>
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
            <div className="loading">Загрузка...</div>
          ) : appointments.length === 0 ? (
            <div className="empty">Пока нет записей</div>
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
            <div>© {new Date().getFullYear()} Учебный проект. Все права защищены.</div>
          </div>
          <div className="footer-links">
            <a href="#add" onClick={goTo('add')}>Добавить</a>
            <a href="#patients" onClick={goTo('patients')}>Пациенты</a>
            <a href="#appointments" onClick={goTo('appointments')}>Записи</a>
            <a href={`${BASE}/health`} target="_blank" rel="noopener noreferrer">API</a>
          </div>
        </div>
      </footer>
    </div>
  );
}