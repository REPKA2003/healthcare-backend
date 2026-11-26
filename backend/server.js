const express = require('express');
const cors = require('cors');
const { pool, connectWithRetry } = require('./db');

const app = express();

// CORS — строго до маршрутов
app.use(cors({
  origin: 'https://healthcare-backend-phi.vercel.app',
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
}));

app.use(express.json());

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (e) {
    res.status(500).json({ status: 'error', db: 'disconnected' });
  }
});

app.get('/api/patients', async (req, res) => {
  const result = await pool.query('SELECT * FROM patients ORDER BY id');
  res.json(result.rows);
});

app.get('/api/appointments', async (req, res) => {
  const result = await pool.query(`
    SELECT a.*, p.full_name AS patient_name
    FROM appointments a
    JOIN patients p ON p.id = a.patient_id
    ORDER BY a.appointment_time
  `);
  res.json(result.rows);
});

app.post('/api/patients', async (req, res) => {
  const { full_name, phone } = req.body;
  if (!full_name || !phone) {
    return res.status(400).json({ error: 'full_name and phone required' });
  }
  const result = await pool.query(
    'INSERT INTO patients (full_name, phone) VALUES ($1, $2) RETURNING *',
    [full_name, phone]
  );
  res.status(201).json(result.rows[0]);
});

app.post('/api/appointments', async (req, res) => {
  const { patient_id, doctor_name, appointment_time, reason } = req.body;
  const result = await pool.query(
    `INSERT INTO appointments (patient_id, doctor_name, appointment_time, reason)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [patient_id, doctor_name, appointment_time, reason]
  );
  res.status(201).json(result.rows[0]);
});

const port = process.env.PORT || 4000;

connectWithRetry()
  .then(() => {
    app.listen(port, () => console.log(`Server on ${port}`));
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });