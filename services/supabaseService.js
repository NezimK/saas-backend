require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

class SupabaseService {
  constructor() {
    // Le backend est un serveur de confiance : utiliser la service role key
    // pour bypasser les RLS policies (les contrôles d'accès sont faits côté API)
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      key
    );

    // Alias pour rétro-compatibilité
    this.adminSupabase = this.supabase;
  }

  async getWorkflowTemplate(templateName) {
    const { data, error } = await this.supabase
      .from('workflow_templates')
      .select('*')
      .eq('name', templateName);

    if (error) throw new Error(`Erreur Supabase: ${error.message}`);

    if (!data || data.length === 0) {
      throw new Error(`Template "${templateName}" non trouvé dans la base de données`);
    }

    if (data.length > 1) {
      throw new Error(`Plusieurs templates trouvés avec le nom "${templateName}"`);
    }

    return data[0];
  }

  async createTenant(tenantData) {
    const client = this.adminSupabase || this.supabase;
    const { data, error} = await client
      .from('tenants')
      .insert([tenantData])
      .select()
      .single();

    if (error) throw new Error(`Erreur Supabase: ${error.message}`);
    return data;
  }

  /**
   * Exécute du SQL brut via Supabase (pour créer schémas, etc.)
   */
  async executeRawSQL(sql) {
    const logger = require('./logger');
    logger.debug('supabase', `executeRawSQL: ${sql.length} chars`);

    const { data, error } = await this.supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      logger.error('supabase', 'executeRawSQL erreur RPC', error);
      throw new Error(`Erreur SQL: ${error.message}`);
    }

    logger.debug('supabase', 'executeRawSQL résultat OK');
    return data;
  }
}

// ⚠️ IMPORTANT : Exporter une INSTANCE
module.exports = new SupabaseService();