require('dotenv').config();
const axios = require('axios');
const supabaseService = require('./services/supabaseService');
const oauthConfig = require('./config/oauth');

const n8nAPI = axios.create({
    baseURL: process.env.N8N_API_URL,
    headers: {
        'X-N8N-API-KEY': process.env.N8N_API_KEY,
        'Content-Type': 'application/json'
    }
});

async function testCredentialUpdate() {
    try {
        // Récupérer les tokens
        const { data: tenant } = await supabaseService.supabase
            .from('tenants')
            .select('*')
            .eq('tenant_id', 'test-tenant-001')
            .single();

        const tokens = tenant.email_oauth_tokens;

        console.log('🧪 Test: Créer credential vide puis le mettre à jour\n');

        // Étape 1: Créer un credential minimal AVEC scope
        console.log('1️⃣  Création du credential avec clientId/Secret/scope...');
        const createPayload = {
            name: `Gmail Update Test - ${tenant.tenant_id}`,
            type: 'googleOAuth2Api',
            data: {
                clientId: oauthConfig.google.clientId,
                clientSecret: oauthConfig.google.clientSecret,
                scope: 'https://www.googleapis.com/auth/gmail.readonly https://mail.google.com/'
            }
        };

        const { data: createdCred } = await n8nAPI.post('/credentials', createPayload);
        console.log(`✅ Credential créé! ID: ${createdCred.id}`);

        // Étape 2: Essayer de le mettre à jour avec les tokens
        console.log('\n2️⃣  Mise à jour du credential avec les tokens OAuth...');

        const updatePayload = {
            name: `Gmail - ${tenant.tenant_id}`,
            type: 'googleOAuth2Api',
            data: {
                clientId: oauthConfig.google.clientId,
                clientSecret: oauthConfig.google.clientSecret,
                scope: 'https://www.googleapis.com/auth/gmail.readonly https://mail.google.com/',
                oauthTokenData: {
                    access_token: tokens.access_token,
                    refresh_token: tokens.refresh_token,
                    token_type: tokens.token_type || 'Bearer',
                    expiry_date: tokens.expiry_date || (Date.now() + 3600000)
                }
            }
        };

        try {
            const { data: updatedCred } = await n8nAPI.patch(`/credentials/${createdCred.id}`, updatePayload);
            console.log(`✅ Credential mis à jour! ID: ${updatedCred.id}`);

            // Sauvegarder dans Supabase
            await supabaseService.supabase
                .from('tenants')
                .update({ gmail_credential_id: updatedCred.id })
                .eq('tenant_id', tenant.tenant_id);

            console.log('✅ Credential ID sauvegardé dans Supabase');
            console.log(`\n🎉 SUCCÈS! Le credential ${updatedCred.id} est prêt à être utilisé`);

        } catch (updateError) {
            console.error('❌ Échec de la mise à jour:', updateError.response?.data?.message || updateError.message);
            console.log('\n🧹 Suppression du credential de test...');
            await n8nAPI.delete(`/credentials/${createdCred.id}`);
        }

    } catch (error) {
        console.error('❌ Erreur:', error.response?.data || error.message);
    }
}

testCredentialUpdate();
