-- =============================================================================
-- Vitalio - Création des bases SQL Server
-- Exécuter en premier (connexion sur master ou défaut).
-- =============================================================================

-- Base Identité : utilisateurs, table pivot, relations médecin/aidant-patient
CREATE DATABASE Vitalio_Identity;
GO

-- Base Données de santé : patients (anonymes), devices, mesures, alertes, prévisions
CREATE DATABASE Vitalio_Medical;
GO
