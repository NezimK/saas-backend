require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

class SupabaseService {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );
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
    const { data, error} = await this.supabase
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
    console.log('🔍 [DEBUG executeRawSQL] Appel RPC exec_sql...');
    console.log('🔍 [DEBUG] SQL length:', sql.length, 'chars');

    const { data, error } = await this.supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      console.error('❌ [DEBUG executeRawSQL] Erreur RPC:', JSON.stringify(error, null, 2));
      throw new Error(`Erreur SQL: ${error.message}`);
    }

    console.log('🔍 [DEBUG executeRawSQL] Résultat:', data);
    return data;
  }
}

// ⚠️ IMPORTANT : Exporter une INSTANCE
module.exports = new SupabaseService();