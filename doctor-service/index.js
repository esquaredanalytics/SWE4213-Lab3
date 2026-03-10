const express = require('express');
const { Pool } = require('pg');
const app = express();
app.use(express.json());

const pool = new Pool({
  host: process.env.DB_HOST || 'doctor-db',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'doctordb',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

app.get('/doctors', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM doctors ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/doctors/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM doctors WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/doctors/:id/reserve', async (req, res) => {
  const client = await pool.connect();
  try {
  
    const slotsToReserve = req.body?.slots;
    if (typeof slotsToReserve !== 'number' || slotsToReserve <= 0 || !Number.isInteger(slotsToReserve)) {
      return res.status(400).json({ 
        success: false, 
        reason: 'slots must be a positive integer' 
      });
    }

    await client.query('BEGIN');
    const doc = await client.query('SELECT * FROM doctors WHERE id = $1 FOR UPDATE', [req.params.id]);
    
    if (doc.rows.length === 0) {
      return res.status(404).json({ success: false, reason: 'Doctor not found' });
    }
    
    const doctor = doc.rows[0];
    if (doctor.slots < slotsToReserve) {
      return res.status(409).json({ 
        success: false, 
        reason: `${doctor.name} has only ${doctor.slots} available slots, requested ${slotsToReserve}` 
      });
    }
    
    await client.query('UPDATE doctors SET slots = slots - $1 WHERE id = $2', [slotsToReserve, req.params.id]);
    await client.query('COMMIT');
    
    const updated = await client.query('SELECT * FROM doctors WHERE id = $1', [req.params.id]);
    res.json({
      success: true,
      doctor_id: req.params.id,
      doctor_name: updated.rows[0].name,
      slots_remaining: updated.rows[0].slots,
      slots_reserved: slotsToReserve
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});


app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    service: 'auth-service',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.listen(3002, () => console.log('Doctor Service on port 3002'));
