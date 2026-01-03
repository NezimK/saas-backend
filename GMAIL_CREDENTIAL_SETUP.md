# Configuration du Credential Gmail dans n8n

## Problème

L'API n8n ne permet pas facilement de créer des credentials Gmail OAuth2 via programmation. Le schéma de validation est complexe et nécessite plusieurs champs spécifiques qui varient selon le type de credential.

## Solution: Création Manuelle

### Étape 1: Connexion OAuth de l'utilisateur

L'utilisateur se connecte via le flux OAuth:
```
http://localhost:3000/auth/gmail/connect?tenantId=XXX
```

Les tokens OAuth (access_token, refresh_token) sont automatiquement sauvegardés dans Supabase dans la table `tenants`.

### Étape 2: Création du Credential dans n8n (Interface Web)

1. Ouvrez l'interface n8n: `http://localhost:5678`
2. Allez dans **Settings** → **Credentials**
3. Cliquez sur **+ New Credential**
4. Sélectionnez **Google OAuth2 API** (PAS "Gmail OAuth2")
5. Remplissez les champs:
   - **Name**: `Gmail - [tenant_id]` (ex: `Gmail - test-tenant-001`)
   - **Client ID**: Votre Google Client ID
   - **Client Secret**: Votre Google Client Secret
   - **Scope**: `https://www.googleapis.com/auth/gmail.readonly https://mail.google.com/`
   - **Auth URI**: `https://accounts.google.com/o/oauth2/v2/auth`
   - **Token URI**: `https://oauth2.googleapis.com/token`
   - **Authentication**: OAuth2

6. Cliquez sur **"Connect my account"** et autorisez l'accès Gmail

7. Une fois créé, notez l'ID du credential (visible dans l'URL ou via l'API)

### Étape 3: Lier le Credential au Tenant dans Supabase

Exécutez cette requête SQL dans Supabase:

```sql
UPDATE tenants
SET gmail_credential_id = '[ID_DU_CREDENTIAL_N8N]'
WHERE tenant_id = '[TENANT_ID]';
```

Ou utilisez le script:
```bash
node update-tenant-credential.js test-tenant-001 [CREDENTIAL_ID]
```

### Étape 4: Utiliser le Credential dans les Workflows

Lors de la création du workflow, référencez le credential:

```javascript
{
  "nodes": [
    {
      "name": "Gmail Trigger",
      "type": "n8n-nodes-base.gmailTrigger",
      "credentials": {
        "googleOAuth2Api": {
          "id": "[CREDENTIAL_ID]",
          "name": "Gmail - test-tenant-001"
        }
      }
    }
  ]
}
```

## Alternative: Credential Partagé

Si tous les tenants utilisent le même compte Gmail (ex: un compte de service), vous pouvez:

1. Créer UN seul credential Gmail dans n8n
2. Le référencer dans tous les workflows
3. Filtrer les emails par tenant dans le workflow (via le corps de l'email, metadata, etc.)

## Tests Effectués

Les types de credentials testés qui n'ont PAS fonctionné via l'API:
- `gmailOAuth2` - Nécessite `serverUrl` qui n'est pas applicable
- `googleOAuth2Api` sans `scope` - Validation échoue
- `googleOAuth2Api` avec `accessToken`/`refreshToken` directs - Propriétés non autorisées

Le seul qui fonctionne via l'interface web:
- `googleOAuth2Api` avec le flux OAuth complet via l'interface n8n
