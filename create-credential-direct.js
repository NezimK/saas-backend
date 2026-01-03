/**
 * Script pour créer des credentials Gmail dans n8n en utilisant
 * leur système de chiffrement interne
 *
 * Cette approche contourne l'API REST en utilisant directement
 * les fonctions internes de n8n pour chiffrer et stocker les credentials
 */

require('dotenv').config();
const axios = require('axios');
const crypto = require('crypto');
const supabaseService = require('./services/supabaseService');
const oauthConfig = require('./config/oauth');

const n8nAPI = axios.create({
    baseURL: process.env.N8N_API_URL,
    headers: {
        'X-N8N-API-KEY': process.env.N8N_API_KEY,
        'Content-Type': 'application/json'
    }
});

/**
 * Chiffre les données du credential comme n8n le fait en interne
 * n8n utilise AES-256-CBC pour chiffrer les credentials sensibles
 */
function encryptCredentialData(data, encryptionKey) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(encryptionKey, 'hex'), iv);

    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return {
        iv: iv.toString('hex'),
        data: encrypted
    };
}

/**
 * Crée un credential Gmail avec les tokens OAuth déjà chiffrés
 */
async function createCredentialDirect(tenantId) {
    try {
        console.log(`🔐 Création directe du credential Gmail pour: ${tenantId}\n`);

        // 1. Récupérer les tokens
        const { data: tenant } = await supabaseService.supabase
            .from('tenants')
            .select('*')
            .eq('tenant_id', tenantId)
            .single();

        if (!tenant || !tenant.email_oauth_tokens) {
            throw new Error(`Tenant ${tenantId} n'a pas de tokens OAuth`);
        }

        const tokens = tenant.email_oauth_tokens;
        console.log('✅ Tokens OAuth récupérés');

        // 2. Préparer les données du credential au format n8n
        const credentialData = {
            clientId: oauthConfig.google.clientId,
            clientSecret: oauthConfig.google.clientSecret,
            oauthTokenData: {
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                scope: 'https://www.googleapis.com/auth/gmail.readonly https://mail.google.com/',
                token_type: tokens.token_type || 'Bearer',
                expiry_date: tokens.expiry_date
            }
        };

        // 3. Chiffrer les données si on a la clé de chiffrement n8n
        const encryptionKey = process.env.N8N_ENCRYPTION_KEY;

        let payload;

        if (encryptionKey) {
            console.log('🔐 Chiffrement des données sensibles...');
            const encrypted = encryptCredentialData(credentialData, encryptionKey);

            payload = {
                name: `Gmail - ${tenantId}`,
                type: 'googleOAuth2Api',
                data: encrypted.data,
                iv: encrypted.iv
            };
        } else {
            console.log('⚠️  Pas de clé de chiffrement - envoi en clair');
            payload = {
                name: `Gmail - ${tenantId}`,
                type: 'googleOAuth2Api',
                data: credentialData
            };
        }

        // 4. Tenter de créer le credential
        console.log('📤 Envoi du credential à n8n...');
        console.log('Payload type:', payload.type);

        const response = await n8nAPI.post('/credentials', payload);

        console.log(`✅ Credential créé! ID: ${response.data.id}`);

        // 5. Sauvegarder dans Supabase
        await supabaseService.supabase
            .from('tenants')
            .update({ gmail_credential_id: response.data.id })
            .eq('tenant_id', tenantId);

        console.log('✅ Credential ID sauvegardé dans Supabase');
        console.log(`\n🎉 SUCCÈS! Le credential ${response.data.id} est prêt.`);

        return response.data.id;

    } catch (error) {
        console.error('❌ Erreur:', error.response?.data || error.message);
        throw error;
    }
}

// Exécution
const tenantId = process.argv[2];

if (!tenantId) {
    console.error('❌ Usage: node create-credential-direct.js <tenantId>');
    console.error('   Exemple: node create-credential-direct.js test-tenant-001');
    process.exit(1);
}

createCredentialDirect(tenantId);
