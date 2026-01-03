require('dotenv').config();
const axios = require('axios');

const n8nAPI = axios.create({
    baseURL: process.env.N8N_API_URL,
    headers: {
        'X-N8N-API-KEY': process.env.N8N_API_KEY,
        'Content-Type': 'application/json'
    }
});

async function listCredentials() {
    try {
        const response = await n8nAPI.get('/credentials');
        console.log('📋 Credentials existants dans n8n:\n');

        if (response.data && response.data.data) {
            response.data.data.forEach((cred, index) => {
                console.log(`${index + 1}. ${cred.name}`);
                console.log(`   Type: ${cred.type}`);
                console.log(`   ID: ${cred.id}`);
                console.log('');
            });
            console.log(`Total: ${response.data.data.length} credentials`);
        }
    } catch (error) {
        console.error('❌ Erreur:', error.response?.data || error.message);
    }
}

listCredentials();
