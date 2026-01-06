-- Migration: Ajouter la colonne email unique pour identifier les tenants
-- Date: 2026-01-04

ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Ajouter une contrainte d'unicité sur l'email
CREATE UNIQUE INDEX IF NOT EXISTS tenants_email_unique
ON tenants(email)
WHERE email IS NOT NULL;

-- Commentaire pour documenter la colonne
COMMENT ON COLUMN tenants.email IS 'Email unique du client pour identifier le tenant';
