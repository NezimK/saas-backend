require('dotenv').config();
const OpenAI = require('openai');
const supabase = require('./supabaseService').supabase;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Crée un Assistant OpenAI personnalisé pour un tenant
 */
async function createAssistantForTenant(tenant) {
  try {
    console.log(`🤖 Création Assistant OpenAI pour ${tenant.email}...`);

    const assistant = await openai.beta.assistants.create({
      name: `Assistant - ${tenant.email}`,
      instructions: `Tu es Sarah, l'assistante virtuelle de l'agence immobilière.

Ton rôle:
- Répondre aux questions des prospects sur les biens immobiliers
- Qualifier les leads (investissement ou habitation principale)
- Être chaleureuse, professionnelle et concise (style SMS)
- Poser des questions de qualification pertinentes

Informations agence:
- Nom: ${tenant.company_name || tenant.email}
- Contact: ${tenant.email}

Instructions:
1. Toujours commencer par te présenter: "Sarah - Équipe Immocope"
2. Répondre précisément aux questions sur le bien
3. Qualifier le lead avec des questions contextuelles
4. Adapter ton ton selon le profil (investisseur = plus factuel, habitant = plus chaleureux)

Format de réponse: Court, direct, 2-3 phrases maximum.`,

      model: tenant.plan === 'pro' ? 'gpt-4o' : 'gpt-4o-mini',

      tools: [],

      metadata: {
        tenant_id: tenant.id,
        tenant_email: tenant.email,
        created_at: new Date().toISOString()
      }
    });

    // Sauvegarder dans Supabase
    const { error } = await supabase
      .from('tenants')
      .update({
        openai_assistant_id: assistant.id,
        openai_model: assistant.model
      })
      .eq('id', tenant.id);

    if (error) {
      console.error('❌ Erreur Supabase:', error);
      throw error;
    }

    console.log(`✅ Assistant créé: ${assistant.id}`);

    return assistant;

  } catch (error) {
    console.error('❌ Erreur création Assistant:', error);
    throw error;
  }
}

/**
 * Récupère ou crée l'Assistant d'un tenant
 */
async function getOrCreateAssistant(tenant) {
  if (tenant.openai_assistant_id) {
    try {
      // Vérifier que l'assistant existe toujours
      const assistant = await openai.beta.assistants.retrieve(
        tenant.openai_assistant_id
      );
      return assistant;
    } catch (error) {
      console.warn('⚠️  Assistant introuvable, recréation...');
      return await createAssistantForTenant(tenant);
    }
  }

  return await createAssistantForTenant(tenant);
}

/**
 * Met à jour les instructions d'un Assistant
 */
async function updateAssistantInstructions(tenant, customInstructions) {
  try {
    const assistant = await openai.beta.assistants.update(
      tenant.openai_assistant_id,
      {
        instructions: customInstructions
      }
    );

    console.log(`✅ Instructions mises à jour pour ${tenant.email}`);
    return assistant;

  } catch (error) {
    console.error('❌ Erreur mise à jour:', error);
    throw error;
  }
}

/**
 * Supprime l'Assistant d'un tenant
 */
async function deleteAssistant(tenant) {
  try {
    if (!tenant.openai_assistant_id) {
      console.log('⚠️  Pas d\'assistant à supprimer');
      return;
    }

    await openai.beta.assistants.del(tenant.openai_assistant_id);

    await supabase
      .from('tenants')
      .update({
        openai_assistant_id: null,
        openai_model: null
      })
      .eq('id', tenant.id);

    console.log(`✅ Assistant supprimé pour ${tenant.email}`);

  } catch (error) {
    console.error('❌ Erreur suppression:', error);
    throw error;
  }
}

/**
 * Tracker l'usage mensuel
 */
async function trackConversationUsage(tenantId) {
  const { data: tenant, error } = await supabase
    .from('tenants')
    .select('current_month_usage, monthly_conversation_limit')
    .eq('id', tenantId)
    .single();

  if (error) throw error;

  // Vérifier le quota
  if (tenant.current_month_usage >= tenant.monthly_conversation_limit) {
    throw new Error('QUOTA_EXCEEDED');
  }

  // Incrémenter
  await supabase
    .from('tenants')
    .update({
      current_month_usage: tenant.current_month_usage + 1
    })
    .eq('id', tenantId);
}

/**
 * Reset les compteurs mensuels (CRON job)
 */
async function resetMonthlyUsage() {
  const { error } = await supabase
    .from('tenants')
    .update({ current_month_usage: 0 })
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Tous

  if (error) {
    console.error('❌ Erreur reset usage:', error);
    throw error;
  }

  console.log('✅ Usage mensuel réinitialisé pour tous les tenants');
}

module.exports = {
  createAssistantForTenant,
  getOrCreateAssistant,
  updateAssistantInstructions,
  deleteAssistant,
  trackConversationUsage,
  resetMonthlyUsage
};
