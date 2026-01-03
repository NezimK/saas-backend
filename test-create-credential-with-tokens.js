/**
 * Test de création d'un credential avec tokens OAuth déjà obtenus
 */

require('dotenv').config();
const axios = require('axios');
const supabaseService = require('./services/supabaseService');

const n8nAPI = axios.create({
    baseURL: process.env.N8N_API_URL,
    headers: {
        'X-N8N-API-KEY': process.env.N8N_API_KEY,
        'Content-Type': 'application/json'
    }
});

async function testCreateCredentialWithTokens() {
    try {
        console.log('🔍 Test de création de credential avec tokens existants\n');

        // 1. Récupérer les tokens du tenant depuis Supabase
        console.log('1️⃣  Récupération des tokens depuis Supabase...');
        const { data: tenant } = await supabaseService.supabase
            .from('tenants')
            .select('*')
            .eq('tenant_id', 'test-tenant-001')
            .single();

        if (!tenant || !tenant.email_oauth_tokens) {
            console.log('⚠️  Pas de tenant avec tokens. Connectez Gmail d\'abord.');
            return;
        }

        console.log('✅ Tokens trouvés');
        console.log(`   Access Token: ${tenant.email_oauth_tokens.access_token.substring(0, 30)}...`);
        console.log(`   Refresh Token: ${tenant.email_oauth_tokens.refresh_token.substring(0, 30)}...`);

        // 2. Essayer différents formats de credential
        const formats = [
            {
                name: 'Format 1: oauthTokenData object',
                payload: {
                    name: `Gmail - ${tenant.tenant_id}`,
                    type: 'googleOAuth2Api',
                    data: {
                        oauthTokenData: {
                            access_token: tenant.email_oauth_tokens.access_token,
                            refresh_token: tenant.email_oauth_tokens.refresh_token,
                            token_type: tenant.email_oauth_tokens.token_type,
                            expiry_date: tenant.email_oauth_tokens.expiry_date
                        }
                    }
                }
            },
            {
                name: 'Format 2: Direct tokens',
                payload: {
                    name: `Gmail - ${tenant.tenant_id}`,
                    type: 'googleOAuth2Api',
                    data: {
                        accessToken: tenant.email_oauth_tokens.access_token,
                        refreshToken: tenant.email_oauth_tokens.refresh_token,
                        tokenType: tenant.email_oauth_tokens.token_type || 'Bearer',
                        expiryDate: tenant.email_oauth_tokens.expiry_date
                    }
                }
            },
            {
                name: 'Format 3: Avec clientId/Secret + tokens',
                payload: {
                    name: `Gmail - ${tenant.tenant_id}`,
                    type: 'googleOAuth2Api',
                    data: {
                        clientId: process.env.GOOGLE_CLIENT_ID,
                        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                        accessToken: tenant.email_oauth_tokens.access_token,
                        refreshToken: tenant.email_oauth_tokens.refresh_token
                    }
                }
            }
        ];

        for (const format of formats) {
            console.log(`\n2️⃣  Test: ${format.name}`);
            console.log('📤 Payload:');
            console.log(JSON.stringify({...format.payload, data: {...format.payload.data, accessToken: '***', refreshToken: '***'}}, null, 2));

            try {
                const { data: created } = await n8nAPI.post('/credentials', format.payload);
                console.log(`✅ SUCCESS! Credential créé avec succès !`);
                console.log(`   ID: ${created.id}`);
                console.log(`   Name: ${created.name}`);

                // Supprimer le test
                await n8nAPI.delete(`/credentials/${created.id}`);
                console.log('✅ Credential de test supprimé');
                break; // On arrête dès qu'un format fonctionne
            } catch (error) {
                console.log('❌ Échec');
                if (error.response?.data?.message) {
                    console.log(`   Erreur: ${error.response.data.message.substring(0, 150)}...`);
                }
            }
        }

    } catch (error) {
        console.error('\n❌ Erreur globale:', error.message);
    }
}

testCreateCredentialWithTokens();
