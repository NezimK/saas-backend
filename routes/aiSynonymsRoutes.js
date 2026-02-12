const express = require('express');
const router = express.Router();
const supabaseService = require('../services/supabaseService');
const { authMiddleware } = require('../middlewares/authMiddleware');
const logger = require('../services/logger');
const supabase = supabaseService.adminSupabase || supabaseService.supabase;

// GET /api/ai/unclear-responses - Liste les réponses floues non résolues
router.get('/unclear-responses', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('ai_unclear_responses')
      .select(`
        *,
        leads (first_name, last_name, phone)
      `)
      .eq('client_id', req.user.tenantId)
      .eq('is_resolved', false)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    logger.error('ai-synonyms', 'Error fetching unclear responses', error.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/ai/promote-to-synonym - Promouvoir une unclear_response en synonyme
router.post('/promote-to-synonym', authMiddleware, async (req, res) => {
  try {
    const { unclear_response_id, category, value, confidence = 1.0 } = req.body;

    if (!unclear_response_id || !category || !value) {
      return res.status(400).json({
        error: 'unclear_response_id, category et value sont requis'
      });
    }

    // 1. Récupérer la unclear_response (filtrée par tenant)
    const { data: unclearResponse, error: fetchError } = await supabase
      .from('ai_unclear_responses')
      .select('*')
      .eq('id', unclear_response_id)
      .eq('client_id', req.user.tenantId)
      .single();

    if (fetchError || !unclearResponse) {
      return res.status(404).json({ error: 'Unclear response non trouvée' });
    }

    // 2. Insérer ou mettre à jour dans ai_synonyms
    const { data: synonym, error: insertError } = await supabase
      .from('ai_synonyms')
      .upsert({
        input: unclearResponse.input.toLowerCase().trim(),
        category: category.toUpperCase(),
        value: value,
        confidence: confidence,
        is_active: true,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'input,category'
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // 3. Marquer la unclear_response comme résolue
    const { error: updateError } = await supabase
      .from('ai_unclear_responses')
      .update({
        is_resolved: true,
        resolution_value: value,
        resolved_at: new Date().toISOString()
      })
      .eq('id', unclear_response_id);

    if (updateError) throw updateError;

    res.json({
      success: true,
      message: `"${unclearResponse.input}" ajouté comme synonyme de ${value} pour ${category}`,
      synonym: synonym
    });

  } catch (error) {
    logger.error('ai-synonyms', 'Error promoting to synonym', error.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/ai/dismiss-unclear - Rejeter une unclear_response (faux positif)
router.post('/dismiss-unclear', authMiddleware, async (req, res) => {
  try {
    const { unclear_response_id } = req.body;

    if (!unclear_response_id) {
      return res.status(400).json({ error: 'unclear_response_id requis' });
    }

    const { error } = await supabase
      .from('ai_unclear_responses')
      .update({
        is_resolved: true,
        resolution_value: 'DISMISSED',
        resolved_at: new Date().toISOString()
      })
      .eq('id', unclear_response_id)
      .eq('client_id', req.user.tenantId);

    if (error) throw error;

    res.json({ success: true, message: 'Réponse rejetée' });

  } catch (error) {
    logger.error('ai-synonyms', 'Error dismissing unclear response', error.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/ai/synonyms - Liste tous les synonymes actifs
router.get('/synonyms', authMiddleware, async (req, res) => {
  try {
    const { category } = req.query;

    let query = supabase
      .from('ai_synonyms')
      .select('*')
      .eq('is_active', true)
      .order('usage_count', { ascending: false });

    if (category) {
      query = query.eq('category', category.toUpperCase());
    }

    const { data, error } = await query;

    if (error) throw error;
    res.json(data);
  } catch (error) {
    logger.error('ai-synonyms', 'Error fetching synonyms', error.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/ai/synonyms/:id - Désactiver un synonyme
router.delete('/synonyms/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('ai_synonyms')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true, message: 'Synonyme désactivé' });
  } catch (error) {
    logger.error('ai-synonyms', 'Error deleting synonym', error.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
