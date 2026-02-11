/**
 * Routes protégées pour les leads
 * CRUD avec isolation par tenant et contrôle d'accès par rôle
 *
 * Colonnes Supabase: assigned_agent, status, pause_ai, visit_date, assigned_date
 */

const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middlewares/authMiddleware');
const supabaseService = require('../services/supabaseService');
const logger = require('../services/logger');

// Toutes les routes nécessitent une authentification
router.use(authMiddleware);

/**
 * Récupère les détails d'un bien depuis la table biens
 * @param {string} propertyReference - La référence du bien
 * @param {string} clientId - L'ID du tenant
 * @returns {Object|null} Les détails du bien
 */
async function fetchBienForLead(propertyReference, clientId) {
  if (!propertyReference || !clientId) return null;

  const cleanRef = propertyReference.trim();

  // Chercher par ref_externe
  let { data, error } = await supabaseService.supabase
    .from('biens')
    .select('id, ref_externe, titre, adresse, code_postal, ville, type_bien, prix_vente, loyer, surface, nb_pieces, netty_id')
    .eq('client_id', clientId)
    .eq('ref_externe', cleanRef)
    .limit(1);

  // Fallback : chercher par netty_id
  if (!error && (!data || data.length === 0)) {
    const result = await supabaseService.supabase
      .from('biens')
      .select('id, ref_externe, titre, adresse, code_postal, ville, type_bien, prix_vente, loyer, surface, nb_pieces, netty_id')
      .eq('client_id', clientId)
      .eq('netty_id', cleanRef)
      .limit(1);
    data = result.data;
  }

  return (data && data.length > 0) ? data[0] : null;
}

/**
 * GET /api/leads
 * Récupère tous les leads du tenant avec les détails des biens
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
      query = query.or(`assigned_agent.is.null,assigned_agent.eq.${req.user.name}`);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('leads', 'Erreur recuperation leads', error.message);
      return res.status(500).json({ success: false, error: error.message });
    }

    // Enrichir chaque lead avec les détails du bien
    const enrichedLeads = await Promise.all(
      data.map(async (lead) => {
        if (lead.property_reference) {
          lead.bien = await fetchBienForLead(lead.property_reference, req.user.tenantId);
        }
        return lead;
      })
    );

    res.json({
      success: true,
      leads: enrichedLeads,
      count: enrichedLeads.length
    });
  } catch (error) {
    logger.error('leads', 'Erreur /api/leads', error.message);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * GET /api/leads/:id
 * Récupère un lead spécifique avec les détails du bien
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
    if (req.user.role === 'agent' && lead.assigned_agent && lead.assigned_agent !== req.user.name) {
      return res.status(403).json({ success: false, error: 'Accès non autorisé à ce lead' });
    }

    // Enrichir avec les détails du bien
    if (lead.property_reference) {
      lead.bien = await fetchBienForLead(lead.property_reference, req.user.tenantId);
    }

    res.json({ success: true, lead });
  } catch (error) {
    logger.error('leads', 'Erreur /api/leads/:id', error.message);
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
      .select('client_id, assigned_agent')
      .eq('id', id)
      .single();

    if (findError || !existing) {
      return res.status(404).json({ success: false, error: 'Lead non trouvé' });
    }

    if (existing.client_id !== req.user.tenantId) {
      return res.status(403).json({ success: false, error: 'Accès non autorisé' });
    }

    // Les agents ne peuvent modifier que les leads qui leur sont assignés
    if (req.user.role === 'agent' && existing.assigned_agent && existing.assigned_agent !== req.user.name) {
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
      logger.error('leads', 'Erreur mise a jour lead', error.message);
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, lead: data });
  } catch (error) {
    logger.error('leads', 'Erreur PUT /api/leads/:id', error.message);
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

    // Vérifier d'abord si le lead existe et son état actuel
    const { data: existing, error: fetchError } = await supabaseService.supabase
      .from('leads')
      .select('id, assigned_agent')
      .eq('id', id)
      .eq('client_id', req.user.tenantId)
      .single();

    if (fetchError || !existing) {
      return res.status(404).json({ success: false, error: 'Lead non trouvé' });
    }

    logger.info('leads', `[ASSIGN] existing.assigned_agent='${existing.assigned_agent}', role=${req.user.role}, assignTo=${assignTo}`);

    // Verrouillage optimiste pour les agents : refuser si déjà assigné à quelqu'un d'autre
    // Les managers peuvent toujours réassigner
    if (existing.assigned_agent && existing.assigned_agent.trim() !== '' && req.user.role !== 'manager' && req.user.role !== 'admin') {
      return res.status(409).json({ success: false, error: 'Ce dossier a déjà été pris en charge par un autre agent.' });
    }

    const { data, error } = await supabaseService.supabase
      .from('leads')
      .update({
        assigned_agent: assignTo,
        status: 'EN_DECOUVERTE',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('client_id', req.user.tenantId)
      .select()
      .single();

    if (error || !data) {
      return res.status(500).json({ success: false, error: 'Erreur lors de la mise à jour du lead' });
    }

    res.json({ success: true, lead: data, message: `Lead assigné à ${assignTo}` });
  } catch (error) {
    logger.error('leads', 'Erreur POST /api/leads/:id/assign', error.message);
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
      .select('client_id, assigned_agent')
      .eq('id', id)
      .single();

    if (!existing || existing.client_id !== req.user.tenantId) {
      return res.status(404).json({ success: false, error: 'Lead non trouvé' });
    }

    // Les agents ne peuvent désassigner que leurs propres leads
    if (req.user.role === 'agent' && existing.assigned_agent !== req.user.name) {
      return res.status(403).json({ success: false, error: 'Vous ne pouvez désassigner que vos propres leads' });
    }

    // Étape 1 : Retirer l'agent
    const { error: error1 } = await supabaseService.supabase
      .from('leads')
      .update({
        assigned_agent: null,
        assigned_date: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('client_id', req.user.tenantId);

    if (error1) {
      logger.error('leads', `[UNASSIGN] Erreur étape 1: ${error1.message}`);
      return res.status(500).json({ success: false, error: error1.message });
    }

    // Étape 2 : Remettre le status à QUALIFIED via SQL brut (contourne trigger éventuel)
    const { data: rpcResult, error: error2 } = await supabaseService.supabase
      .rpc('exec_sql', {
        sql_query: `UPDATE leads SET status = 'QUALIFIED' WHERE id = '${id}' AND client_id = '${req.user.tenantId}' RETURNING id, status;`
      });

    logger.info('leads', `[UNASSIGN] SQL brut result: ${JSON.stringify(rpcResult)}, error: ${JSON.stringify(error2)}`);

    if (error2) {
      logger.error('leads', `[UNASSIGN] Erreur étape 2 (status): ${error2.message}`);
    }

    // Récupérer le lead mis à jour
    const { data, error } = await supabaseService.supabase
      .from('leads')
      .select('*')
      .eq('id', id)
      .eq('client_id', req.user.tenantId)
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    logger.info('leads', `[UNASSIGN] Lead ${id} désassigné, status=${data.status}, assigned_agent=${data.assigned_agent}`);
    res.json({ success: true, lead: data, message: 'Lead désassigné' });
  } catch (error) {
    logger.error('leads', 'Erreur POST /api/leads/:id/unassign', error.message);
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
        pause_ai: stopAi,
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
    logger.error('leads', 'Erreur POST /api/leads/:id/toggle-ai', error.message);
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
      .select('status, score, assigned_agent')
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
      stats.byStatus[lead.status] = (stats.byStatus[lead.status] || 0) + 1;

      // Par score
      if (lead.score) {
        stats.byScore[lead.score] = (stats.byScore[lead.score] || 0) + 1;
      }

      // Par agent
      if (lead.assigned_agent) {
        stats.byAgent[lead.assigned_agent] = (stats.byAgent[lead.assigned_agent] || 0) + 1;
      } else {
        stats.unassigned++;
      }
    });

    res.json({ success: true, stats });
  } catch (error) {
    logger.error('leads', 'Erreur GET /api/leads/stats/summary', error.message);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

module.exports = router;
