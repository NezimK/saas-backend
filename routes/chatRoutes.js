/**
 * Routes API pour Chat Completion + RAG
 */

const express = require('express');
const router = express.Router();
const chatService = require('../services/chatService');

/**
 * POST /api/chat
 *
 * Endpoint principal pour les conversations WhatsApp
 * Appelé par n8n workflow
 *
 * Body:
 * {
 *   "tenant_id": "uuid",
 *   "lead_id": "uuid",
 *   "message": "Message du client WhatsApp"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "Réponse de l'IA",
 *   "score": "CHAUD|TIEDE|FROID|null",
 *   "metadata": {
 *     "tokens": 1234,
 *     "latency_ms": 1500,
 *     "model": "gpt-4o-mini"
 *   }
 * }
 */
router.post('/', async (req, res) => {
  try {
    const { tenant_id, lead_id, message } = req.body;

    // Validation
    if (!tenant_id || !lead_id || !message) {
      return res.status(400).json({
        success: false,
        error: 'Paramètres manquants: tenant_id, lead_id, message requis'
      });
    }

    console.log(`[API /chat] Tenant: ${tenant_id}, Lead: ${lead_id}`);

    // Appel du service chat
    const result = await chatService.chat(tenant_id, lead_id, message);

    return res.json({
      success: true,
      message: result.message,
      score: result.score,
      metadata: result.metadata
    });

  } catch (error) {
    console.error('[API /chat] Erreur:', error.message);

    // Gestion des erreurs spécifiques
    if (error.message === 'QUOTA_EXCEEDED') {
      return res.status(429).json({
        success: false,
        error: 'Quota mensuel de conversations dépassé',
        message: 'Veuillez upgrader votre plan ou contacter le support'
      });
    }

    // Erreur générique
    return res.status(500).json({
      success: false,
      error: 'Erreur lors du traitement de la conversation',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/chat/history/:leadId
 *
 * Récupérer l'historique de conversation d'un lead
 *
 * Params:
 * - leadId: UUID du lead
 *
 * Query:
 * - limit: Nombre de messages (default: 20)
 *
 * Response:
 * {
 *   "success": true,
 *   "history": [
 *     { "role": "user", "content": "...", "created_at": "..." },
 *     { "role": "assistant", "content": "...", "created_at": "..." }
 *   ],
 *   "total": 15
 * }
 */
router.get('/history/:leadId', async (req, res) => {
  try {
    const { leadId } = req.params;
    const limit = parseInt(req.query.limit) || 20;

    if (!leadId) {
      return res.status(400).json({
        success: false,
        error: 'leadId requis'
      });
    }

    const history = await chatService.getConversationHistory(leadId, limit);

    return res.json({
      success: true,
      history,
      total: history.length
    });

  } catch (error) {
    console.error('[API /chat/history] Erreur:', error.message);

    return res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération de l\'historique'
    });
  }
});

/**
 * POST /api/chat/reset-usage
 *
 * Réinitialiser l'usage mensuel de tous les tenants (CRON)
 *
 * Headers:
 * - X-Cron-Secret: Secret pour sécuriser l'endpoint
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "Usage mensuel réinitialisé"
 * }
 */
router.post('/reset-usage', async (req, res) => {
  try {
    // Sécurité: Vérifier un secret pour les CRON
    const cronSecret = req.headers['x-cron-secret'];

    if (cronSecret !== process.env.CRON_SECRET) {
      return res.status(401).json({
        success: false,
        error: 'Non autorisé'
      });
    }

    await chatService.resetMonthlyUsage();

    return res.json({
      success: true,
      message: 'Usage mensuel réinitialisé pour tous les tenants'
    });

  } catch (error) {
    console.error('[API /chat/reset-usage] Erreur:', error.message);

    return res.status(500).json({
      success: false,
      error: 'Erreur lors de la réinitialisation'
    });
  }
});

/**
 * GET /api/chat/test
 *
 * Endpoint de test pour vérifier que le service fonctionne
 */
router.get('/test', async (req, res) => {
  try {
    // Vérifier qu'OpenAI API key est configurée
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your-openai-api-key-here') {
      return res.status(500).json({
        success: false,
        error: 'OPENAI_API_KEY non configurée dans .env'
      });
    }

    // Vérifier la connexion Supabase
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );

    const { data: testData, error: testError } = await supabase
      .from('conversations')
      .select('*')
      .limit(1);

    if (testError && testError.code === 'PGRST116') {
      return res.status(500).json({
        success: false,
        error: 'Table conversations non trouvée. Exécutez la migration d\'abord.'
      });
    }

    return res.json({
      success: true,
      message: 'Service chat opérationnel',
      config: {
        openai_configured: true,
        supabase_connected: true,
        conversations_table_exists: true
      }
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
