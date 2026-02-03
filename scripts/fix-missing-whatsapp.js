/**
 * Script pour assigner les numeros WhatsApp manquants aux tenants actifs
 * Usage: node scripts/fix-missing-whatsapp.js
 */

require('dotenv').config();
const supabaseService = require('../services/supabaseService');
const whatsappPoolService = require('../services/whatsappPoolService');

async function fixMissingWhatsappNumbers() {
  console.log('🔍 Recherche des tenants sans numéro WhatsApp...\n');

  // 1. Trouver les tenants actifs sans numero WhatsApp
  const { data: tenantsWithoutNumber, error: findError } = await supabaseService.supabase
    .from('tenants')
    .select('tenant_id, company_name, email, status')
    .eq('status', 'active')
    .is('whatsapp_number', null);

  if (findError) {
    console.error('❌ Erreur recherche tenants:', findError);
    process.exit(1);
  }

  if (!tenantsWithoutNumber || tenantsWithoutNumber.length === 0) {
    console.log('✅ Tous les tenants actifs ont un numéro WhatsApp assigné.');
    process.exit(0);
  }

  console.log(`📋 ${tenantsWithoutNumber.length} tenant(s) sans numéro WhatsApp:\n`);
  tenantsWithoutNumber.forEach((t, i) => {
    console.log(`   ${i + 1}. ${t.company_name} (${t.email})`);
  });
  console.log('');

  // 2. Afficher le statut du pool
  const poolStatus = await whatsappPoolService.getPoolStatus();
  if (poolStatus.success) {
    console.log(`📱 Pool WhatsApp: ${poolStatus.available} disponible(s) / ${poolStatus.total} total\n`);

    if (poolStatus.available < tenantsWithoutNumber.length) {
      console.warn(`⚠️  Attention: Seulement ${poolStatus.available} numéro(s) disponible(s) pour ${tenantsWithoutNumber.length} tenant(s)`);
    }
  }

  // 3. Assigner les numeros manquants
  console.log('🚀 Assignation des numéros...\n');

  let successCount = 0;
  let failCount = 0;

  for (const tenant of tenantsWithoutNumber) {
    const result = await whatsappPoolService.assignNumberToTenant(tenant.tenant_id);

    if (result.success) {
      console.log(`   ✅ ${tenant.company_name}: ${result.phoneNumber}`);
      successCount++;
    } else {
      console.log(`   ❌ ${tenant.company_name}: ${result.error}`);
      failCount++;
    }
  }

  // 4. Resume
  console.log('\n📊 Résumé:');
  console.log(`   - Assignés: ${successCount}`);
  console.log(`   - Échecs: ${failCount}`);

  process.exit(failCount > 0 ? 1 : 0);
}

fixMissingWhatsappNumbers().catch(err => {
  console.error('❌ Erreur fatale:', err);
  process.exit(1);
});
