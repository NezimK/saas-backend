/**
 * Test de toutes les méthodes possibles pour créer un credential Gmail
 */

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

async function testAllMethods() {
    try {
        // Récupérer les tokens
        const { data: tenant } = await supabaseService.supabase
            .from('tenants')
            .select('*')
            .eq('tenant_id', 'test-tenant-001')
            .single();

        const tokens = tenant.email_oauth_tokens;

        const testCases = [
            {
                name: 'Test 1: Minimal (clientId + clientSecret seulement)',
                payload: {
                    name: 'Gmail Test 1',
                    type: 'googleOAuth2Api',
                    data: {
                        clientId: oauthConfig.google.clientId,
                        clientSecret: oauthConfig.google.clientSecret
                    }
                }
            },
            {
                name: 'Test 2: Avec grantType = authorizationCode',
                payload: {
                    name: 'Gmail Test 2',
                    type: 'googleOAuth2Api',
                    data: {
                        clientId: oauthConfig.google.clientId,
                        clientSecret: oauthConfig.google.clientSecret,
                        grantType: 'authorizationCode',
                        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
                        accessTokenUrl: 'https://oauth2.googleapis.com/token',
                        scope: 'https://www.googleapis.com/auth/gmail.readonly https://mail.google.com/'
                    }
                }
            },
            {
                name: 'Test 3: Avec oauthTokenData en string',
                payload: {
                    name: 'Gmail Test 3',
                    type: 'googleOAuth2Api',
                    data: {
                        clientId: oauthConfig.google.clientId,
                        clientSecret: oauthConfig.google.clientSecret,
                        grantType: 'authorizationCode',
                        oauthTokenData: JSON.stringify({
                            access_token: tokens.access_token,
                            refresh_token: tokens.refresh_token,
                            token_type: 'Bearer',
                            expiry_date: tokens.expiry_date
                        })
                    }
                }
            },
            {
                name: 'Test 4: Type gmailOAuth2 avec authUrl/tokenUrl',
                payload: {
                    name: 'Gmail Test 4',
                    type: 'gmailOAuth2',
                    data: {
                        clientId: oauthConfig.google.clientId,
                        clientSecret: oauthConfig.google.clientSecret,
                        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
                        accessTokenUrl: 'https://oauth2.googleapis.com/token',
                        oauthTokenData: {
                            access_token: tokens.access_token,
                            refresh_token: tokens.refresh_token
                        }
                    }
                }
            },
            {
                name: 'Test 5: oAuth2Api générique',
                payload: {
                    name: 'Gmail Test 5',
                    type: 'oAuth2Api',
                    data: {
                        clientId: oauthConfig.google.clientId,
                        clientSecret: oauthConfig.google.clientSecret,
                        accessTokenUrl: 'https://oauth2.googleapis.com/token',
                        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
                        scope: 'https://www.googleapis.com/auth/gmail.readonly',
                        authQueryParameters: '',
                        authentication: 'body'
                    }
                }
            }
        ];

        for (const test of testCases) {
            console.log(`\n${'='.repeat(60)}`);
            console.log(`🧪 ${test.name}`);
            console.log(`${'='.repeat(60)}`);
            console.log('Payload:', JSON.stringify(test.payload, null, 2));

            try {
                const response = await n8nAPI.post('/credentials', test.payload);
                console.log(`✅ SUCCÈS! Credential créé: ${response.data.id}`);

                // Sauvegarder l'ID
                await supabaseService.supabase
                    .from('tenants')
                    .update({ gmail_credential_id: response.data.id })
                    .eq('tenant_id', 'test-tenant-001');

                console.log('✅ Credential ID sauvegardé dans Supabase');
                console.log(`\n🎉 LA MÉTHODE QUI FONCTIONNE: ${test.name}`);

                // Arrêter les tests si on a trouvé une méthode qui fonctionne
                return response.data.id;

            } catch (error) {
                const errorMsg = error.response?.data?.message || error.message;
                console.log(`❌ Échec: ${errorMsg.substring(0, 150)}...`);
            }
        }

        console.log(`\n${'='.repeat(60)}`);
        console.log('❌ Aucune méthode n\'a fonctionné');
        console.log(`${'='.repeat(60)}`);

    } catch (error) {
        console.error('❌ Erreur:', error.message);
    }
}

testAllMethods();
