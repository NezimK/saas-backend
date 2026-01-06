-- Migration: Ajouter la colonne email_filters pour stocker les portails sélectionnés
-- Date: 2026-01-02

ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS email_filters JSONB DEFAULT '["leboncoin.fr", "seloger.com", "pap.fr", "logic-immo.com", "bienici.com"]'::jsonb;

-- Commentaire pour documenter la colonne
COMMENT ON COLUMN tenants.email_filters IS 'Liste des domaines de portails immobiliers à filtrer (ex: ["leboncoin.fr", "seloger.com"])';
