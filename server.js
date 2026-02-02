const express = require('express');
const cors = require('cors');
require('dotenv').config();

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

const app = express();
const PORT = process.env.PORT || 3000;

// Test de connexion n8n au démarrage
const axios = require('axios');
axios.get(`${process.env.N8N_API_URL}/workflows`, {
  headers: { 'X-N8N-API-KEY': process.env.N8N_API_KEY }
})
.then(() => console.log('✅ Connexion n8n OK'))
.catch(err => console.error('❌ Erreur connexion n8n:', err.response?.data || err.message));

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173',      // Dashboard dev (Vite)
    'http://localhost:3001',      // Dashboard server
    'http://127.0.0.1:5500',      // Live Server VSCode
    'http://localhost:5500',      // Live Server VSCode (alt)
    'http://127.0.0.1:5501',      // Live Server VSCode (autre port)
    'http://localhost:5501',      // Live Server VSCode (autre port alt)
    'https://dashboard.emkai.fr', // Dashboard prod
    'https://www.emkai.fr',       // Site marketing
    'http://www.emkai.fr',        // Site marketing HTTP
    'https://emkai.fr',           // Site marketing sans www
    'http://emkai.fr',            // Site marketing sans www HTTP
    /^http:\/\/192\.168\.\d+\.\d+:\d+$/, // Réseau local (test mobile)
    process.env.DASHBOARD_URL,    // URL configurable
    process.env.FRONTEND_URL      // Site marketing configurable
  ].filter(Boolean),
  credentials: true
}));

// IMPORTANT: Le webhook Stripe doit recevoir le body brut AVANT express.json()
// Le middleware express.raw est appliqué directement dans stripeRoutes.js pour /webhook
app.use((req, res, next) => {
  if (req.originalUrl === '/api/stripe/webhook') {
    next(); // Skip express.json() for Stripe webhook
  } else {
    express.json()(req, res, next);
  }
});

app.use(express.static('public')); // Servir les fichiers statiques (onboarding.html)

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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Backend SaaS opérationnel' });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
  console.log(`📡 Endpoint onboarding: http://localhost:${PORT}/api/onboarding/create-tenant`);
  console.log(`📧 OAuth Gmail: http://localhost:${PORT}/auth/gmail/connect?tenantId=XXX`);
  console.log(`📅 OAuth Google Calendar: http://localhost:${PORT}/api/auth/google/callback`);
  console.log(`📅 OAuth Outlook Calendar: http://localhost:${PORT}/api/auth/outlook/callback`);
});