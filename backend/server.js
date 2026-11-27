const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { pool, connectWithRetry } = require('./db');
const { login, authRequired, requireRole } = require('./auth');

const app = express();

app.use(cors({
  origin: 'https://healthcare-backend-phi.vercel.app',
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
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

app.post('/api/auth/login', login);

// всё ниже — только с токеном
app.use('/api', authRequired);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Список врачей с рейтингом, фильтром по специальности и сортировкой
app.get('/api/doctors', async (req, res) => {
  const { specialty, sort } = req.query;

  let query = 'SELECT id, name, specialty, rating, reviews_count FROM doctors';
  const params = [];

  if (specialty && specialty !== 'all') {
    query += ' WHERE specialty = $1';
    params.push(specialty);
  }

  query += sort === 'name'
    ? ' ORDER BY name'
    : ' ORDER BY rating DESC, name';

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'db error' });
  }
});

// Список специальностей для чипсов на фронте
app.get('/api/specialties', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT DISTINCT specialty FROM doctors ORDER BY specialty'
    );
    res.json(result.rows.map(r => r.specialty));
  } catch (e) {
    res.status(500).json({ error: 'db error' });
  }
});

// Свободные слоты на 7 дней вперёд для врача
app.get('/api/doctors/:name/slots', async (req, res) => {
  const doctor = decodeURIComponent(req.params.name);
  const slots = [];
  const now = new Date();

  for (let d = 0; d < 7; d++) {
    const day = new Date(now);
    day.setDate(now.getDate() + d);
    const dateStr = day.toISOString().slice(0, 10);
    ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'].forEach(time => {
      slots.push(`${dateStr}T${time}:00`);
    });
  }

  const taken = await pool.query(
    `SELECT appointment_time FROM appointments
     WHERE doctor_name = $1 AND status = 'scheduled'`,
    [doctor]
  );
  const takenSet = new Set(taken.rows.map(r => r.appointment_time.toISOString().slice(0, 19)));

  const free = slots.filter(s => !takenSet.has(s));
  res.json(free);
});

// Пациенты: staff видит всех (с поиском), patient — только себя
app.get('/api/patients', async (req, res) => {
  const { search } = req.query;
  let query = 'SELECT * FROM patients';
  const params = [];

  if (req.user.role === 'patient') {
    query += ' WHERE user_id = $1';
    params.push(req.user.sub);
  } else if (search) {
    query += ' WHERE full_name ILIKE $1 OR phone ILIKE $1';
    params.push(`%${search}%`);
  }

  query += ' ORDER BY id';
  const result = await pool.query(query, params);
  res.json(result.rows);
});

// Экспорт CSV — только staff
app.get('/api/patients/export', requireRole('staff'), async (req, res) => {
  const result = await pool.query('SELECT full_name, phone FROM patients ORDER BY id');
  let csv = 'ФИО,Телефон\n';
  result.rows.forEach(r => {
    csv += `"${r.full_name}","${r.phone}"\n`;
  });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="patients.csv"');
  res.send('\uFEFF' + csv);
});

// Записи: patient видит только свои
app.get('/api/appointments', async (req, res) => {
  let query = `
    SELECT a.*, p.full_name AS patient_name
    FROM appointments a
    JOIN patients p ON p.id = a.patient_id
  `;
  const params = [];
  if (req.user.role === 'patient') {
    query += ' WHERE p.user_id = $1';
    params.push(req.user.sub);
  }
  query += ' ORDER BY a.appointment_time';
  const result = await pool.query(query, params);
  res.json(result.rows);
});

// Добавлять пациентов может только staff
app.post('/api/patients', requireRole('staff'), async (req, res) => {
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

// Загрузка фото — только staff
app.post('/api/patients/:id/photo', requireRole('staff'), upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });
  res.json({
    message: 'Файл получен',
    patient_id: parseInt(req.params.id),
    filename: req.file.originalname,
    size: req.file.size,
  });
});

// Создание записи: staff — для любого, patient — только для себя
app.post('/api/appointments', async (req, res) => {
  const { patient_id, doctor_name, appointment_time, reason } = req.body;
  if (!patient_id || !doctor_name || !appointment_time) {
    return res.status(400).json({ error: 'patient_id, doctor_name, appointment_time required' });
  }

  if (req.user.role === 'patient') {
    const check = await pool.query(
      'SELECT 1 FROM patients WHERE id = $1 AND user_id = $2',
      [patient_id, req.user.sub]
    );
    if (check.rowCount === 0) {
      return res.status(403).json({ error: 'forbidden' });
    }
  }

  // проверка занятости слота
  const conflict = await pool.query(
    `SELECT 1 FROM appointments
     WHERE doctor_name = $1 AND appointment_time = $2 AND status = 'scheduled'`,
    [doctor_name, appointment_time]
  );
  if (conflict.rowCount > 0) {
    return res.status(409).json({ error: 'slot already taken' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO appointments (patient_id, doctor_name, appointment_time, reason)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [patient_id, doctor_name, appointment_time, reason]
    );
    res.status(201).json(result.rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'slot already taken' });
    throw e;
  }
});

// Отмена записи: patient — только своей
app.patch('/api/appointments/:id/cancel', async (req, res) => {
  const id = parseInt(req.params.id);
  let query = `UPDATE appointments SET status = 'cancelled' WHERE id = $1 AND status = 'scheduled'`;
  const params = [id];

  if (req.user.role === 'patient') {
    query += ` AND patient_id IN (SELECT id FROM patients WHERE user_id = $2)`;
    params.push(req.user.sub);
  }

  query += ' RETURNING *';
  const result = await pool.query(query, params);
  if (result.rowCount === 0) {
    return res.status(404).json({ error: 'not found or already cancelled' });
  }
  res.json(result.rows[0]);
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