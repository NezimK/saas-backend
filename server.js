const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const logger = require('./services/logger');
const onboardingRoutes = require('./routes/onboardingRoutes');
const authRoutes = require('./routes/authRoutes');
const gmailRoutes = require('./routes/gmailRoutes');
const tokenRoutes = require('./routes/tokenRoutes');
const syncRoutes = require('./routes/syncRoutes');
const userAuthRoutes = require('./routes/userAuthRoutes');
const leadsRoutes = require('./routes/leadsRoutes');
const usersRoutes = require('./routes/usersRoutes');
const stripeRoutes = require('./routes/stripeRoutes');
const calendarRoutes = require('./routes/calendarRoutes');
const aiSynonymsRoutes = require('./routes/aiSynonymsRoutes');

const app = express();
app.set('trust proxy', 1); // Nécessaire derrière ngrok/reverse proxy
const PORT = process.env.PORT || 3000;

// Test de connexion n8n au démarrage
const axios = require('axios');
axios.get(`${process.env.N8N_API_URL}/workflows`, {
  headers: { 'X-N8N-API-KEY': process.env.N8N_API_KEY }
})
.then(() => logger.info('server', 'Connexion n8n OK'))
.catch(err => logger.error('server', 'Erreur connexion n8n', err.response?.data || err.message));

// Middleware
const PROD_ORIGINS = [
  'https://immocopilot.emkai.fr',
  'https://www.emkai.fr',
  'https://emkai.fr',
  process.env.DASHBOARD_URL,
  process.env.FRONTEND_URL
];

const DEV_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3001',
  'http://127.0.0.1:5500',
  'http://localhost:5500',
  'http://127.0.0.1:5501',
  'http://localhost:5501',
  /^http:\/\/192\.168\.\d+\.\d+:(5173|5174|5500|5501|3001)$/,
];

app.use(cors({
  origin: [
    ...PROD_ORIGINS,
    ...(process.env.NODE_ENV === 'production' ? [] : DEV_ORIGINS)
  ].filter(Boolean),
  credentials: true
}));

// IMPORTANT: Le webhook Stripe doit recevoir le body brut AVANT express.json()
// Le middleware express.raw est appliqué directement dans stripeRoutes.js pour /webhook
app.use((req, res, next) => {
  if (req.originalUrl === '/api/stripe/webhook') {
    next(); // Skip express.json() for Stripe webhook
  } else {
    express.json({ limit: '10kb' })(req, res, next);
  }
});

app.use(express.static('public')); // Servir les fichiers statiques (onboarding.html)

// Sécurité: headers HTTP
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'", "https://*.supabase.co"],
    }
  }
}));

// Rate limiting
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, message: { error: 'Trop de tentatives, réessayez dans 15 minutes' } });
const onboardingLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 50, message: { error: 'Trop de requêtes, réessayez dans 15 minutes' } });
const chatLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, message: { error: 'Trop de requêtes chat, réessayez dans 1 minute' } });
const generalLimiter = rateLimit({ windowMs: 60 * 1000, max: 100, message: { error: 'Trop de requêtes, réessayez dans 1 minute' } });

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/refresh', authLimiter);
app.use('/api/auth/set-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);
app.use('/api/onboarding', onboardingLimiter);
app.use('/api/chat', chatLimiter);
app.use('/api', generalLimiter);

// Routes
app.use('/api/onboarding', onboardingRoutes);
app.use('/auth', authRoutes);
app.use('/api/auth', userAuthRoutes); // Authentification dashboard
app.use('/api/leads', leadsRoutes);   // CRUD leads protégé
app.use('/api/users', usersRoutes);   // Gestion utilisateurs
app.use('/api/gmail', gmailRoutes);
app.use('/api/token', tokenRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api', calendarRoutes);      // Calendar OAuth (Google, Outlook)
app.use('/api/ai', aiSynonymsRoutes); // Gestion synonymes IA

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Backend SaaS opérationnel' });
});

// Catch-all 404 (après toutes les routes)
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Global error handler (doit être le dernier middleware)
app.use((err, req, res, next) => {
  logger.error('server', `Unhandled error on ${req.method} ${req.originalUrl}`, err.message);
  res.status(err.statusCode || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Erreur serveur' : err.message
  });
});

// Démarrage du serveur
const server = app.listen(PORT, () => {
  logger.info('server', `Serveur demarre sur http://localhost:${PORT}`);
});

// Graceful shutdown
const shutdown = (signal) => {
  logger.info('server', `${signal} reçu, arrêt en cours...`);
  server.close(() => {
    logger.info('server', 'Serveur arrêté proprement');
    process.exit(0);
  });
  // Forcer l'arrêt après 10s si le serveur ne se ferme pas
  setTimeout(() => process.exit(1), 10000);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  logger.error('server', 'Uncaught exception', err.message);
  shutdown('uncaughtException');
});
process.on('unhandledRejection', (reason) => {
  logger.error('server', 'Unhandled rejection', String(reason));
  shutdown('unhandledRejection');
});