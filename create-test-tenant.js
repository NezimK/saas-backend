require('dotenv').config();
const supabaseService = require('./services/supabaseService');

async function createTestTenant() {
  try {
    const tenantId = 'test-tenant-001';

    console.log('🔍 Vérification si le tenant existe déjà...');
    const { data: existing } = await supabaseService.supabase
      .from('tenants')
      .select('*')
      .eq('tenant_id', tenantId)
      .single();

    if (existing) {
      console.log('✅ Le tenant existe déjà:', existing.tenant_id);
      console.log(`📧 Gmail connecté: ${existing.email_provider ? 'Oui' : 'Non'}`);

      if (!existing.email_provider) {
        console.log(`\n🔗 Connectez Gmail: http://localhost:3000/auth/gmail/connect?tenantId=${tenantId}`);
      }
      return;
    }

    console.log('📝 Création du tenant de test...');
    const { data: tenant, error } = await supabaseService.supabase
      .from('tenants')
      .insert([{
        tenant_id: tenantId,
        company_name: 'Test Company',
        crm_type: 'test',
        crm_api_url: 'https://test.example.com',
        crm_api_key: 'test-key'
      }])
      .select()
      .single();

    if (error) {
      console.error('❌ Erreur création:', error.message);
      return;
    }

    console.log('✅ Tenant créé avec succès !');
    console.log('   ID:', tenant.tenant_id);
    console.log('   Company:', tenant.company_name);
    console.log('');
    console.log('🔗 Prochaine étape: Connectez Gmail');
    console.log(`   http://localhost:3000/auth/gmail/connect?tenantId=${tenantId}`);

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

createTestTenant();
