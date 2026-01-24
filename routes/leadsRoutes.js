/**
 * Routes protégées pour les leads
 * CRUD avec isolation par tenant et contrôle d'accès par rôle
 */

const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middlewares/authMiddleware');
const supabaseService = require('../services/supabaseService');

// Toutes les routes nécessitent une authentification
router.use(authMiddleware);

/**
 * GET /api/leads
 * Récupère tous les leads du tenant
 * - Agent: voit les leads qui lui sont assignés + les non assignés
 * - Manager/Admin: voit tous les leads du tenant
 */
router.get('/', async (req, res) => {
  try {
    let query = supabaseService.supabase
      .from('leads')
      .select('*')
      .eq('client_id', req.user.tenantId)
      .order('created_at', { ascending: false });

    // Filtrage par rôle - les agents ne voient que leurs leads ou les non assignés
    if (req.user.role === 'agent') {
      query = query.or(`agent_en_charge.is.null,agent_en_charge.eq.${req.user.name}`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erreur récupération leads:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({
      success: true,
      leads: data,
      count: data.length
    });
  } catch (error) {
    console.error('Erreur /api/leads:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * GET /api/leads/:id
 * Récupère un lead spécifique
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: lead, error } = await supabaseService.supabase
      .from('leads')
      .select('*')
      .eq('id', id)
      .eq('client_id', req.user.tenantId)
      .single();

    if (error || !lead) {
      return res.status(404).json({ success: false, error: 'Lead non trouvé' });
    }

    // Vérifier l'accès pour les agents
    if (req.user.role === 'agent' && lead.agent_en_charge && lead.agent_en_charge !== req.user.name) {
      return res.status(403).json({ success: false, error: 'Accès non autorisé à ce lead' });
    }

    res.json({ success: true, lead });
  } catch (error) {
    console.error('Erreur /api/leads/:id:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * PUT /api/leads/:id
 * Met à jour un lead
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Vérifier que le lead appartient au tenant
    const { data: existing, error: findError } = await supabaseService.supabase
      .from('leads')
      .select('client_id, agent_en_charge')
      .eq('id', id)
      .single();

    if (findError || !existing) {
      return res.status(404).json({ success: false, error: 'Lead non trouvé' });
    }

    if (existing.client_id !== req.user.tenantId) {
      return res.status(403).json({ success: false, error: 'Accès non autorisé' });
    }

    // Les agents ne peuvent modifier que les leads qui leur sont assignés
    if (req.user.role === 'agent' && existing.agent_en_charge && existing.agent_en_charge !== req.user.name) {
      return res.status(403).json({ success: false, error: 'Accès non autorisé à ce lead' });
    }

    // Empêcher la modification de certains champs sensibles
    delete updates.id;
    delete updates.client_id;
    delete updates.tenant_id;
    delete updates.created_at;

    const { data, error } = await supabaseService.supabase
      .from('leads')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('client_id', req.user.tenantId)
      .select()
      .single();

    if (error) {
      console.error('Erreur mise à jour lead:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, lead: data });
  } catch (error) {
    console.error('Erreur PUT /api/leads/:id:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * POST /api/leads/:id/assign
 * Assigne un lead à un agent
 */
router.post('/:id/assign', async (req, res) => {
  try {
    const { id } = req.params;
    const { agentName } = req.body;

    // Le nom de l'agent à assigner (ou l'utilisateur courant si non spécifié)
    const assignTo = agentName || req.user.name;

    const { data, error } = await supabaseService.supabase
      .from('leads')
      .update({
        agent_en_charge: assignTo,
        statut: 'EN_DECOUVERTE',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('client_id', req.user.tenantId)
      .select()
      .single();

    if (error) {
      console.error('Erreur assignation lead:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    if (!data) {
      return res.status(404).json({ success: false, error: 'Lead non trouvé' });
    }

    res.json({ success: true, lead: data, message: `Lead assigné à ${assignTo}` });
  } catch (error) {
    console.error('Erreur POST /api/leads/:id/assign:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * POST /api/leads/:id/unassign
 * Désassigne un lead
 */
router.post('/:id/unassign', async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier que le lead appartient au tenant et que l'utilisateur peut le désassigner
    const { data: existing } = await supabaseService.supabase
      .from('leads')
      .select('client_id, agent_en_charge')
      .eq('id', id)
      .single();

    if (!existing || existing.client_id !== req.user.tenantId) {
      return res.status(404).json({ success: false, error: 'Lead non trouvé' });
    }

    // Les agents ne peuvent désassigner que leurs propres leads
    if (req.user.role === 'agent' && existing.agent_en_charge !== req.user.name) {
      return res.status(403).json({ success: false, error: 'Vous ne pouvez désassigner que vos propres leads' });
    }

    const { data, error } = await supabaseService.supabase
      .from('leads')
      .update({
        agent_en_charge: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('client_id', req.user.tenantId)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, lead: data, message: 'Lead désassigné' });
  } catch (error) {
    console.error('Erreur POST /api/leads/:id/unassign:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * POST /api/leads/:id/toggle-ai
 * Active/désactive l'IA pour un lead
 */
router.post('/:id/toggle-ai', async (req, res) => {
  try {
    const { id } = req.params;
    const { stopAi } = req.body;

    const { data, error } = await supabaseService.supabase
      .from('leads')
      .update({
        stop_ai: stopAi,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('client_id', req.user.tenantId)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    if (!data) {
      return res.status(404).json({ success: false, error: 'Lead non trouvé' });
    }

    res.json({
      success: true,
      lead: data,
      message: stopAi ? 'IA désactivée pour ce lead' : 'IA réactivée pour ce lead'
    });
  } catch (error) {
    console.error('Erreur POST /api/leads/:id/toggle-ai:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * GET /api/leads/stats/summary
 * Statistiques des leads (managers uniquement)
 */
router.get('/stats/summary', requireRole('manager', 'admin'), async (req, res) => {
  try {
    const { data: leads, error } = await supabaseService.supabase
      .from('leads')
      .select('statut, score, agent_en_charge')
      .eq('client_id', req.user.tenantId);

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    // Calculer les statistiques
    const stats = {
      total: leads.length,
      byStatus: {},
      byScore: {},
      byAgent: {},
      unassigned: 0
    };

    leads.forEach(lead => {
      // Par statut
      stats.byStatus[lead.statut] = (stats.byStatus[lead.statut] || 0) + 1;

      // Par score
      if (lead.score) {
        stats.byScore[lead.score] = (stats.byScore[lead.score] || 0) + 1;
      }

      // Par agent
      if (lead.agent_en_charge) {
        stats.byAgent[lead.agent_en_charge] = (stats.byAgent[lead.agent_en_charge] || 0) + 1;
      } else {
        stats.unassigned++;
      }
    });

    res.json({ success: true, stats });
  } catch (error) {
    console.error('Erreur GET /api/leads/stats/summary:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

module.exports = router;
