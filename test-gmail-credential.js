require('dotenv').config();
const axios = require('axios');

async function testGmailCredential() {
  const n8nAPI = axios.create({
    baseURL: process.env.N8N_API_URL,
    headers: {
      'X-N8N-API-KEY': process.env.N8N_API_KEY,
      'Content-Type': 'application/json'
    }
  });

  try {
    console.log('📋 Liste des types de credentials disponibles...\n');

    // Rechercher les credentials Gmail existants
    const { data: credentials } = await n8nAPI.get('/credentials');

    const gmailCreds = credentials.data.filter(c =>
      c.type.toLowerCase().includes('gmail') ||
      c.type.toLowerCase().includes('google')
    );

    if (gmailCreds.length > 0) {
      console.log('🔍 Credentials Gmail/Google trouvés:');
      gmailCreds.forEach(cred => {
        console.log(`\n  Type: ${cred.type}`);
        console.log(`  Name: ${cred.name}`);
        console.log(`  ID: ${cred.id}`);
      });
    } else {
      console.log('❌ Aucun credential Gmail/Google trouvé');
      console.log('\n📝 Tous les types de credentials:');
      const uniqueTypes = [...new Set(credentials.data.map(c => c.type))];
      uniqueTypes.sort().forEach(type => {
        if (type.toLowerCase().includes('oauth') || type.toLowerCase().includes('mail')) {
          console.log(`  - ${type}`);
        }
      });
    }

    console.log('\n\n🧪 Test de création avec type "googleOAuth2Api"...');

    const testCred = {
      name: `Test Gmail OAuth - ${Date.now()}`,
      type: 'googleOAuth2Api',
      data: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        oauthTokenData: JSON.stringify({
          access_token: 'test_token',
          refresh_token: 'test_refresh',
          scope: 'https://www.googleapis.com/auth/gmail.readonly',
          token_type: 'Bearer',
          expiry_date: Date.now() + 3600000
        })
      }
    };

    console.log('Payload:', JSON.stringify(testCred, null, 2));

    const { data: created } = await n8nAPI.post('/credentials', testCred);
    console.log('\n✅ Credential créé avec succès!');
    console.log('ID:', created.id);
    console.log('Type:', created.type);

    // Nettoyage
    await n8nAPI.delete(`/credentials/${created.id}`);
    console.log('🗑️  Credential de test supprimé');

  } catch (error) {
    console.error('\n❌ Erreur:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
  }
}

testGmailCredential();
