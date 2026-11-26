import { useEffect, useState } from 'react';

const API = import.meta.env.VITE_API_BASE_URL + '/api';

export default function App() {
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const load = async () => {
    const [p, a] = await Promise.all([
      fetch(`${API}/patients`).then(r => r.json()),
      fetch(`${API}/appointments`).then(r => r.json()),
    ]);
    setPatients(p);
    setAppointments(a);
  };

  useEffect(() => { load(); }, []);

  const addPatient = async (e) => {
    e.preventDefault();
    await fetch(`${API}/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: name, phone }),
    });
    setName(''); setPhone('');
    load();
  };

  return (
    <div style={{ padding: 20, fontFamily: 'sans-serif' }}>
      <h1>Учёт пациентов</h1>

      <form onSubmit={addPatient} style={{ marginBottom: 20 }}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="ФИО" required />
        <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Телефон" required />
        <button type="submit">Добавить</button>
      </form>

      <h2>Пациенты</h2>
      <ul>{patients.map(p => <li key={p.id}>{p.full_name} — {p.phone}</li>)}</ul>

      <h2>Записи на приём</h2>
      <ul>
        {appointments.map(a => (
          <li key={a.id}>
            {a.patient_name} → {a.doctor_name} ({new Date(a.appointment_time).toLocaleString()})
          </li>
        ))}
      </ul>
    </div>
  );
}