/**
 * Script pour corriger le numero orphelin et l'assigner au tenant manquant
 * Usage: node scripts/fix-orphan-number.js
 */

require('dotenv').config();
const supabaseService = require('../services/supabaseService');
const whatsappPoolService = require('../services/whatsappPoolService');

async function fixOrphanNumber() {
  console.log('🔧 Correction du numéro orphelin...\n');

  // 1. Trouver le numero orphelin (assigned mais sans tenant_id)
  const { data: orphanNumbers, error: findError } = await supabaseService.supabase
    .from('whatsapp_numbers_pool')
    .select('*')
    .eq('status', 'assigned')
    .is('tenant_id', null);

  if (findError) {
    console.error('❌ Erreur:', findError);
    process.exit(1);
  }

  if (!orphanNumbers || orphanNumbers.length === 0) {
    console.log('✅ Aucun numéro orphelin trouvé.');
    process.exit(0);
  }

  console.log(`📋 ${orphanNumbers.length} numéro(s) orphelin(s) trouvé(s):\n`);
  orphanNumbers.forEach(n => {
    console.log(`   - ${n.phone_number} (status: ${n.status}, tenant_id: null)`);
  });

  // 2. Liberer les numeros orphelins
  console.log('\n🔓 Libération des numéros orphelins...\n');

  for (const num of orphanNumbers) {
    const { error: updateError } = await supabaseService.supabase
      .from('whatsapp_numbers_pool')
      .update({
        status: 'available',
        tenant_id: null,
        assigned_at: null
      })
      .eq('id', num.id);

    if (updateError) {
      console.error(`   ❌ Erreur libération ${num.phone_number}:`, updateError);
    } else {
      console.log(`   ✅ ${num.phone_number} libéré`);
    }
  }

  // 3. Trouver les tenants actifs sans numero
  const { data: tenantsWithoutNumber } = await supabaseService.supabase
    .from('tenants')
    .select('tenant_id, company_name, email')
    .eq('status', 'active')
    .is('whatsapp_number', null);

  if (tenantsWithoutNumber && tenantsWithoutNumber.length > 0) {
    console.log(`\n🚀 Assignation aux tenants sans numéro...\n`);

    for (const tenant of tenantsWithoutNumber) {
      const result = await whatsappPoolService.assignNumberToTenant(tenant.tenant_id);

      if (result.success) {
        console.log(`   ✅ ${tenant.company_name}: ${result.phoneNumber}`);
      } else {
        console.log(`   ❌ ${tenant.company_name}: ${result.error}`);
      }
    }
  }

  console.log('\n✅ Terminé!\n');
}

fixOrphanNumber().catch(err => {
  console.error('❌ Erreur fatale:', err);
  process.exit(1);
});
