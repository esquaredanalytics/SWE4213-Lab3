const express = require('express');
const proxy = require('express-http-proxy');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret-change-in-prod';

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};


app.use('/auth', proxy('http://auth-service:3003'));
app.use('/doctors/public', proxy('http://doctor-service:3002'));


app.use('/appointments', authenticateToken, proxy('http://appointment-service:3001'));

app.get('/health', (req, res) => res.json({ status: 'OK', service: 'gateway' }));

app.listen(8080, () => console.log('API Gateway on port 8080'));
