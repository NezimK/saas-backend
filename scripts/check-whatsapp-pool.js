/**
 * Script pour verifier l'etat du pool WhatsApp et detecter les anomalies
 * Usage: node scripts/check-whatsapp-pool.js
 */

require('dotenv').config();
const supabaseService = require('../services/supabaseService');

async function checkWhatsappPool() {
  console.log('📱 État du pool WhatsApp\n');
  console.log('='.repeat(60) + '\n');

  // 1. Recuperer tous les numeros du pool avec leurs tenants
  const { data: poolNumbers, error: poolError } = await supabaseService.supabase
    .from('whatsapp_numbers_pool')
    .select('*')
    .order('id', { ascending: true });

  if (poolError) {
    console.error('❌ Erreur:', poolError);
    process.exit(1);
  }

  // 2. Recuperer tous les tenants actifs
  const { data: tenants, error: tenantsError } = await supabaseService.supabase
    .from('tenants')
    .select('tenant_id, company_name, email, status, whatsapp_number')
    .order('created_at', { ascending: true });

  if (tenantsError) {
    console.error('❌ Erreur:', tenantsError);
    process.exit(1);
  }

  // 3. Afficher l'etat du pool
  console.log('📋 Numéros dans le pool:\n');
  for (const num of poolNumbers) {
    const tenant = tenants.find(t => t.tenant_id === num.tenant_id);
    const tenantInfo = tenant
      ? `${tenant.company_name} (${tenant.status})`
      : num.tenant_id
        ? `⚠️ TENANT INTROUVABLE: ${num.tenant_id}`
        : '-';

    console.log(`   ${num.phone_number}`);
    console.log(`      Status: ${num.status}`);
    console.log(`      Tenant: ${tenantInfo}`);
    console.log('');
  }

  // 4. Afficher les tenants et leur numero
  console.log('='.repeat(60));
  console.log('\n👥 Tenants:\n');
  for (const tenant of tenants) {
    const hasPoolNumber = poolNumbers.some(p => p.tenant_id === tenant.tenant_id);
    const icon = tenant.whatsapp_number ? '✅' : '❌';
    const poolIcon = hasPoolNumber ? '🔗' : '⚠️';

    console.log(`   ${icon} ${tenant.company_name} (${tenant.status})`);
    console.log(`      Email: ${tenant.email}`);
    console.log(`      WhatsApp (tenant): ${tenant.whatsapp_number || 'AUCUN'}`);
    console.log(`      Pool assigné: ${hasPoolNumber ? 'Oui' : 'Non'} ${poolIcon}`);
    console.log('');
  }

  // 5. Detecter les anomalies
  console.log('='.repeat(60));
  console.log('\n🔍 Anomalies détectées:\n');

  let anomalies = 0;

  // Numeros assignes a des tenants inexistants
  for (const num of poolNumbers) {
    if (num.tenant_id && num.status === 'assigned') {
      const tenant = tenants.find(t => t.tenant_id === num.tenant_id);
      if (!tenant) {
        console.log(`   ⚠️ ${num.phone_number} assigné à un tenant inexistant: ${num.tenant_id}`);
        anomalies++;
      } else if (tenant.status !== 'active') {
        console.log(`   ⚠️ ${num.phone_number} assigné à un tenant inactif: ${tenant.company_name} (${tenant.status})`);
        anomalies++;
      }
    }
  }

  // Tenants actifs sans numero
  for (const tenant of tenants) {
    if (tenant.status === 'active' && !tenant.whatsapp_number) {
      console.log(`   ❌ ${tenant.company_name} est actif mais n'a pas de numéro WhatsApp`);
      anomalies++;
    }
  }

  // Incoherence pool vs tenant
  for (const tenant of tenants) {
    const poolNum = poolNumbers.find(p => p.tenant_id === tenant.tenant_id);
    if (poolNum && tenant.whatsapp_number !== poolNum.phone_number) {
      console.log(`   🔄 Incohérence pour ${tenant.company_name}:`);
      console.log(`      - Pool: ${poolNum.phone_number}`);
      console.log(`      - Tenant: ${tenant.whatsapp_number || 'AUCUN'}`);
      anomalies++;
    }
  }

  if (anomalies === 0) {
    console.log('   ✅ Aucune anomalie détectée');
  }

  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 Résumé: ${poolNumbers.filter(p => p.status === 'available').length} disponible(s), ${poolNumbers.filter(p => p.status === 'assigned').length} assigné(s), ${anomalies} anomalie(s)\n`);
}

checkWhatsappPool().catch(err => {
  console.error('❌ Erreur fatale:', err);
  process.exit(1);
});
