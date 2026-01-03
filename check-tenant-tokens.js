require('dotenv').config();
const supabaseService = require('./services/supabaseService');

async function checkTenantTokens(tenantId = 'test-tenant-001') {
    try {
        console.log(`🔍 Vérification des tokens pour le tenant: ${tenantId}\n`);

        const { data: tenant, error } = await supabaseService.supabase
            .from('tenants')
            .select('*')
            .eq('tenant_id', tenantId)
            .single();

        if (error || !tenant) {
            console.error(`❌ Tenant "${tenantId}" non trouvé`);
            console.error('Erreur:', error?.message);
            return;
        }

        console.log('✅ Tenant trouvé:');
        console.log(`   ID: ${tenant.tenant_id}`);
        console.log(`   Company: ${tenant.company_name}`);
        console.log(`   Email Provider: ${tenant.email_provider || 'Non configuré'}`);
        console.log(`   Gmail Credential ID: ${tenant.gmail_credential_id || 'Non configuré'}`);

        if (tenant.email_oauth_tokens) {
            console.log('\n📧 Tokens OAuth:');
            console.log(`   Access Token: ${tenant.email_oauth_tokens.access_token?.substring(0, 30)}...`);
            console.log(`   Refresh Token: ${tenant.email_oauth_tokens.refresh_token?.substring(0, 30)}...`);
            console.log(`   Token Type: ${tenant.email_oauth_tokens.token_type || 'Bearer'}`);
            console.log(`   Expiry Date: ${tenant.email_oauth_tokens.expiry_date ? new Date(tenant.email_oauth_tokens.expiry_date).toISOString() : 'Non défini'}`);

            // Vérifier si le token est expiré
            if (tenant.email_oauth_tokens.expiry_date) {
                const isExpired = Date.now() > tenant.email_oauth_tokens.expiry_date;
                console.log(`   Status: ${isExpired ? '❌ Expiré' : '✅ Valide'}`);
            }
        } else {
            console.log('\n❌ Aucun token OAuth trouvé');
            console.log('   → L\'utilisateur doit se connecter via: http://localhost:3000/auth/gmail/connect?tenantId=' + tenantId);
        }

        console.log('\n📋 Prochaines étapes:');
        if (!tenant.email_oauth_tokens) {
            console.log('1. Connecter le compte Gmail via OAuth');
        } else if (!tenant.gmail_credential_id) {
            console.log('1. Créer le credential Gmail dans n8n (voir GMAIL_CREDENTIAL_SETUP.md)');
            console.log('2. Associer le credential au tenant avec: node update-tenant-credential.js ' + tenantId + ' [CREDENTIAL_ID]');
        } else {
            console.log('✅ Tout est configuré ! Vous pouvez créer des workflows.');
        }

    } catch (error) {
        console.error('❌ Erreur:', error.message);
    }
}

const [,, tenantId] = process.argv;
checkTenantTokens(tenantId);
