require('dotenv').config();
const supabaseService = require('./services/supabaseService');

async function updateTenantCredential(tenantId, credentialId) {
    try {
        if (!tenantId || !credentialId) {
            console.error('❌ Usage: node update-tenant-credential.js <tenantId> <credentialId>');
            console.error('   Exemple: node update-tenant-credential.js test-tenant-001 abc123');
            process.exit(1);
        }

        console.log(`📝 Mise à jour du credential pour le tenant: ${tenantId}`);
        console.log(`   Credential ID: ${credentialId}`);

        // Vérifier que le tenant existe
        const { data: tenant, error: fetchError } = await supabaseService.supabase
            .from('tenants')
            .select('*')
            .eq('tenant_id', tenantId)
            .single();

        if (fetchError || !tenant) {
            throw new Error(`Tenant "${tenantId}" non trouvé`);
        }

        console.log(`✅ Tenant trouvé: ${tenant.company_name}`);

        // Mettre à jour le credential ID
        const { error: updateError } = await supabaseService.supabase
            .from('tenants')
            .update({ gmail_credential_id: credentialId })
            .eq('tenant_id', tenantId);

        if (updateError) {
            throw new Error(`Erreur mise à jour: ${updateError.message}`);
        }

        console.log('✅ Credential ID sauvegardé avec succès dans Supabase');

        // Afficher le résultat
        const { data: updatedTenant } = await supabaseService.supabase
            .from('tenants')
            .select('*')
            .eq('tenant_id', tenantId)
            .single();

        console.log('\n📊 Tenant mis à jour:');
        console.log(`   Tenant ID: ${updatedTenant.tenant_id}`);
        console.log(`   Company: ${updatedTenant.company_name}`);
        console.log(`   Gmail Credential ID: ${updatedTenant.gmail_credential_id}`);
        console.log(`   Email Provider: ${updatedTenant.email_provider}`);
        console.log(`   OAuth Tokens: ${updatedTenant.email_oauth_tokens ? '✅ Présents' : '❌ Manquants'}`);

    } catch (error) {
        console.error('❌ Erreur:', error.message);
        process.exit(1);
    }
}

// Récupérer les arguments de la ligne de commande
const [,, tenantId, credentialId] = process.argv;

updateTenantCredential(tenantId, credentialId);
