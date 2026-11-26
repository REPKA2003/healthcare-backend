import { useEffect, useState } from 'react';

const API = import.meta.env.VITE_API_BASE_URL + '/api';

export default function App() {
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [p, a] = await Promise.all([
        fetch(`${API}/patients`).then(r => r.json()),
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

  useEffect(() => { load(); }, []);

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

  return (
    <div className="page">
      <header className="header">
        <div>
          <h1>Учёт пациентов</h1>
          <div className="subtitle">Записи на приём и база пациентов</div>
        </div>
      </header>

      {error && <div className="alert alert-error">{error}</div>}

      <section className="card">
        <h2>Добавить пациента</h2>
        <form onSubmit={addPatient} className="form-row">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="ФИО"
            required
          />
          <input
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="Телефон"
            required
          />
          <button type="submit" className="btn-primary">Добавить</button>
        </form>
      </section>

      <section className="card">
        <h2>Пациенты</h2>
        {loading ? (
          <div className="loading">Загрузка...</div>
        ) : patients.length === 0 ? (
          <div className="empty">Пока нет пациентов</div>
        ) : (
          <ul className="list">
            {patients.map(p => (
              <li key={p.id}>
                <span>{p.full_name}</span>
                <span className="meta">{p.phone}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
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
  );
}