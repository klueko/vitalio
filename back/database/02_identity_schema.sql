-- =============================================================================
-- Vitalio_Identity - Schéma identités + table pivot + relations
-- Exécuter après 01_create_databases.sql (connexion sur Vitalio_Identity).
-- =============================================================================

USE Vitalio_Identity;
GO

-- -----------------------------------------------------------------------------
-- Schéma (optionnel, pour organiser les tables)
-- -----------------------------------------------------------------------------
CREATE SCHEMA identity;
GO

-- -----------------------------------------------------------------------------
-- Users : profils utilisateurs (côté identité uniquement, pas de données de santé)
-- -----------------------------------------------------------------------------
CREATE TABLE identity.Users (
    internal_user_id   UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
    email              NVARCHAR(256)    NOT NULL,
    display_name       NVARCHAR(128)    NULL,
    provider_sub       NVARCHAR(256)    NULL,   -- sub Okta/Auth0
    role               NVARCHAR(32)     NOT NULL, -- 'patient' | 'doctor' | 'caregiver' | 'admin'
    created_at         DATETIME2(7)    NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at         DATETIME2(7)    NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Users PRIMARY KEY (internal_user_id),
    CONSTRAINT UQ_Users_email UNIQUE (email)
);
GO

-- -----------------------------------------------------------------------------
-- Identity_Pivot : lien entre identité (Users) et patient médical (Vitalio_Medical)
-- Permet de résoudre "qui est ce patient ?" sans stocker de PII dans la base médicale.
-- -----------------------------------------------------------------------------
CREATE TABLE identity.Identity_Pivot (
    id                  BIGINT IDENTITY(1,1) NOT NULL,
    internal_user_id     UNIQUEIDENTIFIER NOT NULL,
    medical_patient_id   UNIQUEIDENTIFIER NOT NULL,
    role                 NVARCHAR(32)    NOT NULL,
    created_at           DATETIME2(7)   NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at           DATETIME2(7)   NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Identity_Pivot PRIMARY KEY (id),
    CONSTRAINT FK_Identity_Pivot_Users FOREIGN KEY (internal_user_id) REFERENCES identity.Users(internal_user_id),
    CONSTRAINT UQ_Identity_Pivot_medical_role UNIQUE (medical_patient_id, role),
    CONSTRAINT UQ_Identity_Pivot_user_role UNIQUE (internal_user_id, role)
);
GO

CREATE INDEX IX_Identity_Pivot_medical ON identity.Identity_Pivot (medical_patient_id);
CREATE INDEX IX_Identity_Pivot_user ON identity.Identity_Pivot (internal_user_id);
GO

-- -----------------------------------------------------------------------------
-- Doctor_Patients : quels patients un médecin a le droit de voir
-- -----------------------------------------------------------------------------
CREATE TABLE identity.Doctor_Patients (
    doctor_internal_user_id UNIQUEIDENTIFIER NOT NULL,
    medical_patient_id      UNIQUEIDENTIFIER NOT NULL,
    created_at              DATETIME2(7)   NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Doctor_Patients PRIMARY KEY (doctor_internal_user_id, medical_patient_id),
    CONSTRAINT FK_Doctor_Patients_Doctor FOREIGN KEY (doctor_internal_user_id) REFERENCES identity.Users(internal_user_id)
    -- Pas de FK vers Vitalio_Medical (base séparée)
);
GO

CREATE INDEX IX_Doctor_Patients_patient ON identity.Doctor_Patients (medical_patient_id);
GO

-- -----------------------------------------------------------------------------
-- Caregiver_Patients : quels patients un aidant a le droit de voir
-- -----------------------------------------------------------------------------
CREATE TABLE identity.Caregiver_Patients (
    caregiver_internal_user_id UNIQUEIDENTIFIER NOT NULL,
    medical_patient_id         UNIQUEIDENTIFIER NOT NULL,
    created_at                 DATETIME2(7)   NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Caregiver_Patients PRIMARY KEY (caregiver_internal_user_id, medical_patient_id),
    CONSTRAINT FK_Caregiver_Patients_Caregiver FOREIGN KEY (caregiver_internal_user_id) REFERENCES identity.Users(internal_user_id)
);
GO

CREATE INDEX IX_Caregiver_Patients_patient ON identity.Caregiver_Patients (medical_patient_id);
GO
