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
    const { data, error } = await this.supabase
      .from('tenants')
      .insert([tenantData])
      .select()
      .single();
    
    if (error) throw new Error(`Erreur Supabase: ${error.message}`);
    return data;
  }
}

// ⚠️ IMPORTANT : Exporter une INSTANCE
module.exports = new SupabaseService();