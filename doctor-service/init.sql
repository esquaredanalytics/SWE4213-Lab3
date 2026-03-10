
CREATE TABLE IF NOT EXISTS doctors (
  id VARCHAR(10) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  specialty VARCHAR(50) NOT NULL,
  slots INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO doctors (id, name, specialty, slots) VALUES
('D001', 'Dr. Sarah Chen', 'Cardiology', 5),
('D002', 'Dr. James Ruiz', 'Neurology', 3),
('D003', 'Dr. Maria Lopez', 'Pediatrics', 4)
ON CONFLICT (id) DO UPDATE SET slots = EXCLUDED.slots;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_doctors_id ON doctors(id);
