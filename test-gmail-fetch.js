const supabaseService = require('./services/supabaseService');
const gmailService = require('./services/gmailService');

async function testGmailFetch() {
  try {
    const tenantId = 'test-tenant-001';

    console.log('📋 Récupération du tenant depuis Supabase...');
    const { data: tenant, error } = await supabaseService.supabase
      .from('tenants')
      .select('*')
      .eq('tenant_id', tenantId)
      .single();

    if (error || !tenant) {
      console.error('❌ Tenant non trouvé. Créez-le d\'abord ou connectez Gmail.');
      console.log(`   Lien de connexion: http://localhost:3000/auth/gmail/connect?tenantId=${tenantId}`);
      return;
    }

    if (!tenant.email_oauth_tokens) {
      console.error('❌ Gmail non connecté pour ce tenant.');
      console.log(`   Connectez Gmail: http://localhost:3000/auth/gmail/connect?tenantId=${tenantId}`);
      return;
    }

    console.log('✅ Tenant trouvé:', tenant.tenant_id);
    console.log('📧 Récupération des emails Canva...\n');

    const emails = await gmailService.getEmailsFromSources(tenant.email_oauth_tokens, ['canva']);

    console.log('\n📊 Résultats:');
    console.log(`   Total: ${emails.length} email(s)\n`);

    emails.forEach((email, i) => {
      console.log(`[${i + 1}] ${email.subject}`);
      console.log(`    De: ${email.from}`);
      console.log(`    Date: ${email.date}`);
      console.log(`    Preview: ${email.body.substring(0, 80)}...`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error.stack);
  }
}

testGmailFetch();
