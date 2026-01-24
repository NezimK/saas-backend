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
    'https://dashboard.emkai.fr', // Dashboard prod
    process.env.DASHBOARD_URL     // URL configurable
  ].filter(Boolean),
  credentials: true
}));
app.use(express.json());
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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Backend SaaS opérationnel' });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
  console.log(`📡 Endpoint onboarding: http://localhost:${PORT}/api/onboarding/create-tenant`);
  console.log(`📧 OAuth Gmail: http://localhost:${PORT}/auth/gmail/connect?tenantId=XXX`);
});