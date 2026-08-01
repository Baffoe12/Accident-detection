require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Sequelize, Op } = require('sequelize');
const nodemailer = require('nodemailer');

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || process.env.EMAIL_USER || 'boadupaakwesi4@gmail.com';
const SMTP_HOST = process.env.EMAIL_HOST || 'smtp.gmail.com';
const SMTP_PORT = process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT, 10) : 465;
const SMTP_SECURE = process.env.EMAIL_SECURE ? process.env.EMAIL_SECURE.toLowerCase() === 'true' : true;
const SMTP_USER = process.env.EMAIL_USER;
const SMTP_PASS = process.env.EMAIL_PASS;
const SMTP_ENABLED = !!SMTP_USER && !!SMTP_PASS;
const EMAIL_ENABLED = SMTP_ENABLED || !!SENDGRID_API_KEY;

let transporter = null;
if (SMTP_ENABLED) {
  const transportOptions = {
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  };

  if (SMTP_HOST && SMTP_HOST.includes('gmail.com')) {
    transportOptions.service = 'gmail';
  } else {
    transportOptions.host = SMTP_HOST;
    transportOptions.port = SMTP_PORT;
    transportOptions.secure = SMTP_SECURE;
  }

  transporter = nodemailer.createTransport(transportOptions);

  transporter.verify((error) => {
    if (error) {
      console.error('Failed to verify SMTP transporter:', error.message);
      transporter = null;
    } else {
      console.log('SMTP transporter verified successfully');
    }
  });
}

let sgMail = null;
if (!transporter && SENDGRID_API_KEY) {
  try {
    sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(SENDGRID_API_KEY);
  } catch (err) {
    console.error('Failed to load @sendgrid/mail:', err.message);
  }
}

let lastEmailSentTime = 0;
const EMAIL_RATE_LIMIT_MS = 60 * 60 * 1000;

const app = express();
const PORT = process.env.PORT || 4000;

const morgan = require('morgan');
const fs = require('fs');

// Create a write stream (in append mode) for logging
const logStream = fs.createWriteStream('server.log', { flags: 'a' });

// Create a separate write stream for error logging
const errorLogStream = fs.createWriteStream('error.log', { flags: 'a' });

// Use body-parser once and apply JSON parsing middleware before all routes
const bodyParser = require('body-parser');
app.use(bodyParser.json());

// Add morgan middleware for logging HTTP requests with status codes to file and console
app.use(morgan(':method :url :status :res[content-length] - :response-time ms', { stream: logStream }));
app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));

// Add request logging middleware
app.use((req, res, next) => {
  const logEntry = `[${new Date().toISOString()}] ${req.method} ${req.originalUrl}\n`;
  logStream.write(logEntry);
  console.log(logEntry.trim());
  next();
});

// Enhanced logging for sensor and accident data ingestion
const logDataIngestion = (type, data) => {
  const logEntry = `[${new Date().toISOString()}] ${type} data received: ${JSON.stringify(data)}\n`;
  logStream.write(logEntry);
  console.log(logEntry.trim());
};

// Modify /api/sensor endpoint to add ingestion logging
app.post('/api/sensor', requireApiKey, async (req, res) => {
  console.log('Received /api/sensor POST body:', req.body);

  const data = req.body;
  const pulse = typeof data.pulse === 'number' ? data.pulse : undefined;
  const currentPulse = typeof data.current_pulse === 'number' ? data.current_pulse : undefined;
  if (pulse !== undefined || currentPulse !== undefined) {
    console.log(`Incoming pulse: ${pulse}, current_pulse: ${currentPulse}`);
  }

  if (data.event_type) {
    delete data.event_type;
  }

  logDataIngestion('Sensor', data);
  if (!isValidSensorData(data)) {
    const errorMsg = 'Invalid sensor data';
    logStream.write(`[${new Date().toISOString()}] ERROR: ${errorMsg} - ${JSON.stringify(data)}\n`);
    console.error(errorMsg, data);
    return res.status(400).json({ error: errorMsg });
  }
  data.timestamp = new Date();
  try {
    const sensorEntry = await SensorDataModel.create(data);

    if (isCriticalSensorData(data)) {
      console.log('Emergency alert triggered due to critical sensor data:', data);
      const storedAlertEmail = await getSetting('emergency_email');
      const recipients = storedAlertEmail || process.env.EMERGENCY_CONTACT_EMAIL || '';
      console.log('Configured emergency email:', recipients || 'not set');
      await sendEmergencyAlertEmail({
        device_id: data.device_id,
        timestamp: new Date().toISOString(),
        alcohol: data.alcohol,
        vibration: data.vibration,
        distance: data.distance,
        impact: data.impact,
        lat: data.lat,
        lng: data.lng,
        lcd_display: data.lcd_display,
        pulse: data.pulse,
        current_pulse: data.current_pulse
      }, recipients);
    }

    res.json({ status: 'ok', id: sensorEntry.id });
  } catch (err) {
    logStream.write(`[${new Date().toISOString()}] ERROR: Database error - ${err.message}\n`);
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// Modify /api/accident endpoint to add ingestion logging
app.post('/api/accident', requireApiKey, async (req, res) => {
  const data = req.body;
  logDataIngestion('Accident', data);
  if (!isValidAccidentData(data)) {
    const errorMsg = 'Invalid accident data';
    logStream.write(`[${new Date().toISOString()}] ERROR: ${errorMsg} - ${JSON.stringify(data)}\n`);
    console.error(errorMsg, data);
    return res.status(400).json({ error: errorMsg });
  }
  data.timestamp = new Date();
  data.id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  try {
    const accidentEntry = await AccidentEventModel.create(data);
    res.json({ status: 'ok', id: accidentEntry.id });
  } catch (err) {
    logStream.write(`[${new Date().toISOString()}] ERROR: Database error - ${err.message}\n`);
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});


const frontendUrl = process.env.FRONTEND_URL || 'https://accidentdetectiondash.netlify.app';
const devOrigins = ['http://localhost:3000', 'http://localhost:3001'];
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [frontendUrl]
  : [...devOrigins, frontendUrl];

const corsOptions = {
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  credentials: true
};

app.use(cors(corsOptions));

// Add CORS headers manually to fix missing Access-Control-Allow-Origin
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  } else if (origin) {
    // Log disallowed origin for debugging
    console.warn(`CORS origin denied: ${origin}`);
  }
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Fix: Add OPTIONS preflight handler for all routes to respond with CORS headers
app.options('*', cors(corsOptions));

// Root health endpoint
app.get('/', (req, res) => {
  res.json({ status: 'SafeDrive backend is running' });
});

/* Removed duplicate bodyParser declaration and usage to fix syntax error */

// Ensure JSON body parsing middleware is applied before all routes
// app.use(bodyParser.json());

// Remove raw body logging middleware to avoid consuming request stream before body-parser
// Instead, rely on body-parser and Content-Type validation middleware

// Middleware to validate Content-Type header for JSON POST requests only
app.use('/api/sensor', (req, res, next) => {
  if (req.method === 'POST') {
    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.includes('application/json')) {
      return res.status(400).json({ error: 'Content-Type must be application/json' });
    }
  }
  next();
});

// Database setup
let sequelize;
const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URI;
if (process.env.NODE_ENV === 'production' && databaseUrl) {
  // Production: Use PostgreSQL
  console.log('Using PostgreSQL database with URL:', databaseUrl.substring(0, 25) + '...');
  sequelize = new Sequelize(databaseUrl, {
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    },
    logging: false
  });
  console.log('PostgreSQL connection initialized');
} else {
  // Development: Use SQLite
  console.log('Using SQLite database');
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: './database.sqlite',
    logging: false
  });
}

// Define models
const SensorDataModel = require('./models/SensorData')(sequelize);
const AccidentEventModel = require('./models/AccidentEvent')(sequelize);
const SettingModel = require('./models/Setting')(sequelize);

// Sync models on startup with more detailed logging
console.log('Starting database sync...');
sequelize.sync({ force: false }).then(() => {
  console.log('Database tables synced successfully');
  // Verify tables exist
  sequelize.getQueryInterface().showAllTables().then(tables => {
    console.log('Available tables:', tables);
  }).catch(err => {
    console.error('Error checking tables:', err);
  });

  // Seed default settings if missing
  return SettingModel.findByPk('emergency_email').then(setting => {
    if (!setting) {
      const defaultEmail = process.env.EMERGENCY_CONTACT_EMAIL || 'boadupaakwesi4@gmail.com';
      console.log(`Seeding default emergency_email setting: ${defaultEmail}`);
      return SettingModel.create({ key: 'emergency_email', value: defaultEmail });
    }
  });
}).catch(err => {
  console.error('Error syncing database tables:', err);
  // Continue running even if sync fails
});

// --- CONFIG ---
const API_KEY = process.env.SAFEDRIVE_API_KEY || "safedrive_secret_key"; // Change for production

// --- Input Validation ---
function isValidSensorData(data) {
  if (!data) {
    console.error('Validation failed: data is undefined or null');
    return false;
  }

  // Helper to check array elements are numbers or empty arrays
  function isValidNumberArray(arr) {
    if (!Array.isArray(arr)) {
      console.error('Validation failed: expected array but got', typeof arr);
      return false;
    }
    for (const item of arr) {
      if (typeof item !== 'number') {
        console.error('Validation failed: array item is not a number:', item);
        return false;
      }
    }
    return true;
  }

  if (typeof data.device_id !== 'string') {
    console.error('Validation failed: device_id is not string:', data.device_id);
    return false;
  }
  if (typeof data.timestamp !== 'number' && typeof data.timestamp !== 'string') {
    console.error('Validation failed: timestamp is not number or string:', data.timestamp);
    return false;
  }
  if (typeof data.alcohol !== 'number') {
    console.error('Validation failed: alcohol is not number:', data.alcohol);
    return false;
  }
  if (typeof data.vibration !== 'number') {
    console.error('Validation failed: vibration is not number:', data.vibration);
    return false;
  }
  if (typeof data.distance !== 'number') {
    console.error('Validation failed: distance is not number:', data.distance);
    return false;
  }
  if (typeof data.impact !== 'number') {
    console.error('Validation failed: impact is not number:', data.impact);
    return false;
  }
  if (data.lat !== undefined && typeof data.lat !== 'number') {
    console.error('Validation failed: lat is not number:', data.lat);
    return false;
  }
  if (data.lng !== undefined && typeof data.lng !== 'number') {
    console.error('Validation failed: lng is not number:', data.lng);
    return false;
  }
  if (data.lcd_display !== undefined && typeof data.lcd_display !== 'string') {
    console.error('Validation failed: lcd_display is not string:', data.lcd_display);
    return false;
  }
  if (data.pulse !== undefined && typeof data.pulse !== 'number') {
    console.error('Validation failed: pulse is not number:', data.pulse);
    return false;
  }
  if (data.current_pulse !== undefined && typeof data.current_pulse !== 'number') {
    console.error('Validation failed: current_pulse is not number:', data.current_pulse);
    return false;
  }
  if (data.distance_history !== undefined && !isValidNumberArray(data.distance_history)) {
    console.error('Validation failed: distance_history invalid:', data.distance_history);
    return false;
  }
  if (data.alcohol_history !== undefined && !isValidNumberArray(data.alcohol_history)) {
    console.error('Validation failed: alcohol_history invalid:', data.alcohol_history);
    return false;
  }
  if (data.impact_history !== undefined && !isValidNumberArray(data.impact_history)) {
    console.error('Validation failed: impact_history invalid:', data.impact_history);
    return false;
  }
  if (data.vibration_history !== undefined && !isValidNumberArray(data.vibration_history)) {
    console.error('Validation failed: vibration_history invalid:', data.vibration_history);
    return false;
  }

  return true;
}

function isValidAccidentData(data) {
  if (!data) {
    console.error('Validation failed: accident data is undefined or null');
    return false;
  }
  if (typeof data.device_id !== 'string') {
    console.error('Validation failed: device_id is not string:', data.device_id);
    return false;
  }
  if (typeof data.timestamp !== 'number' && typeof data.timestamp !== 'string') {
    console.error('Validation failed: timestamp is not number or string:', data.timestamp);
    return false;
  }
  if (typeof data.alcohol !== 'number') {
    console.error('Validation failed: alcohol is not number:', data.alcohol);
    return false;
  }
  if (typeof data.vibration !== 'number') {
    console.error('Validation failed: vibration is not number:', data.vibration);
    return false;
  }
  if (typeof data.distance !== 'number') {
    console.error('Validation failed: distance is not number:', data.distance);
    return false;
  }
  if (typeof data.impact !== 'number') {
    console.error('Validation failed: impact is not number:', data.impact);
    return false;
  }
  if (data.lat !== undefined && typeof data.lat !== 'number') {
    console.error('Validation failed: lat is not number:', data.lat);
    return false;
  }
  if (data.lng !== undefined && typeof data.lng !== 'number') {
    console.error('Validation failed: lng is not number:', data.lng);
    return false;
  }
  if (data.lcd_display !== undefined && typeof data.lcd_display !== 'string') {
    console.error('Validation failed: lcd_display is not string:', data.lcd_display);
    return false;
  }
  return true;
}

// --- API Key Middleware ---
function requireApiKey(req, res, next) {
  if (req.method === 'OPTIONS') {
    // Skip API key check for preflight requests
    return next();
  }
  const key = req.headers['x-api-key'] || req.query.api_key;
  console.log(`[API Key Middleware] Received key: ${key}, Expected key: ${API_KEY}`);
  if (!key || key !== API_KEY) {
    console.log('[API Key Middleware] Unauthorized access attempt');
    return res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
  }
  console.log('[API Key Middleware] API key validated successfully');
  next();
}

// --- API Endpoints ---

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Fallback stats endpoint that doesn't require database
app.get('/api/stats', async (req, res) => {
  try {
    // Try to get stats from database
    const accidents = await AccidentEventModel.findAll();
    const sensors = await SensorDataModel.findAll();
    
    const stats = {
      total_accidents: accidents.length,
      max_alcohol: accidents.length > 0 ? Math.max(...accidents.map(a => a.alcohol || 0)) : 0,
      avg_alcohol: accidents.length > 0 ? accidents.reduce((sum, a) => sum + (a.alcohol || 0), 0) / accidents.length : 0,
      max_impact: accidents.length > 0 ? Math.max(...accidents.map(a => a.impact || 0)) : 0,
      total_sensor_points: sensors.length
    };
    
    // Fix: Return valid JSON with commas between fields
    res.json(stats);
  } catch (err) {
    console.error('Database error in stats endpoint:', err);
    // Return mock data if database fails
    res.json({
      total_accidents: 5,
      max_alcohol: 0.8,
      avg_alcohol: 0.3,
      max_impact: 0.9,
      total_sensor_points: 120
    });
  }
});

async function getSetting(key, defaultValue = null) {
  const setting = await SettingModel.findByPk(key);
  return setting ? setting.value : defaultValue;
}

async function setSetting(key, value) {
  await SettingModel.upsert({ key, value });
}

function isCriticalSensorData(data) {
  const normalizedAlcoholThreshold = 0.6;
  const rawMq3AlcoholThreshold = 400; // raw MQ-3 ADC values are 0-1023; low raw values are not critical
  const criticalImpactLevel = 2.0;

  const alcoholValue = Number(data.alcohol);
  const alcoholCritical = alcoholValue > 10
    ? alcoholValue >= rawMq3AlcoholThreshold
    : alcoholValue > normalizedAlcoholThreshold;

  if (alcoholValue > 10) {
    console.log(`Interpreting alcohol reading as raw MQ-3 ADC value: ${alcoholValue}, threshold: ${rawMq3AlcoholThreshold}`);
  }

  return data && (alcoholCritical || data.impact > criticalImpactLevel);
}

async function sendEmergencyAlertEmail(alertData, recipientCsv) {
  if (!EMAIL_ENABLED) {
    console.log('Email alerts disabled: no SMTP or SendGrid transport configured');
    return;
  }
  if (!recipientCsv) {
    console.log('Email alerts disabled: no emergency recipient email configured');
    return;
  }

  const recipients = recipientCsv
    .split(',')
    .map(email => email.trim())
    .filter(Boolean);

  if (recipients.length === 0) {
    console.log('Email alerts disabled: no valid recipients found');
    return;
  }

  const msg = {
    from: EMAIL_FROM,
    to: recipients,
    subject: 'SafeDrive Critical Sensor Alert',
    text: `Critical sensor alert received:\n${JSON.stringify(alertData, null, 2)}`,
  };

  try {
    const now = Date.now();
    if (now - lastEmailSentTime < EMAIL_RATE_LIMIT_MS) {
      console.log('Email rate limit exceeded, skipping emergency alert email');
      return;
    }

    if (SMTP_ENABLED && transporter) {
      const info = await transporter.sendMail(msg);
      console.log('Emergency alert email sent via SMTP:', info.messageId || info.response);
      emergencyAlertLog.write(`[${new Date().toISOString()}] Email sent via SMTP to ${recipients.join(', ')}: ${info.messageId || info.response}\n`);
      lastEmailSentTime = now;
      return;
    }

    if (SENDGRID_API_KEY && sgMail) {
      const info = await sgMail.send(msg);
      console.log('Emergency alert email sent via SendGrid:', info[0].statusCode);
      emergencyAlertLog.write(`[${new Date().toISOString()}] Email sent via SendGrid to ${recipients.join(', ')}: ${info[0].statusCode}\n`);
      lastEmailSentTime = now;
      return;
    }

    console.log('Email alert skipped: no valid transport available');
  } catch (error) {
    console.error('Error sending emergency alert email:', error);
    emergencyAlertLog.write(`[${new Date().toISOString()}] ERROR sending email to ${recipients.join(', ')}: ${error.message}\n`);
  }
}

app.get('/api/settings/emergency-email', requireApiKey, async (req, res) => {
  try {
    const email = await getSetting('emergency_email', process.env.EMERGENCY_CONTACT_EMAIL || '');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.json({ email });
  } catch (err) {
    console.error('Database error in emergency email settings endpoint:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

app.post('/api/settings/emergency-email', requireApiKey, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Invalid email address' });
    }
    const cleaned = email
      .split(',')
      .map(e => e.trim())
      .filter(e => e.length > 0)
      .join(',');
    await setSetting('emergency_email', cleaned);
    res.json({ status: 'ok', email: cleaned });
  } catch (err) {
    console.error('Database error in emergency email settings endpoint:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

app.get('/api/sensor', async (req, res) => {
  try {
    // Try to get latest sensor data from database
    const latest = await SensorDataModel.findOne({ order: [['timestamp', 'DESC']] });
    if (latest) {
      const latestJson = latest.toJSON();
      console.log(`Latest sensor data createdAt: ${latestJson.createdAt}, timestamp: ${latestJson.timestamp}`);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.json(latestJson);
      return;
    }

    res.json({
      id: 1,
      alcohol: 0.05,
      vibration: 0.2,
      distance: 150,
      impact: 0.1,
      lat: 5.6545,
      lng: -0.1869,
      lcd_display: 'SYSTEM OK',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Database error in sensor endpoint:', err);
    res.json({
      id: 1,
      alcohol: 0.05,
      vibration: 0.2,
      distance: 150,
      impact: 0.1,
      lat: 5.6545,
      lng: -0.1869,
      lcd_display: 'SYSTEM OK',
      timestamp: new Date().toISOString()
    });
  }
});

// Fallback map endpoint that doesn't require database
app.get('/api/map', async (req, res) => {
  try {
    const accidents = await AccidentEventModel.findAll({ 
      where: { 
        lat: { [Op.ne]: null }, 
        lng: { [Op.ne]: null } 
      } 
    });

    // Map accident data to frontend expected fields
    const mappedAccidents = accidents.map(e => {
      let impactLevel = 'Low';
      if (e.impact > 8) impactLevel = 'High';
      else if (e.impact > 4) impactLevel = 'Medium';

      const summaryParts = [];
      if (e.alcohol > 0.05) summaryParts.push('Alcohol detected');
      if (e.impact > 8) summaryParts.push('Severe impact detected');
      if (e.vibration > 5) summaryParts.push('High vibration');
      if (e.distance < 10) summaryParts.push('Proximity warning');
      if (e.lcd_display) summaryParts.push(`LCD: "${e.lcd_display}"`);

      return {
        id: e.id,
        lat: e.lat,
        lng: e.lng,
        time: e.timestamp ? e.timestamp.toISOString() : '',
        type: 'Accident',
        impactLevel,
        summary: summaryParts.join('. ') + (summaryParts.length > 0 ? '.' : '')
      };
    });

    res.json(mappedAccidents);
  } catch (err) {
    console.error('Database error in map endpoint:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// Get sensor history
app.get('/api/sensor/history', async (req, res) => {
  try {
    const history = await SensorDataModel.findAll({ order: [['timestamp', 'DESC']], limit: 1000 });
    res.json(history);
  } catch (err) {
    console.error('Database error in sensor history endpoint:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  }
});

// Fallback accidents endpoint that doesn't require database
app.get('/api/accidents', async (req, res) => {
  try {
    const accidents = await AccidentEventModel.findAll({ order: [['createdAt', 'DESC']] });
    res.json(accidents);
  } catch (err) {
    console.error('Database error in accidents endpoint:', err);
    res.json([
      {
        id: 'abc123',
        alcohol: 0.02,
        vibration: 0.8,
        distance: 20,
        impact: 0.9,
        lat: 5.6545,
        lng: -0.1869,
        lcd_display: 'ACCIDENT DETECTED',
        timestamp: new Date(Date.now() - 86400000).toISOString()
      },
      {
        id: 'def456',
        alcohol: 0.04,
        vibration: 0.7,
        distance: 15,
        impact: 0.8,
        lat: 5.6540,
        lng: -0.1875,
        lcd_display: 'ACCIDENT DETECTED',
        timestamp: new Date(Date.now() - 172800000).toISOString()
      }
    ]);
  }
});

// Car position endpoint with fallback
app.get('/api/car/position', async (req, res) => {
  try {
    const latest = await SensorDataModel.findOne({ 
      order: [['createdAt', 'DESC']],
      where: {
        lat: { [Op.ne]: null },
        lng: { [Op.ne]: null }
      }
    });
    if (latest && latest.lat !== null && latest.lng !== null) {
      res.json({ lat: latest.lat, lng: latest.lng, speed: 42 });
    } else {
      throw new Error('No position data found');
    }
  } catch (err) {
    console.error('Database error in car position endpoint:', err);
    res.json({
      lat: 5.6545,
      lng: -0.1869,
      speed: 42
    });
  }
});

/* Removed duplicate declaration of bodyParser and its usage */

// Middleware to validate Content-Type header for JSON POST requests only

const predictiveAnalyticsService = require('./services/predictiveAnalyticsService');

const emergencyAlertLog = fs.createWriteStream('emergency_alerts.log', { flags: 'a' });

const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

// Test route to verify body parsing works correctly
app.post('/api/test-body', (req, res) => {
  res.json({ receivedBody: req.body });
});

// Route to generate and download PDF report
app.get('/api/reports/pdf', async (req, res) => {
  try {
    const doc = new PDFDocument();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="safedrive_report.pdf"');
    doc.pipe(res);

    doc.fontSize(20).text('SafeDrive Report', { align: 'center' });
    doc.moveDown();

    // Add some sample content or summary
    doc.fontSize(14).text('This is a generated PDF report for SafeDrive.', { align: 'left' });
    doc.moveDown();

    // Add timestamp
    doc.fontSize(10).text(`Generated on: ${new Date().toLocaleString()}`, { align: 'right' });

    doc.end();
  } catch (err) {
    console.error('Error generating PDF report:', err);
    res.status(500).json({ error: 'Failed to generate PDF report' });
  }
});

// Route to generate and download sensor data Excel report
app.get('/api/reports/sensor-excel', async (req, res) => {
  try {
    const sensorData = await SensorDataModel.findAll();

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Sensor Data');

    // Define columns
    sheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Device ID', key: 'device_id', width: 20 },
      { header: 'Timestamp', key: 'timestamp', width: 25 },
      { header: 'Alcohol', key: 'alcohol', width: 10 },
      { header: 'Vibration', key: 'vibration', width: 10 },
      { header: 'Distance', key: 'distance', width: 10 },
      { header: 'Impact', key: 'impact', width: 10 },
      { header: 'Latitude', key: 'lat', width: 15 },
      { header: 'Longitude', key: 'lng', width: 15 }
    ];

    // Add rows
    sensorData.forEach(data => {
      sheet.addRow({
        id: data.id,
        device_id: data.device_id,
        timestamp: data.timestamp,
        alcohol: data.alcohol,
        vibration: data.vibration,
        distance: data.distance,
            impact: data.impact,
                lat: data.lat,
        lng: data.lng
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="sensor_data.xlsx"');

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Error generating sensor Excel report:', err);
    res.status(500).json({ error: 'Failed to generate sensor Excel report' });
  }
});

// Route to generate and download accident data Excel report
app.get('/api/reports/accident-excel', async (req, res) => {
  try {
    const accidentData = await AccidentEventModel.findAll();

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Accident Data');

    // Define columns
    sheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Timestamp', key: 'timestamp', width: 25 },
      { header: 'Alcohol', key: 'alcohol', width: 10 },
      { header: 'Vibration', key: 'vibration', width: 10 },
      { header: 'Distance', key: 'distance', width: 10 },
          { header: 'Impact', key: 'impact', width: 10 },
      { header: 'Latitude', key: 'lat', width: 15 },
      { header: 'Longitude', key: 'lng', width: 15 }
    ];

    // Add rows
    accidentData.forEach(data => {
      sheet.addRow({
        id: data.id,
        timestamp: data.timestamp,
        alcohol: data.alcohol,
        vibration: data.vibration,
        distance: data.distance,
            impact: data.impact,
        lat: data.lat,
        lng: data.lng
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="accident_data.xlsx"');

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Error generating accident Excel report:', err);
    res.status(500).json({ error: 'Failed to generate accident Excel report' });
  }
});

// Route to generate and download statistics Excel report
app.get('/api/reports/stats-excel', async (req, res) => {
  try {
    // Calculate statistics
    const accidents = await AccidentEventModel.findAll();
    const sensors = await SensorDataModel.findAll();

    const totalAccidents = accidents.length;
    const maxAlcohol = accidents.length > 0 ? Math.max(...accidents.map(a => a.alcohol || 0)) : 0;
    const avgAlcohol = accidents.length > 0 ? accidents.reduce((sum, a) => sum + (a.alcohol || 0), 0) / accidents.length : 0;
    const maxImpact = accidents.length > 0 ? Math.max(...accidents.map(a => a.impact || 0)) : 0;
        const totalSensorPoints = sensors.length;

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Statistics');

    sheet.columns = [
      { header: 'Statistic', key: 'stat', width: 30 },
      { header: 'Value', key: 'value', width: 20 }
    ];

    sheet.addRow({ stat: 'Total Accidents', value: totalAccidents });
    sheet.addRow({ stat: 'Max Alcohol Level', value: maxAlcohol });
    sheet.addRow({ stat: 'Average Alcohol Level', value: avgAlcohol.toFixed(2) });
    sheet.addRow({ stat: 'Max Impact Level', value: maxImpact });
        sheet.addRow({ stat: 'Total Sensor Data Points', value: totalSensorPoints });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="statistics_report.xlsx"');

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Error generating statistics Excel report:', err);
    res.status(500).json({ error: 'Failed to generate statistics Excel report' });
  }
});

// Emergency alert ingestion endpoint
app.post('/api/emergency-alert', requireApiKey, async (req, res) => {
  const alertData = req.body;
  if (!alertData || typeof alertData !== 'object') {
    return res.status(400).json({ error: 'Invalid emergency alert data' });
  }
  const logEntry = `[${new Date().toISOString()}] Emergency alert received: ${JSON.stringify(alertData)}\n`;
  emergencyAlertLog.write(logEntry);
  console.log(logEntry.trim());

  const recipientEmail = alertData.email || process.env.EMERGENCY_CONTACT_EMAIL || '';
  const storedEmail = await getSetting('emergency_email');
  const finalRecipient = storedEmail || recipientEmail;

  await sendEmergencyAlertEmail(alertData, finalRecipient);

  res.json({ status: 'ok', message: 'Emergency alert received' });
});

// Predictive analytics risk score API endpoint
app.get('/api/predictive-risk', async (req, res) => {
  const { lat, lng, timestamp } = req.query;
  if (!lat || !lng || !timestamp) {
    return res.status(400).json({ error: 'Missing lat, lng, or timestamp query parameters' });
  }
  try {
    const riskData = await predictiveAnalyticsService.calculateRiskScore(parseFloat(lat), parseFloat(lng), timestamp);
    if (riskData) {
      res.json(riskData);
    } else {
      res.status(500).json({ error: 'Failed to calculate risk score' });
    }
  } catch (err) {
    console.error('Error in predictive risk endpoint:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`SafeDrive backend running on port ${PORT}`);
});

// Add API endpoint to run seeders remotely (protected by API key)
const { exec } = require('child_process');
app.post('/api/run-seeders', requireApiKey, (req, res) => {
  exec('npx sequelize-cli db:seed:all', (error, stdout, stderr) => {
    if (error) {
      console.error(`Seeder execution error: ${error.message}`);
      return res.status(500).json({ error: 'Seeder execution failed', details: error.message });
    }
    if (stderr) {
      console.error(`Seeder execution stderr: ${stderr}`);
    }
    console.log(`Seeder execution stdout: ${stdout}`);
    res.json({ status: 'ok', message: 'Seeders executed successfully' });
  });
});

// Centralized error-handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack || err);
  errorLogStream.write(`[${new Date().toISOString()}] Unhandled error: ${err.stack || err}\n`);
  res.status(500).json({ error: 'Internal server error' });
});
