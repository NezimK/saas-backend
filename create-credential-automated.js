/**
 * Script d'automatisation pour créer des credentials Gmail dans n8n
 * via l'interface web en utilisant Puppeteer
 *
 * Installation: npm install puppeteer
 * Usage: node create-credential-automated.js <tenantId>
 */

require('dotenv').config();
const puppeteer = require('puppeteer');
const supabaseService = require('./services/supabaseService');
const oauthConfig = require('./config/oauth');

async function createGmailCredentialAutomated(tenantId) {
    let browser;

    try {
        console.log(`🤖 Création automatisée du credential Gmail pour: ${tenantId}\n`);

        // 1. Récupérer les tokens du tenant
        const { data: tenant, error } = await supabaseService.supabase
            .from('tenants')
            .select('*')
            .eq('tenant_id', tenantId)
            .single();

        if (error || !tenant || !tenant.email_oauth_tokens) {
            throw new Error(`Tenant ${tenantId} n'a pas de tokens OAuth`);
        }

        console.log('✅ Tokens OAuth récupérés');

        const tokens = tenant.email_oauth_tokens;
        const n8nUrl = process.env.N8N_WEB_URL || 'https://n8n.emkai.fr';
        const n8nEmail = process.env.N8N_EMAIL;
        const n8nPassword = process.env.N8N_PASSWORD;

        if (!n8nEmail || !n8nPassword) {
            throw new Error('N8N_EMAIL et N8N_PASSWORD doivent être définis dans .env');
        }

        // 2. Lancer le navigateur
        console.log('🌐 Lancement du navigateur...');
        browser = await puppeteer.launch({
            headless: false, // Mettez true pour mode silencieux
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        // 3. Se connecter à n8n
        console.log('🔑 Connexion à n8n...');
        await page.goto(`${n8nUrl}/signin`);

        await page.waitForSelector('input[type="email"]', { timeout: 10000 });
        await page.type('input[type="email"]', n8nEmail);
        await page.type('input[type="password"]', n8nPassword);
        await page.click('button[type="submit"]');

        // Attendre la redirection après login
        await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 });
        console.log('✅ Connecté à n8n');

        // 4. Aller sur la page des credentials
        console.log('📋 Navigation vers les credentials...');
        await page.goto(`${n8nUrl}/credentials`);
        await page.waitForSelector('[data-test-id="resources-list-add"]', { timeout: 10000 });

        // 5. Créer un nouveau credential
        console.log('➕ Création d\'un nouveau credential...');
        await page.click('[data-test-id="resources-list-add"]');

        // Attendre le modal de sélection de type
        await page.waitForSelector('input[placeholder*="Search"]', { timeout: 5000 });

        // Chercher "Google OAuth2 API"
        await page.type('input[placeholder*="Search"]', 'Google OAuth2 API');
        await page.waitForTimeout(1000);

        // Cliquer sur le premier résultat
        await page.click('[data-test-id="credential-select-item-googleOAuth2Api"]');

        // 6. Remplir les informations du credential
        console.log('📝 Remplissage des informations...');
        await page.waitForSelector('input[name="name"]', { timeout: 5000 });

        // Nom du credential
        await page.evaluate(() => {
            document.querySelector('input[name="name"]').value = '';
        });
        await page.type('input[name="name"]', `Gmail - ${tenantId}`);

        // Client ID
        await page.waitForSelector('input[name="clientId"]');
        await page.type('input[name="clientId"]', oauthConfig.google.clientId);

        // Client Secret
        await page.waitForSelector('input[name="clientSecret"]');
        await page.type('input[name="clientSecret"]', oauthConfig.google.clientSecret);

        // 7. Cliquer sur "Connect my account"
        console.log('🔗 Connexion du compte Gmail...');
        const connectButton = await page.waitForSelector('button:has-text("Connect my account")');
        await connectButton.click();

        // Une popup OAuth s'ouvre - attendre qu'elle se ferme
        await page.waitForTimeout(2000);

        // Note: À ce stade, l'utilisateur doit manuellement autoriser dans la popup OAuth
        // On peut soit:
        // 1. Attendre manuellement
        // 2. Automatiser la popup OAuth (complexe car c'est une fenêtre séparée)
        // 3. Utiliser une approche différente

        console.log('⏳ En attente de l\'autorisation OAuth...');
        console.log('   Veuillez autoriser l\'accès Gmail dans la popup qui s\'est ouverte.');

        // Attendre que le bouton "Save" soit disponible (signe que l'OAuth a réussi)
        await page.waitForSelector('button[data-test-id="credential-save-button"]:not([disabled])', {
            timeout: 120000 // 2 minutes pour que l'utilisateur autorise
        });

        console.log('✅ OAuth autorisé!');

        // 8. Sauvegarder le credential
        console.log('💾 Sauvegarde du credential...');
        await page.click('button[data-test-id="credential-save-button"]');

        await page.waitForTimeout(2000);

        // 9. Récupérer l'ID du credential créé
        const url = page.url();
        const credentialIdMatch = url.match(/\/credentials\/([a-zA-Z0-9]+)/);

        if (!credentialIdMatch) {
            throw new Error('Impossible de récupérer l\'ID du credential');
        }

        const credentialId = credentialIdMatch[1];
        console.log(`✅ Credential créé! ID: ${credentialId}`);

        // 10. Sauvegarder l'ID dans Supabase
        console.log('💾 Sauvegarde de l\'ID dans Supabase...');
        const { error: updateError } = await supabaseService.supabase
            .from('tenants')
            .update({ gmail_credential_id: credentialId })
            .eq('tenant_id', tenantId);

        if (updateError) throw updateError;

        console.log('✅ Credential ID sauvegardé dans Supabase');
        console.log(`\n🎉 SUCCÈS! Le credential ${credentialId} est prêt à être utilisé.`);

        await browser.close();
        return credentialId;

    } catch (error) {
        console.error('❌ Erreur:', error.message);
        if (browser) await browser.close();
        throw error;
    }
}

// Exécution
const tenantId = process.argv[2];

if (!tenantId) {
    console.error('❌ Usage: node create-credential-automated.js <tenantId>');
    console.error('   Exemple: node create-credential-automated.js test-tenant-001');
    process.exit(1);
}

createGmailCredentialAutomated(tenantId);
