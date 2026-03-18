-- =============================================================================
-- Vitalio_Medical - Schéma données de santé (patients, devices, mesures, alertes, prévisions)
-- Aucune donnée d'identité (nom, email) : uniquement medical_patient_id.
-- Exécuter après 01_create_databases.sql (connexion sur Vitalio_Medical).
-- =============================================================================

USE Vitalio_Medical;
GO

-- -----------------------------------------------------------------------------
-- Schéma
-- -----------------------------------------------------------------------------
CREATE SCHEMA medical;
GO

-- -----------------------------------------------------------------------------
-- Patients : uniquement l'identifiant médical (lien identité via Vitalio_Identity.Identity_Pivot)
-- -----------------------------------------------------------------------------
CREATE TABLE medical.Patients (
    medical_patient_id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
    created_at         DATETIME2(7)    NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Patients PRIMARY KEY (medical_patient_id)
);
GO

-- -----------------------------------------------------------------------------
-- Devices : association device_id (ex. SIM-ESP32-001) <-> patient
-- Les données MQTT arrivent avec un device_id ; on en déduit le medical_patient_id.
-- -----------------------------------------------------------------------------
CREATE TABLE medical.Devices (
    device_id           NVARCHAR(64)   NOT NULL,
    medical_patient_id   UNIQUEIDENTIFIER NOT NULL,
    description         NVARCHAR(256)  NULL,
    created_at          DATETIME2(7)   NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Devices PRIMARY KEY (device_id),
    CONSTRAINT FK_Devices_Patients FOREIGN KEY (medical_patient_id) REFERENCES medical.Patients(medical_patient_id)
);
GO

CREATE INDEX IX_Devices_patient ON medical.Devices (medical_patient_id);
GO

-- -----------------------------------------------------------------------------
-- Measurements : données vitales (origine MQTT / simulateur)
-- Structure alignée sur le payload vitalio/dev/{device_id}/measurements
-- -----------------------------------------------------------------------------
CREATE TABLE medical.Measurements (
    id                  BIGINT IDENTITY(1,1) NOT NULL,
    medical_patient_id   UNIQUEIDENTIFIER NOT NULL,
    device_id            NVARCHAR(64)   NOT NULL,
    timestamp_utc        DATETIME2(7)    NOT NULL,
    heart_rate           INT            NULL,   -- MAX30102 BPM
    spo2                 INT            NULL,   -- MAX30102 SpO2 %
    object_temp          DECIMAL(5,2)   NULL,   -- MLX90614 °C
    ambient_temp         DECIMAL(5,2)   NULL,   -- MLX90614 °C
    signal_quality       INT            NULL,
    simulated            BIT            NOT NULL DEFAULT 1,
    created_at           DATETIME2(7)   NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Measurements PRIMARY KEY (id),
    CONSTRAINT FK_Measurements_Patients FOREIGN KEY (medical_patient_id) REFERENCES medical.Patients(medical_patient_id),
    CONSTRAINT FK_Measurements_Devices  FOREIGN KEY (device_id) REFERENCES medical.Devices(device_id)
);
GO

CREATE INDEX IX_Measurements_patient_time ON medical.Measurements (medical_patient_id, timestamp_utc);
CREATE INDEX IX_Measurements_device_time ON medical.Measurements (device_id, timestamp_utc);
GO

-- -----------------------------------------------------------------------------
-- Alerts : alertes générées par le moteur (seuils, IA)
-- -----------------------------------------------------------------------------
CREATE TABLE medical.Alerts (
    id                  BIGINT IDENTITY(1,1) NOT NULL,
    medical_patient_id   UNIQUEIDENTIFIER NOT NULL,
    alert_type          NVARCHAR(64)    NOT NULL,  -- ex. 'spo2_low', 'heart_rate_high'
    severity            NVARCHAR(32)    NOT NULL,  -- 'info' | 'warning' | 'critical'
    message             NVARCHAR(512)   NULL,
    triggered_at        DATETIME2(7)   NOT NULL DEFAULT SYSUTCDATETIME(),
    acknowledged_at     DATETIME2(7)   NULL,
    created_at          DATETIME2(7)   NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Alerts PRIMARY KEY (id),
    CONSTRAINT FK_Alerts_Patients FOREIGN KEY (medical_patient_id) REFERENCES medical.Patients(medical_patient_id)
);
GO

CREATE INDEX IX_Alerts_patient ON medical.Alerts (medical_patient_id, triggered_at);
GO

-- -----------------------------------------------------------------------------
-- Predictions : prévisions / tendances issues du pipeline ML
-- -----------------------------------------------------------------------------
CREATE TABLE medical.Predictions (
    id                  BIGINT IDENTITY(1,1) NOT NULL,
    medical_patient_id   UNIQUEIDENTIFIER NOT NULL,
    prediction_type     NVARCHAR(64)    NOT NULL,  -- ex. 'trend_hr', 'trend_spo2', 'forecast_24h'
    value_json          NVARCHAR(MAX)   NULL,      -- JSON (valeurs, courbes, etc.)
    predicted_at        DATETIME2(7)    NOT NULL,
    created_at          DATETIME2(7)   NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Predictions PRIMARY KEY (id),
    CONSTRAINT FK_Predictions_Patients FOREIGN KEY (medical_patient_id) REFERENCES medical.Patients(medical_patient_id)
);
GO

CREATE INDEX IX_Predictions_patient ON medical.Predictions (medical_patient_id, predicted_at);
GO
