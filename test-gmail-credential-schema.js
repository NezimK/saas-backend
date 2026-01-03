require('dotenv').config();
const axios = require('axios');

const n8nAPI = axios.create({
    baseURL: process.env.N8N_API_URL,
    headers: {
        'X-N8N-API-KEY': process.env.N8N_API_KEY,
        'Content-Type': 'application/json'
    }
});

async function testGmailCredentialFormats() {
    const testFormats = [
        {
            name: 'Test 1 - OAuth2 standard',
            type: 'gmailOAuth2',
            data: {
                oauthTokenData: {
                    access_token: 'fake_access_token',
                    refresh_token: 'fake_refresh_token',
                    token_type: 'Bearer',
                    expiry_date: Date.now() + 3600000
                }
            }
        },
        {
            name: 'Test 2 - Google OAuth2 API',
            type: 'googleOAuth2Api',
            data: {
                clientId: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                oauthTokenData: {
                    access_token: 'fake_access_token',
                    refresh_token: 'fake_refresh_token',
                    token_type: 'Bearer',
                    expiry_date: Date.now() + 3600000
                }
            }
        },
        {
            name: 'Test 3 - Service Account',
            type: 'gmailOAuth2',
            data: {
                authentication: 'serviceAccount',
                email: 'test@example.com'
            }
        }
    ];

    for (const format of testFormats) {
        try {
            console.log(`\n🧪 Test: ${format.name}`);
            console.log('Payload:', JSON.stringify(format, null, 2));

            const response = await n8nAPI.post('/credentials', format);
            console.log(`✅ Succès! ID: ${response.data.id}`);

            // Supprime le credential de test
            await n8nAPI.delete(`/credentials/${response.data.id}`);
            console.log('🗑️  Credential supprimé');

        } catch (error) {
            console.error(`❌ Échec:`, error.response?.data?.message || error.message);
        }
    }
}

testGmailCredentialFormats().catch(console.error);
