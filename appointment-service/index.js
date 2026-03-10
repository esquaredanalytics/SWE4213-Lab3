const express = require('express');
const axios = require('axios');
const amqp = require('amqplib');
const { v4: uuidv4 } = require('uuid');
const app = express();
app.use(express.json());

const DOCTOR_URL = process.env.DOCTOR_SERVICE_URL || 'http://doctor-service:3002';
const RABBIT_URL = process.env.RABBITMQ_URL || 'amqp://rabbitmq';

async function publishEvent(event) {
  const conn = await amqp.connect(RABBIT_URL);
  const ch = await conn.createChannel();
  await ch.assertExchange('appts', 'fanout', { durable: true });
  ch.publish('appts', '', Buffer.from(JSON.stringify(event)));
  await ch.close();
  await conn.close();
}

app.post('/create', async (req, res) => {
  const { patient_name, patient_email, doctor_id, reason, slots = 1 } = req.body;
  
  if (!patient_name || !patient_email || !doctor_id || !reason || slots <= 0 || !Number.isInteger(slots)) {
    return res.status(400).json({ 
      status: 'error', 
      reason: 'Missing fields or invalid slots (must be positive integer)' 
    });
  }
  
  try {
    const resp = await axios.post(
      `${DOCTOR_URL}/doctors/${doctor_id}/reserve`,
      { slots }, 
      { 
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000 
      }
    );
    
    if (!resp.data.success) {
      return res.status(409).json(resp.data);
    }

    const event = {
      appointment_id: uuidv4(),
      patient_name, 
      patient_email, 
      doctor_id,
      doctor_name: resp.data.doctor_name,
      slots_reserved: resp.data.slots_reserved,
      reason, 
      timestamp: new Date().toISOString()
    };

    await publishEvent(event);  
    res.status(201).json({
      appointment_id: event.appointment_id,
      status: 'confirmed',
      message: `Appointment with ${event.doctor_name} booked! ${event.slots_reserved} slots reserved.`,
      slots_remaining: resp.data.slots_remaining
    });
  } catch (err) {
    console.error('Appointment creation failed:', err.response?.data || err.message);
    res.status(409).json({ 
      status: 'rejected', 
      reason: err.response?.data?.reason || 'Reservation failed' 
    });
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

app.listen(3001, () => console.log('Appointment Service on port 3001'));
