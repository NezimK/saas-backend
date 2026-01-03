# Test du Flux d'Onboarding Complet

## Ce qui va se passer automatiquement

Quand vous allez sur l'URL OAuth:
```
http://localhost:3000/auth/gmail/connect?tenantId=nouveau-client-001
```

### Étape 1: Redirection vers Google OAuth
- Vous serez redirigé vers Google pour autoriser l'accès Gmail
- Autorisez l'accès à votre compte Gmail

### Étape 2: Callback Automatique
Le système va automatiquement:

1. ✅ Récupérer les tokens OAuth (access_token + refresh_token)
2. ✅ Créer ou mettre à jour le tenant dans Supabase
3. ✅ Sauvegarder les tokens dans Supabase
4. ✅ Créer automatiquement le workflow n8n complet
5. ✅ Activer le workflow
6. ✅ Sauvegarder l'ID du workflow dans Supabase

### Étape 3: Résultat
Vous verrez une page de confirmation avec:
- ✅ Gmail connecté
- ✅ Tokens sauvegardés
- ✅ Workflow créé avec son ID
- 🎉 Système prêt

## Pour tester maintenant

1. Ouvrez votre navigateur
2. Allez sur: `http://localhost:3000/auth/gmail/connect?tenantId=nouveau-client-001`
3. Autorisez l'accès Gmail
4. Observez les logs du serveur pour voir la magie opérer !

## Vérification après le test

```bash
# Vérifier que le tenant a bien été créé avec le workflow
node check-tenant-tokens.js nouveau-client-001

# Vérifier dans n8n
# Ouvrez https://n8n.emkai.fr et vérifiez que le workflow "Email Parser - nouveau-client-001" existe
```

## Ce que le workflow fait

Le workflow créé automatiquement:
- 🔄 S'exécute toutes les minutes
- 📧 Récupère un access token valide (auto-refresh si expiré)
- 📥 Cherche les emails de Leboncoin et SeLoger
- 🔍 Parse chaque email avec OpenAI
- 📊 Envoie les données à Airtable

**Tout est 100% automatisé !**
