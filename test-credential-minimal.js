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

async function testMinimalCredential() {
    try {
        // Récupérer les tokens
        const { data: tenant } = await supabaseService.supabase
            .from('tenants')
            .select('*')
            .eq('tenant_id', 'test-tenant-001')
            .single();

        const tokens = tenant.email_oauth_tokens;

        // Test 1: Juste clientId et clientSecret (n8n gère OAuth lui-même)
        console.log('\n🧪 Test 1: Credential minimal - n8n gère OAuth');
        try {
            const cred1 = {
                name: `Gmail Minimal - ${tenant.tenant_id}`,
                type: 'googleOAuth2Api',
                data: {
                    clientId: oauthConfig.google.clientId,
                    clientSecret: oauthConfig.google.clientSecret
                }
            };
            console.log('Payload:', JSON.stringify(cred1, null, 2));
            const res1 = await n8nAPI.post('/credentials', cred1);
            console.log(`✅ Credential créé! ID: ${res1.data.id}`);
            await n8nAPI.delete(`/credentials/${res1.data.id}`);
        } catch (e) {
            console.error(`❌ Échec:`, e.response?.data?.message || e.message);
        }

        // Test 2: Avec authentication = 'oAuth2'
        console.log('\n🧪 Test 2: Avec authentication = oAuth2');
        try {
            const cred2 = {
                name: `Gmail OAuth2 - ${tenant.tenant_id}`,
                type: 'googleOAuth2Api',
                data: {
                    authentication: 'oAuth2',
                    clientId: oauthConfig.google.clientId,
                    clientSecret: oauthConfig.google.clientSecret,
                    accessToken: tokens.access_token,
                    refreshToken: tokens.refresh_token
                }
            };
            console.log('Payload:', JSON.stringify(cred2, null, 2));
            const res2 = await n8nAPI.post('/credentials', cred2);
            console.log(`✅ Credential créé! ID: ${res2.data.id}`);

            // Sauvegarder dans Supabase
            await supabaseService.supabase
                .from('tenants')
                .update({ gmail_credential_id: res2.data.id })
                .eq('tenant_id', tenant.tenant_id);

            console.log('✅ Credential ID sauvegardé dans Supabase');

        } catch (e) {
            console.error(`❌ Échec:`, e.response?.data?.message || e.message);
        }

        // Test 3: Format exact comme l'interface web
        console.log('\n🧪 Test 3: Format interface web (encrypted tokens)');
        try {
            const cred3 = {
                name: `Gmail Web Format - ${tenant.tenant_id}`,
                type: 'googleOAuth2Api',
                data: {
                    clientId: oauthConfig.google.clientId,
                    clientSecret: oauthConfig.google.clientSecret,
                    oauthTokenData: JSON.stringify({
                        access_token: tokens.access_token,
                        refresh_token: tokens.refresh_token,
                        token_type: 'Bearer',
                        expiry_date: tokens.expiry_date
                    })
                }
            };
            console.log('Payload:', JSON.stringify(cred3, null, 2));
            const res3 = await n8nAPI.post('/credentials', cred3);
            console.log(`✅ Credential créé! ID: ${res3.data.id}`);

            await supabaseService.supabase
                .from('tenants')
                .update({ gmail_credential_id: res3.data.id })
                .eq('tenant_id', tenant.tenant_id);

            console.log('✅ Credential ID sauvegardé dans Supabase');

        } catch (e) {
            console.error(`❌ Échec:`, e.response?.data?.message || e.message);
        }

    } catch (error) {
        console.error('❌ Erreur:', error.message);
    }
}

testMinimalCredential();
