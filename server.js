const express = require('express');
require('dotenv').config();

const onboardingRoutes = require('./routes/onboarding');
const authRoutes = require('./routes/authRoutes');
const gmailRoutes = require('./routes/gmailRoutes');
const tokenRoutes = require('./routes/tokenRoutes');

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
app.use(express.json());

// Routes
app.use('/api/onboarding', onboardingRoutes);
app.use('/auth', authRoutes);
app.use('/api/gmail', gmailRoutes);
app.use('/api/token', tokenRoutes);

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