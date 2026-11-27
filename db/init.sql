CREATE TABLE IF NOT EXISTS patients (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(200) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS appointments (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
    doctor_name VARCHAR(200) NOT NULL,
    appointment_time TIMESTAMP NOT NULL,
    reason TEXT,
    status VARCHAR(20) DEFAULT 'scheduled'
);

INSERT INTO patients (full_name, phone) VALUES
('Иванов Иван', '+79990001122'),
('Петрова Анна', '+79990003344');

INSERT INTO appointments (patient_id, doctor_name, appointment_time, reason) VALUES
(1, 'Терапевт Смирнова', '2026-12-01 10:00', 'Плановый осмотр'),
(2, 'Кардиолог Кузнецов', '2026-12-02 14:30', 'Консультация');

CREATE TABLE IF NOT EXISTS doctors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL UNIQUE,
    specialty VARCHAR(100) NOT NULL,
    rating NUMERIC(2,1) DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
    reviews_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO doctors (name, specialty, rating, reviews_count) VALUES
('Терапевт Смирнова',  'Терапевт',  4.8, 124),
('Кардиолог Кузнецов', 'Кардиолог', 4.6,  87),
('Невролог Орлова',    'Невролог',  4.9,  56),
('Терапевт Иванов',    'Терапевт',  4.2,  31),
('Хирург Петров',      'Хирург',    4.7,  74)
ON CONFLICT (name) DO NOTHING;