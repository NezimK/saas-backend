/**
 * Test de création d'un credential Gmail OAuth2 via l'API n8n
 */

require('dotenv').config();
const axios = require('axios');

const n8nAPI = axios.create({
    baseURL: process.env.N8N_API_URL,
    headers: {
        'X-N8N-API-KEY': process.env.N8N_API_KEY,
        'Content-Type': 'application/json'
    }
});

async function testCreateCredential() {
    try {
        console.log('🔍 Exploration de l\'API Credentials n8n\n');

        // 1. Lister les types de credentials disponibles
        console.log('1️⃣  Récupération des types de credentials...');
        try {
            const { data: credentialTypes } = await n8nAPI.get('/credential-types');

            // Chercher les types Gmail/Google OAuth
            const gmailTypes = credentialTypes.filter(type =>
                type.name && (
                    type.name.toLowerCase().includes('gmail') ||
                    type.name.toLowerCase().includes('google') && type.name.toLowerCase().includes('oauth')
                )
            );

            console.log('\n📋 Types de credentials Gmail/Google OAuth trouvés:');
            gmailTypes.forEach(type => {
                console.log(`   - ${type.name}: ${type.displayName || 'N/A'}`);
            });
        } catch (error) {
            console.log('⚠️  Endpoint /credential-types non disponible');
        }

        // 2. Tenter de créer un nouveau credential Gmail OAuth2
        console.log('\n2️⃣  Test de création d\'un credential Gmail OAuth2...');

        const newCredential = {
            name: `Gmail OAuth - Test - ${Date.now()}`,
            type: 'googleOAuth2Api',
            data: {
                clientId: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                scope: 'https://www.googleapis.com/auth/gmail.readonly',
            }
        };

        console.log('\n📤 Payload:');
        console.log(JSON.stringify(newCredential, null, 2));

        const { data: created } = await n8nAPI.post('/credentials', newCredential);
        console.log('\n✅ Credential créé avec succès !');
        console.log(`   ID: ${created.id}`);
        console.log(`   Name: ${created.name}`);
        console.log(`   Type: ${created.type}`);

        // 3. Supprimer le credential de test
        console.log('\n3️⃣  Suppression du credential de test...');
        await n8nAPI.delete(`/credentials/${created.id}`);
        console.log('✅ Credential de test supprimé');

    } catch (error) {
        console.error('\n❌ Erreur:', error.response?.data || error.message);
        if (error.response?.data) {
            console.log('\n📄 Détails de l\'erreur:');
            console.log(JSON.stringify(error.response.data, null, 2));
        }
    }
}

testCreateCredential();
