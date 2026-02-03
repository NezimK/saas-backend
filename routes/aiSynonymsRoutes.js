const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET /api/ai/unclear-responses - Liste les réponses floues non résolues
router.get('/unclear-responses', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('ai_unclear_responses')
      .select(`
        *,
        leads (first_name, last_name, phone)
      `)
      .eq('is_resolved', false)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching unclear responses:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/ai/promote-to-synonym - Promouvoir une unclear_response en synonyme
router.post('/promote-to-synonym', async (req, res) => {
  try {
    const { unclear_response_id, category, value, confidence = 1.0 } = req.body;

    if (!unclear_response_id || !category || !value) {
      return res.status(400).json({
        error: 'unclear_response_id, category et value sont requis'
      });
    }

    // 1. Récupérer la unclear_response
    const { data: unclearResponse, error: fetchError } = await supabase
      .from('ai_unclear_responses')
      .select('*')
      .eq('id', unclear_response_id)
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
    console.error('Error promoting to synonym:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/ai/dismiss-unclear - Rejeter une unclear_response (faux positif)
router.post('/dismiss-unclear', async (req, res) => {
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
      .eq('id', unclear_response_id);

    if (error) throw error;

    res.json({ success: true, message: 'Réponse rejetée' });

  } catch (error) {
    console.error('Error dismissing unclear response:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/ai/synonyms - Liste tous les synonymes actifs
router.get('/synonyms', async (req, res) => {
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
    console.error('Error fetching synonyms:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/ai/synonyms/:id - Désactiver un synonyme
router.delete('/synonyms/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('ai_synonyms')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true, message: 'Synonyme désactivé' });
  } catch (error) {
    console.error('Error deleting synonym:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
