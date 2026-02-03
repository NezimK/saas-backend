/**
 * Script pour assigner un numéro WhatsApp aux tenants qui n'en ont pas
 */

require('dotenv').config();
const supabaseService = require('../services/supabaseService');
const whatsappPoolService = require('../services/whatsappPoolService');

async function assignMissingWhatsApp() {
  console.log('🔍 Recherche des tenants sans numéro WhatsApp...\n');

  const { data: tenants, error } = await supabaseService.supabase
    .from('tenants')
    .select('tenant_id, company_name, whatsapp_number')
    .is('whatsapp_number', null);

  if (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }

  if (!tenants || tenants.length === 0) {
    console.log('✅ Tous les tenants ont un numéro WhatsApp');
    process.exit(0);
  }

  console.log(`📋 ${tenants.length} tenant(s) sans numéro WhatsApp:\n`);

  for (const tenant of tenants) {
    console.log(`   Assignation pour ${tenant.company_name} (${tenant.tenant_id})...`);
    const result = await whatsappPoolService.assignNumberToTenant(tenant.tenant_id);

    if (result.success) {
      console.log(`   ✅ Numéro assigné: ${result.phoneNumber}\n`);
    } else {
      console.log(`   ❌ Erreur: ${result.error}\n`);
    }
  }

  // Vérifier le résultat final
  console.log('📋 État final du pool:');
  const { data: pool } = await supabaseService.supabase
    .from('whatsapp_numbers_pool')
    .select('*');

  pool.forEach(n => {
    console.log(`   ${n.phone_number}: ${n.status} (tenant: ${n.tenant_id || 'none'})`);
  });
}

assignMissingWhatsApp().catch(err => {
  console.error('❌ Erreur fatale:', err);
  process.exit(1);
});
