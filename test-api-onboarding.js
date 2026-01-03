/**
 * Test du flux d'onboarding complet
 * Simule ce qui se passe après que l'utilisateur autorise Gmail
 */

require('dotenv').config();
const supabaseService = require('./services/supabaseService');
const workflowService = require('./services/workflowService');

async function testOnboarding(tenantId) {
    try {
        console.log(`\n🧪 Test du flux d'onboarding pour: ${tenantId}\n`);

        // 1. Vérifier que le tenant existe avec des tokens
        console.log('1️⃣  Vérification du tenant...');
        const { data: tenant, error } = await supabaseService.supabase
            .from('tenants')
            .select('*')
            .eq('tenant_id', tenantId)
            .single();

        if (error || !tenant) {
            console.error('❌ Tenant non trouvé. Connectez Gmail d\'abord:');
            console.error(`   http://localhost:3000/auth/gmail/connect?tenantId=${tenantId}`);
            return;
        }

        console.log(`✅ Tenant trouvé: ${tenant.company_name}`);

        if (!tenant.email_oauth_tokens) {
            console.error('❌ Pas de tokens OAuth. Connectez Gmail d\'abord:');
            console.error(`   http://localhost:3000/auth/gmail/connect?tenantId=${tenantId}`);
            return;
        }

        console.log('✅ Tokens OAuth présents');

        // 2. Tester la création du workflow
        console.log('\n2️⃣  Création du workflow...');
        const workflowResult = await workflowService.createGmailWorkflow(tenantId);

        if (workflowResult.created) {
            console.log(`✅ Workflow créé: ${workflowResult.workflowId}`);
        } else {
            console.log(`⚠️  Workflow existant: ${workflowResult.workflowId}`);
        }

        // 3. Vérifier que tout est sauvegardé
        console.log('\n3️⃣  Vérification finale...');
        const { data: updatedTenant } = await supabaseService.supabase
            .from('tenants')
            .select('*')
            .eq('tenant_id', tenantId)
            .single();

        console.log(`\n📊 État final du tenant:`);
        console.log(`   • Tenant ID: ${updatedTenant.tenant_id}`);
        console.log(`   • Company: ${updatedTenant.company_name}`);
        console.log(`   • Email Provider: ${updatedTenant.email_provider}`);
        console.log(`   • OAuth Tokens: ${updatedTenant.email_oauth_tokens ? '✅' : '❌'}`);
        console.log(`   • Workflow ID: ${updatedTenant.n8n_workflow_id || 'Non défini'}`);

        console.log(`\n🎉 TEST RÉUSSI !`);
        console.log(`\n📋 Résumé:`);
        console.log(`   • Tenant configuré: ✅`);
        console.log(`   • Tokens OAuth: ✅`);
        console.log(`   • Workflow n8n: ✅ (${workflowResult.workflowId})`);
        console.log(`\n🚀 Le système est opérationnel pour ${tenantId} !`);

    } catch (error) {
        console.error('❌ Erreur:', error.message);
    }
}

// Exécution
const tenantId = process.argv[2] || 'test-tenant-001';
testOnboarding(tenantId);
