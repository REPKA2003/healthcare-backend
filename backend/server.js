const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { pool, connectWithRetry } = require('./db');

const app = express();

app.use(cors({
  origin: 'https://healthcare-backend-phi.vercel.app',
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
}));

app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (e) {
    res.status(500).json({ status: 'error', db: 'disconnected' });
  }
});

// Поиск пациентов
app.get('/api/patients', async (req, res) => {
  const { search } = req.query;
  let query = 'SELECT * FROM patients';
  const params = [];

  if (search) {
    query += ' WHERE full_name ILIKE $1 OR phone ILIKE $1';
    params.push(`%${search}%`);
  }

  query += ' ORDER BY id';
  const result = await pool.query(query, params);
  res.json(result.rows);
});

// Экспорт в CSV (должен быть до /api/patients/:id)
app.get('/api/patients/export', async (req, res) => {
  const result = await pool.query('SELECT full_name, phone FROM patients ORDER BY id');
  let csv = 'ФИО,Телефон\n';
  result.rows.forEach(r => {
    csv += `"${r.full_name}","${r.phone}"\n`;
  });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="patients.csv"');
  res.send('\uFEFF' + csv);
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

// Загрузка фото пациента (демо: возвращаем метаданные)
app.post('/api/patients/:id/photo', upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
  res.json({
    message: 'Файл получен',
    patient_id: parseInt(req.params.id),
    filename: req.file.originalname,
    size: req.file.size,
  });
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