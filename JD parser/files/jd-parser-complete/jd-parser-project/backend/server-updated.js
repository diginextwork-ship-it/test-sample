const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection pool
const dbPool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Make db available to routes
app.set('db', dbPool);

// Test database connection
dbPool.getConnection()
  .then(connection => {
    console.log('✅ Database connected successfully');
    connection.release();
  })
  .catch(err => {
    console.error('❌ Database connection failed:', err.message);
  });

// Import routes
const jdParserRoutes = require('./routes/jdParser');
const jdParserAdvancedRoutes = require('./routes/jdParserAdvanced');

// Use routes
app.use('/api/jd', jdParserRoutes);
app.use('/api/jd-advanced', jdParserAdvancedRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'JD Parser API',
    version: '1.0.0',
    endpoints: {
      'POST /api/jd/upload': 'Upload and parse single JD file',
      'POST /api/jd/parse-text': 'Parse JD text directly',
      'POST /api/jd/save': 'Save parsed JD to database',
      'POST /api/jd-advanced/batch-upload': 'Upload and parse multiple JD files',
      'POST /api/jd-advanced/batch-save': 'Save batch parsed JDs',
      'GET /api/jd-advanced/stats': 'Get parsing statistics',
      'GET /api/jd-advanced/search': 'Search jobs',
      'GET /api/jd-advanced/:jid': 'Get job by JID',
      'PUT /api/jd-advanced/:jid': 'Update job',
      'DELETE /api/jd-advanced/:jid': 'Delete job'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error', 
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    path: req.path
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`📚 API info: http://localhost:${PORT}/api`);
});

module.exports = app;
