# Solution Finale: Gestion des Credentials Gmail par Tenant

## Problème

n8n ne permet pas de créer des credentials Gmail OAuth2 via l'API avec des tokens pré-existants. C'est une limitation de sécurité intentionnelle.

## Solution Recommandée: Workflow d'Onboarding avec Redirection vers n8n

### Architecture

```
1. User → Notre App (OAuth Gmail) → Tokens sauvegardés dans Supabase
2. Notre App → Redirige vers n8n avec instructions
3. User → Crée credential Gmail dans n8n (OAuth géré par n8n)
4. n8n → Retourne credential ID
5. Notre App → Sauvegarde credential ID dans Supabase
6. Notre App → Crée le workflow avec ce credential ID
```

### Implémentation

#### Étape 1: Onboarding Flow Modifié

```javascript
// controllers/oauthController.js
async handleGmailCallback(req, res) {
  // ... sauvegarde des tokens dans Supabase ...

  res.send(`
    <h1>✅ Gmail connecté!</h1>
    <p>Dernière étape: Configurez votre credential n8n</p>
    <a href="https://n8n.emkai.fr/credentials/new/googleOAuth2Api?returnUrl=${encodeURIComponent(`http://localhost:3000/api/onboarding/credential-callback?tenantId=${tenantId}`)}">
      <button>Configurer n8n maintenant</button>
    </a>
  `);
}
```

#### Étape 2: Callback après Création Credential

```javascript
// routes/onboardingRoutes.js
router.get('/credential-callback', async (req, res) => {
  const { tenantId, credentialId } = req.query;

  // Sauvegarder le credential ID
  await supabaseService.supabase
    .from('tenants')
    .update({ gmail_credential_id: credentialId })
    .eq('tenant_id', tenantId);

  // Créer automatiquement le workflow
  await n8nService.createWorkflow(template, tenantId, credentialId);

  res.send('✅ Configuration terminée!');
});
```

#### Étape 3: Création de Workflow avec Credential

```javascript
async function createWorkflow(template, tenantId, credentialId) {
  const workflow = {
    ...template,
    nodes: template.nodes.map(node => {
      if (node.type === 'n8n-nodes-base.gmailTrigger') {
        return {
          ...node,
          credentials: {
            googleOAuth2Api: {
              id: credentialId,
              name: `Gmail - ${tenantId}`
            }
          }
        };
      }
      return node;
    })
  };

  return await n8nAPI.post('/workflows', workflow);
}
```

## Alternative: Workflow sans Credentials

Si la redirection vers n8n est trop complexe pour l'UX, utilisons directement l'API Gmail avec les tokens qu'on a déjà.

### Avantages
- ✅ Complètement automatisé
- ✅ Pas besoin d'accès à l'interface n8n
- ✅ Contrôle total sur les tokens

### Inconvénients
- ❌ Gestion manuelle du refresh token
- ❌ Tokens en clair dans les workflows (solution: les stocker dans n8n variables d'environnement)

### Implémentation

```javascript
// Workflow avec HTTP Request au lieu de Gmail Trigger
{
  nodes: [
    {
      name: "Schedule",
      type: "n8n-nodes-base.scheduleTrigger",
      parameters: { interval: [{ field: "minutes", minutesInterval: 1 }] }
    },
    {
      name: "Get Tenant Tokens",
      type: "n8n-nodes-base.supabase",
      parameters: {
        operation: "get",
        table: "tenants",
        filters: { tenant_id: "{{$env.TENANT_ID}}" }
      }
    },
    {
      name: "Gmail API - List Messages",
      type: "n8n-nodes-base.httpRequest",
      parameters: {
        url: "https://gmail.googleapis.com/gmail/v1/users/me/messages",
        authentication: "none",
        options: {
          queryParameters: {
            parameters: [
              { name: "q", value: "from:*@leboncoin.fr OR from:*@seloger.com" },
              { name: "access_token", value: "={{$json.email_oauth_tokens.access_token}}" }
            ]
          }
        }
      }
    }
  ]
}
```

## Refresh Token Handler

Créer un endpoint pour gérer le refresh automatique:

```javascript
// services/gmailTokenService.js
async function refreshAccessToken(tenantId) {
  const { data: tenant } = await supabase
    .from('tenants')
    .select('email_oauth_tokens')
    .eq('tenant_id', tenantId)
    .single();

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    refresh_token: tenant.email_oauth_tokens.refresh_token
  });

  const { credentials } = await oauth2Client.refreshAccessToken();

  // Sauvegarder le nouveau token
  await supabase
    .from('tenants')
    .update({
      email_oauth_tokens: {
        ...tenant.email_oauth_tokens,
        access_token: credentials.access_token,
        expiry_date: credentials.expiry_date
      }
    })
    .eq('tenant_id', tenantId);

  return credentials.access_token;
}
```

## Recommandation Finale

**Pour un MVP**: Utilisez l'approche HTTP Request avec refresh token automatique
**Pour la production**: Implémentez le flow avec redirection vers n8n pour créer les credentials

Le choix dépend de votre priorité:
- **Rapidité** → HTTP Request
- **Sécurité & Scaling** → Redirection n8n
