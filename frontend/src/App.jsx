import { useEffect, useState } from 'react';
import Login from './Login';
import { getToken, getRole, clearAuth } from './api';

const API = import.meta.env.VITE_API_BASE_URL + '/api';
const BASE = import.meta.env.VITE_API_BASE_URL;

function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function App() {
  const [authed, setAuthed] = useState(!!getToken());
  const [role, setRoleState] = useState(getRole());
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(null);
  const [toasts, setToasts] = useState([]);

  // запись на приём
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [myPatientId, setMyPatientId] = useState(null);

  const pushToast = (message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
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
        fetch(url, { headers: authHeaders() }).then(r => r.json()),
        fetch(`${API}/appointments`, { headers: authHeaders() }).then(r => r.json()),
      ]);
      setPatients(Array.isArray(p) ? p : []);
      setAppointments(Array.isArray(a) ? a : []);
    } catch (e) {
      pushToast('Не удалось загрузить данные', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (authed) load(); }, [debouncedSearch, authed]);

  // врачи
  useEffect(() => {
    if (!authed) return;
    fetch(`${API}/doctors`, { headers: authHeaders() })
      .then(r => r.json())
      .then(setDoctors)
      .catch(() => {});
  }, [authed]);

  // слоты при выборе врача
  useEffect(() => {
    if (!selectedDoctor) return;
    fetch(`${API}/doctors/${encodeURIComponent(selectedDoctor)}/slots`, { headers: authHeaders() })
      .then(r => r.json())
      .then(setSlots)
      .catch(() => setSlots([]));
  }, [selectedDoctor]);

  // свой patient_id для пациента
  useEffect(() => {
    if (role === 'patient' && patients.length > 0) {
      setMyPatientId(patients[0].id);
    }
  }, [patients, role]);

  const addPatient = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API}/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ full_name: name, phone }),
      });
      if (!res.ok) throw new Error();
      setName(''); setPhone('');
      pushToast('Пациент добавлен');
      load();
    } catch {
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
        headers: authHeaders(),
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка загрузки');
      pushToast(`Файл ${data.filename} загружен`);
    } catch (e) {
      pushToast(e.message, 'error');
    }
  };

  const bookAppointment = async (e) => {
    e.preventDefault();
    if (!selectedDoctor || !selectedSlot || !myPatientId) return;
    try {
      const res = await fetch(`${API}/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          patient_id: myPatientId,
          doctor_name: selectedDoctor,
          appointment_time: selectedSlot,
          reason: 'Самостоятельная запись',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка записи');
      pushToast('Запись создана');
      setSelectedSlot('');
      load();
    } catch (e) {
      pushToast(e.message, 'error');
    }
  };

  const cancelAppointment = async (id) => {
    try {
      const res = await fetch(`${API}/appointments/${id}/cancel`, {
        method: 'PATCH',
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error();
      pushToast('Запись отменена');
      load();
    } catch {
      pushToast('Не удалось отменить', 'error');
    }
  };

  const exportCsv = async () => {
    try {
      const res = await fetch(`${API}/patients/export`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'patients.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      pushToast('CSV скачан');
    } catch {
      pushToast('Не удалось скачать CSV', 'error');
    }
  };

  const logout = () => {
    clearAuth();
    setAuthed(false);
    setRoleState('');
    setPatients([]);
    setAppointments([]);
  };

  const goTo = (id) => (e) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.history.replaceState(null, '', `#${id}`);
  };

  if (!authed) {
    return <Login onSuccess={(r) => { setAuthed(true); setRoleState(r); }} />;
  }

  const cancelledCount = appointments.filter(a => a.status === 'cancelled').length;
  const isStaff = role === 'staff';

  return (
    <div className="page">
      <header className="app-header">
        <div className="inner">
          <a href="/" className="brand" onClick={goTo('add')}>
            <span className="logo">М</span>
            МедУчёт
          </a>
          <nav className="nav">
            {isStaff && <a href="#add" onClick={goTo('add')}>Добавить</a>}
            {!isStaff && <a href="#book" onClick={goTo('book')}>Записаться</a>}
            <a href="#patients" onClick={goTo('patients')}>Пациенты</a>
            <a href="#appointments" onClick={goTo('appointments')}>Записи</a>
          </nav>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div className="header-status">
              <span className={`status-dot ${online === false ? 'offline' : ''}`}></span>
              <span className="status-text">{role === 'staff' ? 'Сотрудник' : 'Пациент'}</span>
            </div>
            <button className="btn-ghost" onClick={logout}>Выйти</button>
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

        {isStaff && (
          <section className="card" id="add">
            <h2>Добавить пациента</h2>
            <form onSubmit={addPatient} className="form-row">
              <div className="field">
                <label htmlFor="patient-name">ФИО</label>
                <input id="patient-name" value={name} onChange={e => setName(e.target.value)} placeholder="Иванов Иван" required />
              </div>
              <div className="field">
                <label htmlFor="patient-phone">Телефон</label>
                <input id="patient-phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+7 999 000-00-00" required />
              </div>
              <button type="submit" className="btn-primary btn-block">Добавить</button>
            </form>
          </section>
        )}

        {!isStaff && (
          <section className="card" id="book">
            <h2>Записаться на приём</h2>
            <form onSubmit={bookAppointment} className="form-row" style={{ flexDirection: 'column' }}>
              <div className="field">
                <label>Врач</label>
                <select
                  value={selectedDoctor}
                  onChange={e => { setSelectedDoctor(e.target.value); setSelectedSlot(''); }}
                  required
                >
                  <option value="">Выберите врача</option>
                  {doctors.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Свободное время</label>
                <select
                  value={selectedSlot}
                  onChange={e => setSelectedSlot(e.target.value)}
                  required
                  disabled={!slots.length}
                >
                  <option value="">{slots.length ? 'Выберите время' : 'Нет свободных слотов'}</option>
                  {slots.map(s => (
                    <option key={s} value={s}>{s.replace('T', ' ').slice(0, 16)}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn-primary btn-block" disabled={!myPatientId}>
                {myPatientId ? 'Записаться' : 'Нет привязанной карточки пациента'}
              </button>
            </form>
          </section>
        )}

        <section className="card" id="patients">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <h2 style={{ margin: 0 }}>Пациенты</h2>
            {isStaff && (
              <button onClick={exportCsv} className="btn-ghost" style={{ padding: '8px 12px' }}>
                Экспорт в CSV
              </button>
            )}
          </div>

          {isStaff && (
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Поиск по ФИО или телефону..."
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 12 }}
            />
          )}

          {loading ? (
            <div>
              <div className="skeleton skeleton-row"></div>
              <div className="skeleton skeleton-row"></div>
            </div>
          ) : patients.length === 0 ? (
            <div className="empty-state">
              <div className="icon">👤</div>
              <div>Пока нет пациентов</div>
            </div>
          ) : (
            <ul className="list">
              {patients.map(p => (
                <li key={p.id}>
                  <span>{p.full_name}</span>
                  <span className="meta" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {p.phone}
                    {isStaff && (
                      <label style={{ cursor: 'pointer', fontSize: '.8rem', color: '#2563eb' }}>
                        Фото
                        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => uploadPhoto(p.id, e.target.files[0])} />
                      </label>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card" id="appointments">
          <h2>Записи на приём</h2>
          {loading ? (
            <div className="skeleton skeleton-row"></div>
          ) : appointments.length === 0 ? (
            <div className="empty-state">
              <div className="icon">📅</div>
              <div>Пока нет записей</div>
            </div>
          ) : (
            <ul className="list">
              {appointments.map(a => (
                <li key={a.id}>
                  <span>
                    {a.patient_name} → {a.doctor_name}
                    <div className="meta">{new Date(a.appointment_time).toISOString().slice(0, 16).replace('T', ' ')}</div>
                  </span>
                  <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className={`badge badge-${a.status || 'scheduled'}`}>
                      {a.status === 'cancelled' ? 'Отменена' : 'Запланирована'}
                    </span>
                    {a.status === 'scheduled' && (
                      <button className="btn-danger" onClick={() => cancelAppointment(a.id)}>
                        Отменить
                      </button>
                    )}
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
            <a href="#patients" onClick={goTo('patients')}>Пациенты</a>
            <a href="#appointments" onClick={goTo('appointments')}>Записи</a>
            <a href={`${BASE}/health`} target="_blank" rel="noopener noreferrer">API</a>
          </div>
        </div>
      </footer>

      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type === 'error' ? 'error' : ''}`}>{t.message}</div>
        ))}
      </div>
    </div>
  );
}