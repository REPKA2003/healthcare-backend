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