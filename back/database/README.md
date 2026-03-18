# Vitalio – Scripts SQL Server

Exécuter les scripts **dans l’ordre** (SSMS, Azure Data Studio ou sqlcmd).

## Ordre d’exécution

| Fichier | Base cible | Contenu |
|---------|------------|---------|
| **01_create_databases.sql** | (master) | Création des bases `Vitalio_Identity` et `Vitalio_Medical` |
| **02_identity_schema.sql** | Vitalio_Identity | Schéma `identity` : Users, Identity_Pivot, Doctor_Patients, Caregiver_Patients |
| **03_medical_schema.sql** | Vitalio_Medical | Schéma `medical` : Patients, Devices, Measurements, Alerts, Predictions |

## Connexion

- Serveur : `localhost` (ou `localhost,1433` si SQL Server en local).
- Après exécution de **01** : sélectionner la base **Vitalio_Identity**, exécuter **02** ; puis sélectionner **Vitalio_Medical**, exécuter **03**.

## Flux des données MQTT

Les messages reçus sur `vitalio/dev/{device_id}/measurements` doivent être traités par un service (API ou worker) qui :

1. Lit le `device_id` depuis le topic ou le payload.
2. Trouve le `medical_patient_id` via la table `medical.Devices`.
3. Insère une ligne dans `medical.Measurements` (heart_rate, spo2, object_temp, ambient_temp, etc.).

La base **Vitalio_Medical** ne contient aucune donnée d’identité ; le lien avec l’utilisateur (email, nom) se fait via **Vitalio_Identity** et la table **Identity_Pivot**.
