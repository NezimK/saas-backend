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

async function createRealGmailCredential() {
    try {
        // Récupère les tokens depuis Supabase
        console.log('📊 Récupération des tokens depuis Supabase...');
        const { data: tenant, error } = await supabaseService.supabase
            .from('tenants')
            .select('*')
            .eq('tenant_id', 'test-tenant-001')
            .single();

        if (error) throw error;
        if (!tenant || !tenant.email_oauth_tokens) {
            throw new Error('Aucun token trouvé pour test-tenant-001');
        }

        console.log('✅ Tokens récupérés');

        const tokens = tenant.email_oauth_tokens;

        // Test: googleOAuth2Api (le seul qui fonctionne pour Gmail)
        console.log('\n🧪 Test: googleOAuth2Api avec clientId/Secret + tokens');
        const credential = {
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

        console.log('Payload:', JSON.stringify(credential, null, 2));
        const response = await n8nAPI.post('/credentials', credential);
        console.log(`✅ Credential créé! ID: ${response.data.id}`);

        // Sauvegarde l'ID dans Supabase
        console.log('\n💾 Sauvegarde du credential ID dans Supabase...');
        const { error: updateError } = await supabaseService.supabase
            .from('tenants')
            .update({ gmail_credential_id: response.data.id })
            .eq('tenant_id', tenant.tenant_id);

        if (updateError) throw updateError;
        console.log(`✅ Credential ID sauvegardé dans Supabase`);

        return response.data.id;

    } catch (error) {
        console.error('❌ Erreur:', error.response?.data || error.message);
    }
}

createRealGmailCredential();
