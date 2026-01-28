const supabaseService = require('./supabaseService');

class TenantSchemaService {
  /**
   * Convertit un tenant_id UUID en nom de schéma PostgreSQL
   * Exemple: "3b315d0e-9f73-4f3b-b0a0-bac52c6305ed" → "tenant_3b315d0e9f734f3bb0a0bac52c6305ed"
   */
  getTenantSchemaName(tenantId) {
    const sanitized = tenantId.replace(/-/g, '');
    return `tenant_${sanitized}`;
  }

  /**
   * Retourne le nom qualifié d'une table pour un tenant
   * Exemple: getTenantTableName("3b315d0e...", "leads") → "tenant_3b315d0e9f73.leads"
   */
  getTenantTableName(tenantId, tableName) {
    const schema = this.getTenantSchemaName(tenantId);
    return `${schema}.${tableName}`;
  }

  /**
   * Crée le schéma PostgreSQL pour un tenant
   */
  async createTenantSchema(tenantId) {
    console.log('🔍 [DEBUG createTenantSchema] Début');
    console.log('🔍 [DEBUG] tenantId reçu:', tenantId);
    console.log('🔍 [DEBUG] type de tenantId:', typeof tenantId);

    const schemaName = this.getTenantSchemaName(tenantId);

    console.log(`📁 Création du schéma: ${schemaName}`);

    const sql = `
      -- Créer le schéma
      CREATE SCHEMA IF NOT EXISTS ${schemaName};

      -- Donner les permissions aux rôles Supabase
      GRANT USAGE ON SCHEMA ${schemaName} TO anon, authenticated, service_role;
      GRANT ALL ON ALL TABLES IN SCHEMA ${schemaName} TO anon, authenticated, service_role;
      GRANT ALL ON ALL SEQUENCES IN SCHEMA ${schemaName} TO anon, authenticated, service_role;
      GRANT ALL ON ALL FUNCTIONS IN SCHEMA ${schemaName} TO anon, authenticated, service_role;

      -- Permissions par défaut pour les futures tables
      ALTER DEFAULT PRIVILEGES IN SCHEMA ${schemaName} GRANT ALL ON TABLES TO anon, authenticated, service_role;
      ALTER DEFAULT PRIVILEGES IN SCHEMA ${schemaName} GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
      ALTER DEFAULT PRIVILEGES IN SCHEMA ${schemaName} GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
    `;

    try {
      console.log('🔍 [DEBUG] Exécution SQL pour créer le schéma...');
      console.log('🔍 [DEBUG] SQL:', sql.substring(0, 200) + '...');

      const result = await supabaseService.executeRawSQL(sql);

      console.log('🔍 [DEBUG] Résultat executeRawSQL:', JSON.stringify(result));
      console.log(`✅ Schéma ${schemaName} créé avec succès`);
    } catch (error) {
      console.error(`❌ Erreur création schéma ${schemaName}:`, error.message);
      console.error('🔍 [DEBUG] Stack:', error.stack);
      throw error;
    }
  }

  /**
   * Crée les tables leads et biens dans le schéma du tenant
   */
  async createTenantTables(tenantId) {
    console.log('🔍 [DEBUG createTenantTables] Début');

    const schemaName = this.getTenantSchemaName(tenantId);

    console.log(`📊 Création des tables dans: ${schemaName}`);

    const sql = `
      -- ============================================
      -- TABLE LEADS
      -- ============================================
      CREATE TABLE IF NOT EXISTS ${schemaName}.leads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,

        -- Informations contact
        email VARCHAR(255),
        phone VARCHAR(255),
        first_name VARCHAR(255),
        last_name VARCHAR(255),

        -- Référence bien
        property_reference VARCHAR(255),
        bien_associe VARCHAR(255),

        -- Source et statut
        source VARCHAR(255),
        status VARCHAR(50),

        -- Notes et IA
        notes TEXT,
        pause_ia BOOLEAN DEFAULT false,

        -- Conversation et qualification
        conversation_json TEXT,
        statut TEXT,
        score TEXT CHECK (score IN ('CHAUD', 'TIEDE', 'FROID')),

        -- Données de qualification
        projet TEXT,
        financement TEXT,
        delai TEXT,

        -- Métadonnées
        last_message_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Index pour leads
      CREATE INDEX IF NOT EXISTS idx_${schemaName.replace('-', '_')}_leads_statut ON ${schemaName}.leads(statut);
      CREATE INDEX IF NOT EXISTS idx_${schemaName.replace('-', '_')}_leads_score ON ${schemaName}.leads(score);
      CREATE INDEX IF NOT EXISTS idx_${schemaName.replace('-', '_')}_leads_tenant_id ON ${schemaName}.leads(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_${schemaName.replace('-', '_')}_leads_last_message ON ${schemaName}.leads(last_message_at DESC);
      CREATE INDEX IF NOT EXISTS idx_${schemaName.replace('-', '_')}_leads_email ON ${schemaName}.leads(email);
      CREATE INDEX IF NOT EXISTS idx_${schemaName.replace('-', '_')}_leads_phone ON ${schemaName}.leads(phone);

      -- ============================================
      -- TABLE BIENS
      -- ============================================
      CREATE TABLE IF NOT EXISTS ${schemaName}.biens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,

        -- Références
        ref_externe VARCHAR(255),
        reference VARCHAR(255),

        -- Informations bien
        type_bien VARCHAR(100),
        type_offre VARCHAR(50),
        description TEXT,

        -- Caractéristiques
        surface NUMERIC,
        nb_pieces INTEGER,
        nb_chambres INTEGER,

        -- Prix
        prix_vente NUMERIC,
        loyer NUMERIC,

        -- Métadonnées
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Index pour biens
      CREATE INDEX IF NOT EXISTS idx_${schemaName.replace('-', '_')}_biens_ref_externe ON ${schemaName}.biens(ref_externe);
      CREATE INDEX IF NOT EXISTS idx_${schemaName.replace('-', '_')}_biens_reference ON ${schemaName}.biens(reference);
      CREATE INDEX IF NOT EXISTS idx_${schemaName.replace('-', '_')}_biens_tenant_id ON ${schemaName}.biens(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_${schemaName.replace('-', '_')}_biens_type_offre ON ${schemaName}.biens(type_offre);

      -- ============================================
      -- TRIGGERS UPDATED_AT
      -- ============================================

      -- Fonction de mise à jour du updated_at (si elle n'existe pas déjà)
      CREATE OR REPLACE FUNCTION ${schemaName}.update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      -- Trigger pour leads
      DROP TRIGGER IF EXISTS update_leads_updated_at ON ${schemaName}.leads;
      CREATE TRIGGER update_leads_updated_at
          BEFORE UPDATE ON ${schemaName}.leads
          FOR EACH ROW
          EXECUTE FUNCTION ${schemaName}.update_updated_at_column();

      -- Trigger pour biens
      DROP TRIGGER IF EXISTS update_biens_updated_at ON ${schemaName}.biens;
      CREATE TRIGGER update_biens_updated_at
          BEFORE UPDATE ON ${schemaName}.biens
          FOR EACH ROW
          EXECUTE FUNCTION ${schemaName}.update_updated_at_column();
    `;

    try {
      console.log('🔍 [DEBUG] Exécution SQL pour créer les tables...');
      console.log('🔍 [DEBUG] SQL (premiers 300 chars):', sql.substring(0, 300) + '...');

      const result = await supabaseService.executeRawSQL(sql);

      console.log('🔍 [DEBUG] Résultat executeRawSQL:', JSON.stringify(result));
      console.log(`✅ Tables leads et biens créées dans ${schemaName}`);
    } catch (error) {
      console.error(`❌ Erreur création tables dans ${schemaName}:`, error.message);
      console.error('🔍 [DEBUG] Stack:', error.stack);
      throw error;
    }
  }

  /**
   * Supprime le schéma d'un tenant (pour cleanup/tests)
   */
  async dropTenantSchema(tenantId) {
    const schemaName = this.getTenantSchemaName(tenantId);

    console.log(`🗑️  Suppression du schéma: ${schemaName}`);

    const sql = `DROP SCHEMA IF EXISTS ${schemaName} CASCADE;`;

    try {
      await supabaseService.executeRawSQL(sql);
      console.log(`✅ Schéma ${schemaName} supprimé`);
    } catch (error) {
      console.error(`❌ Erreur suppression schéma ${schemaName}:`, error.message);
      throw error;
    }
  }
}

module.exports = new TenantSchemaService();
