/**
 * Nettoie un tenant et son workflow pour recommencer à zéro
 */

require('dotenv').config();
const supabaseService = require('./services/supabaseService');
const axios = require('axios');

const n8nAPI = axios.create({
    baseURL: process.env.N8N_API_URL,
    headers: {
        'X-N8N-API-KEY': process.env.N8N_API_KEY,
        'Content-Type': 'application/json'
    }
});

async function cleanTenant(tenantId) {
    try {
        console.log(`🧹 Nettoyage du tenant: ${tenantId}\n`);

        // 1. Récupérer le tenant
        const { data: tenant } = await supabaseService.supabase
            .from('tenants')
            .select('*')
            .eq('tenant_id', tenantId)
            .single();

        if (!tenant) {
            console.log('⚠️  Tenant non trouvé (déjà nettoyé)');
            return;
        }

        // 2. Supprimer le workflow n8n si existant
        if (tenant.n8n_workflow_id) {
            console.log(`🗑️  Suppression du workflow n8n: ${tenant.n8n_workflow_id}`);
            try {
                await n8nAPI.delete(`/workflows/${tenant.n8n_workflow_id}`);
                console.log('✅ Workflow supprimé');
            } catch (error) {
                console.log('⚠️  Workflow déjà supprimé ou introuvable');
            }
        }

        // 3. Supprimer le tenant de Supabase
        console.log(`🗑️  Suppression du tenant de Supabase...`);
        await supabaseService.supabase
            .from('tenants')
            .delete()
            .eq('tenant_id', tenantId);

        console.log('✅ Tenant supprimé');
        console.log('\n🎉 Nettoyage terminé !');
        console.log(`\n📋 Prochaine étape:`);
        console.log(`   Connectez Gmail: http://localhost:3000/auth/gmail/connect?tenantId=${tenantId}`);

    } catch (error) {
        console.error('❌ Erreur:', error.message);
    }
}

const tenantId = process.argv[2] || 'test-tenant-001';
cleanTenant(tenantId);
