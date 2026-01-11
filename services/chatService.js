/**
 * Service Chat Completion + RAG - Bot Qualification
 *
 * Gère la qualification de leads via WhatsApp avec OpenAI Chat Completion
 * Remplace OpenAI Assistant API pour plus de contrôle et moins de latence
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

// Configuration
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Fonction principale: Gérer une conversation de qualification
 *
 * @param {string} tenantId - UUID du tenant
 * @param {string} leadId - UUID du lead
 * @param {string} userMessage - Message du client WhatsApp
 * @returns {Promise<{type: string, message: string|null, score: string|null, metadata: object}>}
 */
async function chat(tenantId, leadId, userMessage) {
  try {
    console.log(`[Chat] Tenant: ${tenantId}, Lead: ${leadId}`);

    // 1. Récupérer le lead
    const lead = await getLead(leadId, tenantId);
    if (!lead) {
      throw new Error(`Lead ${leadId} introuvable`);
    }

    // 2. Vérifier PAUSE_IA (agent humain a pris le relais)
    if (lead.pause_ia) {
      console.log('[Chat] PAUSE_IA activée - sauvegarde message uniquement');
      await saveUserMessageOnly(leadId, userMessage);
      return {
        success: true,
        type: 'PAUSED',
        message: null
      };
    }

    // 3. Vérifier si déjà qualifié
    if (lead.statut === 'Qualifié') {
      console.log('[Chat] Lead déjà qualifié - sauvegarde message uniquement');
      await saveUserMessageOnly(leadId, userMessage);
      return {
        success: true,
        type: 'ALREADY_QUALIFIED',
        message: null
      };
    }

    // 4. Récupérer données nécessaires en parallèle
    const [tenant, property, history] = await Promise.all([
      getTenant(tenantId),
      getPropertyForLead(leadId, tenantId),
      getConversationHistory(leadId, 10)
    ]);

    if (!tenant) {
      throw new Error(`Tenant ${tenantId} introuvable`);
    }

    // 5. Vérifier quota mensuel
    await checkQuota(tenant);

    // 6. Construire prompt système avec contexte de qualification
    const systemPrompt = buildQualificationPrompt(tenant, property, lead);

    // 7. Construire messages pour OpenAI
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: userMessage }
    ];

    console.log(`[Chat] Appel OpenAI: ${messages.length} messages, modèle: ${tenant.openai_model || 'gpt-4o-mini'}`);

    // 8. Appel OpenAI Chat Completion
    const startTime = Date.now();
    const response = await openai.chat.completions.create({
      model: tenant.openai_model || 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_tokens: 500
    });

    const latency = Date.now() - startTime;
    const aiResponse = response.choices[0].message.content;

    console.log(`[Chat] Réponse reçue en ${latency}ms`);

    // 9. Parser la réponse et extraire les données de qualification
    const extracted = parseQualificationResponse(aiResponse, lead);

    // 10. Détection fin de qualification
    const isQualified = extracted.qualification_complete ||
                       (extracted.projet && extracted.financement && extracted.delai);

    if (isQualified) {
      // Qualification terminée
      const score = calculateScore(extracted.financement, extracted.delai);
      const finalMessage = getFinalMessage(score, lead.prenom);

      console.log(`[Chat] Qualification terminée - Score: ${score}`);

      // Sauvegarder avec fin de qualification
      await saveQualifiedConversation(leadId, tenantId, userMessage, finalMessage, {
        score,
        projet: extracted.projet,
        financement: extracted.financement,
        delai: extracted.delai,
        summary: buildSummary(lead, property, extracted)
      });

      // Incrémenter usage
      await incrementUsage(tenantId);

      return {
        success: true,
        type: 'QUALIFIED',
        message: finalMessage,
        score,
        metadata: {
          projet: extracted.projet,
          financement: extracted.financement,
          delai: extracted.delai,
          qualification_complete: true
        }
      };

    } else {
      // Conversation en cours
      console.log('[Chat] Conversation en cours');

      // Sauvegarder conversation
      await saveOngoingConversation(leadId, tenantId, userMessage, extracted.message, {
        projet: extracted.projet,
        financement: extracted.financement,
        delai: extracted.delai
      });

      // Incrémenter usage
      await incrementUsage(tenantId);

      return {
        success: true,
        type: 'MESSAGE',
        message: extracted.message,
        score: null,
        metadata: {
          projet: extracted.projet,
          financement: extracted.financement,
          delai: extracted.delai,
          qualification_complete: false
        }
      };
    }

  } catch (error) {
    console.error('[Chat] Erreur:', error.message);
    throw error;
  }
}

/**
 * Construire le prompt de qualification avec persistance des valeurs
 */
function buildQualificationPrompt(tenant, property, lead) {
  const agentName = tenant.agent_name || 'Sarah';
  const companyName = tenant.company_name || 'notre agence';
  const prenom = lead.prenom || 'le prospect';

  // Récupération valeurs existantes (PERSISTANCE)
  const projet = lead.projet || 'NON_DETECTÉ';
  const financement = lead.financement || 'NON_DETECTÉ';
  const delai = lead.delai || 'NON_DETECTÉ';

  let prompt = `Tu es ${agentName}, assistante virtuelle immobilière de ${companyName}.

**Ton rôle:** Qualifier ce lead via conversation naturelle WhatsApp.

`;

  // Contexte du bien
  if (property) {
    prompt += `**CONTEXTE DU BIEN:**
<BIEN>
Référence: ${property.reference}
Type: ${property.type_bien || 'Non spécifié'}
Offre: ${property.type_offre === '1' ? 'Vente' : 'Location'}
Prix: ${property.price ? property.price.toLocaleString('fr-FR') + '€' : 'Non communiqué'}
Surface: ${property.surface ? property.surface + 'm²' : 'Non communiqué'}
Description: ${property.description || 'Aucune description'}
</BIEN>

`;
  }

  prompt += `**ÉTAT QUALIFICATION ACTUEL:**
- Projet: ${projet}
- Financement: ${financement}
- Timing: ${delai}

**IMPORTANT:** Si une info est différente de NON_DETECTÉ, elle est déjà collectée, ne la redemande pas et passe à la suivante.

**OBJECTIF:** Collecter les 3 informations manquantes (NON_DETECTÉ):

1. **Projet** (si NON_DETECTÉ):
   - "Investissement locatif" → investissement
   - "Habitation principale" → habitation
   - Détecte dans réponses naturelles

2. **Financement** (si NON_DETECTÉ):
   - "Validé" ou "Cash" → financement validé ou comptant
   - "En cours" → dossier en cours
   - "Non" ou "Refusé" → pas de financement

3. **Timing** (si NON_DETECTÉ):
   - "< 4 mois" → timing immédiat
   - "4-12 mois" → timing moyen terme
   - "> 12 mois" → timing long terme

**INSTRUCTIONS:**
- Pose 1 question à la fois, naturellement
- Style SMS WhatsApp (court, 2-3 phrases max)
- Détecte les infos dans les réponses naturelles du client
- Adapte ton ton au client (tu/vous selon son langage)
- Ne redemande JAMAIS une info déjà collectée (différente de NON_DETECTÉ)
- Quand les 3 infos sont collectées → qualification_complete = true

**FORMAT RÉPONSE (JSON STRICT):**
{
  "message": "Ton message WhatsApp ici",
  "data": {
    "projet": "valeur détectée ou null",
    "financement": "valeur détectée ou null",
    "timing": "valeur détectée ou null"
  },
  "qualification_complete": false
}

**EXEMPLES:**

Client: "Bonjour, je suis intéressé par ce bien"
Réponse:
{
  "message": "Bonjour ${prenom} ! C'est pour investir ou pour y habiter vous-même ?",
  "data": {
    "projet": null,
    "financement": null,
    "timing": null
  },
  "qualification_complete": false
}

Client: "Pour y habiter"
Réponse:
{
  "message": "Parfait ! Avez-vous déjà un financement validé ou un apport ?",
  "data": {
    "projet": "Habitation principale",
    "financement": null,
    "timing": null
  },
  "qualification_complete": false
}

Client: "Oui, financement validé pour 300k"
Réponse:
{
  "message": "Super ! Quel est votre timing idéal pour emménager ?",
  "data": {
    "projet": "Habitation principale",
    "financement": "Validé",
    "timing": null
  },
  "qualification_complete": false
}

Client: "Dans 2 mois"
Réponse:
{
  "message": "Parfait ! Je transmets votre dossier prioritaire à mon agent.",
  "data": {
    "projet": "Habitation principale",
    "financement": "Validé",
    "timing": "< 4 mois"
  },
  "qualification_complete": true
}

Retourne UNIQUEMENT du JSON valide, rien d'autre.
`;

  return prompt;
}

/**
 * Parser la réponse de l'IA et extraire les données de qualification
 */
function parseQualificationResponse(aiResponse, lead) {
  try {
    // Extraire le JSON de la réponse
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        message: parsed.message || aiResponse,
        projet: parsed.data?.projet || lead.projet || null,
        financement: parsed.data?.financement || lead.financement || null,
        delai: parsed.data?.timing || lead.delai || null,
        qualification_complete: parsed.qualification_complete || false
      };
    }
  } catch (e) {
    console.warn('[parseQualificationResponse] Erreur parsing JSON:', e.message);
  }

  // Fallback: retourner message brut
  return {
    message: aiResponse,
    projet: lead.projet || null,
    financement: lead.financement || null,
    delai: lead.delai || null,
    qualification_complete: false
  };
}

/**
 * Calculer le score selon les règles métier
 */
function calculateScore(financement, delai) {
  const fin = (financement || '').toUpperCase();
  const del = (delai || '').toUpperCase();

  // CHAUD: Financement VALIDÉ/CASH + Délai < 4 mois
  if ((fin.includes('VALID') || fin.includes('CASH')) && del.includes('< 4')) {
    return 'CHAUD';
  }

  // FROID: Financement NON/REFUSÉ
  if (fin.includes('NON') || fin.includes('REFUS')) {
    return 'FROID';
  }

  // TIEDE: Autres cas
  return 'TIEDE';
}

/**
 * Message final personnalisé selon le score
 */
function getFinalMessage(score, prenom = 'le prospect') {
  if (score === 'CHAUD') {
    return `Parfait ${prenom} ! Je transmets votre dossier prioritaire à mon agent. Il vous contactera d'ici peu pour programmer une visite. 🔥`;
  } else {
    return `C'est noté ${prenom} ! Je transmets votre dossier à nos agents. Ils reviendront vers vous rapidement.`;
  }
}

/**
 * Construire le résumé pour l'agent
 */
function buildSummary(lead, property, extracted) {
  const prenom = lead.prenom || 'Le prospect';
  const bien = property ? `${property.type_bien} - ${property.reference}` : 'ce bien';
  const projet = extracted.projet || 'Non précisé';
  const financement = extracted.financement || 'Non précisé';
  const delai = extracted.delai || 'Non précisé';

  return `${prenom} est intéressé par ${bien}. Projet: ${projet}. Financement: ${financement}. Timing: ${delai}.`;
}

/**
 * Sauvegarder message client uniquement (PAUSE_IA ou déjà qualifié)
 */
async function saveUserMessageOnly(leadId, userMessage) {
  const lead = await getLead(leadId);
  if (!lead) return;

  let history = JSON.parse(lead.conversation_json || '[]');

  history.push({
    role: 'user',
    text: userMessage,
    time: new Date().toISOString()
  });

  const { error } = await supabase
    .from('leads')
    .update({ conversation_json: JSON.stringify(history) })
    .eq('id', leadId);

  if (error) {
    console.error('[saveUserMessageOnly] Erreur:', error.message);
  }
}

/**
 * Sauvegarder conversation qualifiée (fin de qualification)
 */
async function saveQualifiedConversation(leadId, tenantId, userMessage, aiMessage, data) {
  const lead = await getLead(leadId, tenantId);
  if (!lead) return;

  let history = JSON.parse(lead.conversation_json || '[]');

  // Message user
  history.push({
    role: 'user',
    text: userMessage,
    time: new Date().toISOString()
  });

  // Message assistant (fin)
  history.push({
    role: 'assistant',
    text: aiMessage,
    time: new Date().toISOString()
  });

  // Marker système
  history.push({
    role: 'system',
    text: `--- QUALIFICATION TERMINÉE (${data.score}) ---`,
    time: new Date().toISOString()
  });

  const { error } = await supabase
    .from('leads')
    .update({
      conversation_json: JSON.stringify(history),
      statut: 'Qualifié',
      score: data.score,
      projet: data.projet,
      financement: data.financement,
      delai: data.delai,
      notes: data.summary,
      pause_ia: false,
      last_message_at: new Date().toISOString()
    })
    .eq('id', leadId);

  if (error) {
    console.error('[saveQualifiedConversation] Erreur:', error.message);
    throw error;
  }

  console.log(`[saveQualifiedConversation] Lead ${leadId} qualifié: ${data.score}`);
}

/**
 * Sauvegarder conversation en cours
 */
async function saveOngoingConversation(leadId, tenantId, userMessage, aiMessage, data) {
  const lead = await getLead(leadId, tenantId);
  if (!lead) return;

  let history = JSON.parse(lead.conversation_json || '[]');

  history.push({
    role: 'user',
    text: userMessage,
    time: new Date().toISOString()
  });

  history.push({
    role: 'assistant',
    text: aiMessage,
    time: new Date().toISOString()
  });

  const updateData = {
    conversation_json: JSON.stringify(history),
    statut: 'En_Cours',
    pause_ia: false,
    last_message_at: new Date().toISOString()
  };

  // Mettre à jour les champs seulement s'ils sont collectés
  if (data.projet) updateData.projet = data.projet;
  if (data.financement) updateData.financement = data.financement;
  if (data.delai) updateData.delai = data.delai;

  const { error } = await supabase
    .from('leads')
    .update(updateData)
    .eq('id', leadId);

  if (error) {
    console.error('[saveOngoingConversation] Erreur:', error.message);
    throw error;
  }
}

/**
 * Récupérer historique conversation (format OpenAI)
 */
async function getConversationHistory(leadId, limit = 10) {
  const lead = await getLead(leadId);
  if (!lead) return [];

  const history = JSON.parse(lead.conversation_json || '[]');

  // Retourner les N derniers messages (user + assistant uniquement)
  return history
    .filter(msg => msg.role === 'user' || msg.role === 'assistant')
    .slice(-limit)
    .map(msg => ({
      role: msg.role,
      content: msg.text
    }));
}

/**
 * Récupérer un tenant depuis Supabase
 */
async function getTenant(tenantId) {
  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('tenant_id', tenantId)
    .single();

  if (error) {
    console.error('[getTenant] Erreur:', error.message);
    return null;
  }

  return data;
}

/**
 * Récupérer un lead depuis Supabase avec sécurité multi-tenant
 */
async function getLead(leadId, tenantId = null) {
  let query = supabase
    .from('leads')
    .select('*')
    .eq('id', leadId);

  // Sécurité multi-tenant si tenantId fourni
  if (tenantId) {
    query = query.eq('tenant_id', tenantId);
  }

  const { data, error } = await query.single();

  if (error) {
    console.error('[getLead] Erreur:', error.message);
    return null;
  }

  return data;
}

/**
 * Récupérer les infos du bien associé au lead
 */
async function getPropertyForLead(leadId, tenantId) {
  const lead = await getLead(leadId, tenantId);
  if (!lead || !lead.bien_associe) {
    return null;
  }

  const { data, error } = await supabase
    .from('biens')
    .select('*')
    .eq('reference', lead.bien_associe)
    .eq('tenant_id', tenantId)  // Sécurité multi-tenant
    .single();

  if (error) {
    console.error('[getPropertyForLead] Erreur:', error.message);
    return null;
  }

  return data;
}

/**
 * Vérifier le quota mensuel du tenant
 */
async function checkQuota(tenant) {
  if (!tenant.monthly_conversation_limit) {
    return; // Pas de limite
  }

  const currentUsage = tenant.current_month_usage || 0;

  if (currentUsage >= tenant.monthly_conversation_limit) {
    throw new Error('QUOTA_EXCEEDED');
  }
}

/**
 * Incrémenter le compteur d'usage mensuel
 */
async function incrementUsage(tenantId) {
  const { data: tenant } = await supabase
    .from('tenants')
    .select('current_month_usage')
    .eq('tenant_id', tenantId)
    .single();

  if (tenant) {
    await supabase
      .from('tenants')
      .update({
        current_month_usage: (tenant.current_month_usage || 0) + 1
      })
      .eq('tenant_id', tenantId);
  }
}

/**
 * Réinitialiser l'usage mensuel de tous les tenants (CRON mensuel)
 */
async function resetMonthlyUsage() {
  const { error } = await supabase
    .from('tenants')
    .update({ current_month_usage: 0 })
    .neq('tenant_id', '00000000-0000-0000-0000-000000000000');

  if (error) {
    console.error('[resetMonthlyUsage] Erreur:', error.message);
    throw error;
  }

  console.log('[resetMonthlyUsage] Usage réinitialisé pour tous les tenants');
}

module.exports = {
  chat,
  resetMonthlyUsage,
  getTenant,
  getLead,
  getConversationHistory
};
