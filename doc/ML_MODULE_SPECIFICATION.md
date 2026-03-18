# Spécification du module Machine Learning - Détection d'anomalies VitalIO

**Version** : 1.0 
**Contexte** : Plateforme VitalIO - télésurveillance médicale

---

## 1. Vue d'ensemble

Le module ML complète le système d'alerte **règle-based** existant (seuils fixes : `heart_rate`, `spo2`, `temperature`) par une **détection d'anomalies non supervisée**. Il analyse les mesures physiologiques en continu pour identifier des comportements inhabituels que les règles statiques ne capturent pas.

### Architecture actuelle (référence)

- **Flux MQTT** : `vitalio/dev/{device_id}/measurements` → `on_mqtt_message()` → validation → `measurements.insert_one()` → `evaluate_measurement_alerts()`
- **Collections** : `measurements`, `alerts`, `alert_thresholds`, `doctor_feedback`
- **Variables physiologiques** : `heart_rate`, `spo2`, `temperature`, `signal_quality`

---

## 2. Fonctionnalités attendues

### 2.1 Détection d'anomalies physiologiques

**Objectif** : Analyser en continu les mesures et détecter les valeurs anormales.

| Élément | Spécification |
|---------|----------------|
| **Modèle** | Détection d'anomalies non supervisée (ex. **Isolation Forest** via scikit-learn) |
| **Entrées** | `heart_rate`, `spo2`, `temperature`, `signal_quality` (vecteur par mesure) |
| **Fréquence** | Chaque mesure reçue (MQTT ou API) est scorée en temps réel |
| **Intégration** | Appel du module ML après validation et avant/après insertion dans `measurements` |

---

### 2.2 Score d'anomalie et niveaux interprétables

**Objectif** : Associer à chaque mesure un score et un niveau lisible.

| Élément | Spécification |
|---------|----------------|
| **Score** | Valeur continue (ex. 0–1 ou -1 à 1 selon le modèle) indiquant le degré d'anormalité |
| **Niveaux** | `normal`, `warning`, `critical` |
| **Seuils** | Configurables (ex. via `ml_anomaly_thresholds` ou collection dédiée) |

**Exemple de configuration** :

```json
{
  "normal_max": 0.45,
  "warning_max": 0.70,
  "critical_max": 1.0
}
```

- `score <= normal_max` → `normal`
- `normal_max < score <= warning_max` → `warning`
- `score > warning_max` → `critical`

---

### 2.3 Génération d'événements d'alerte

**Objectif** : Créer des alertes ML lorsque le niveau est `critical`.

| Élément | Spécification |
|---------|----------------|
| **Déclencheur** | Niveau `critical` détecté |
| **Association** | `device_id`, `user_id_auth` (via `users_devices`) |
| **Stockage** | Table/collection dédiée `ml_anomalies` (distincte de `alerts` règle-based) |

**Schéma proposé pour `ml_anomalies`** :

```javascript
{
  "_id": ObjectId,
  "device_id": "SIM-ESP32-001",
  "user_id_auth": "auth0|...",           // résolu via users_devices
  "measurement_id": ObjectId,             // référence vers measurements
  "measured_at": ISODate,
  "anomaly_score": 0.85,
  "anomaly_level": "critical",
  "model_version": "v1.0.2",
  "contributing_variables": [...],        // cf. 2.6
  "status": "pending",                    // pending | validated | rejected
  "validated_by": null,
  "validated_at": null,
  "created_at": ISODate
}
```

---

### 2.4 Validation humaine des anomalies

**Objectif** : Permettre aux médecins/opérateurs de valider ou rejeter les anomalies.

| Élément | Spécification |
|---------|----------------|
| **Actions** | `validated` (vraie anomalie), `rejected` (faux positif) |
| **Stockage** | Champs `status`, `validated_by`, `validated_at` dans `ml_anomalies` |
| **Usage** | Alimentation du réentraînement (cf. 2.5) |

**API proposée** :

- `PATCH /api/doctor/ml-anomalies/{anomaly_id}`  
  Body : `{ "status": "validated" | "rejected" }`

---

### 2.5 Réentraînement du modèle (continual learning)

**Objectif** : Améliorer le modèle périodiquement à partir des données historiques et des validations.

| Élément | Spécification |
|---------|----------------|
| **Données** | Mesures historiques + anomalies validées/rejetées |
| **Fréquence** | Périodique (ex. quotidien ou hebdomadaire) |
| **Mécanisme** | Job planifié (cron, Celery, ou endpoint admin) |
| **Versioning** | Chaque modèle entraîné a une version stockée (ex. `model_versions`) |

**Données d'entraînement** :

- Mesures `VALID` sur fenêtre configurée
- Anomalies `validated` → renforcement des patterns anormaux
- Anomalies `rejected` → réduction des faux positifs (ex. via pondération)

---

### 2.6 Interprétabilité des résultats

**Objectif** : Expliquer simplement pourquoi une mesure est anormale.

| Élément | Spécification |
|---------|----------------|
| **Contenu** | Variable contributrice, valeur observée, intervalle normal attendu |
| **Format** | Structure `contributing_variables` dans la décision |

**Exemple** :

```json
{
  "contributing_variables": [
    {
      "variable": "spo2",
      "observed_value": 88,
      "expected_min": 92,
      "expected_max": 100,
      "contribution_weight": 0.6
    },
    {
      "variable": "heart_rate",
      "observed_value": 135,
      "expected_min": 50,
      "expected_max": 120,
      "contribution_weight": 0.3
    }
  ]
}
```

**Implémentation** : Isolation Forest ne fournit pas directement ces explications. Options :

- **Permutation importance** ou **SHAP** (si disponible)
- **Règles de secours** : comparaison aux seuils physiologiques connus (`ALERT_DEFAULT_THRESHOLDS`)

---

### 2.7 Tests et validation du modèle

**Objectif** : Vérifier la détection, la classification et la stabilité du score.

| Élément | Spécification |
|---------|----------------|
| **Module de test** | Endpoint ou script dédié pour injection de mesures simulées |
| **Vérifications** | Détection correcte, classification normal/warning/critical, stabilité du score |

**API proposée** :

- `POST /api/admin/ml-test/inject` (réservé admin/superuser)  
  Body : `{ "device_id": "...", "measurements": [...] }`  
  Réponse : scores, niveaux, et statut de détection pour chaque mesure.

**Scénarios de test** :

- Mesures normales → `normal`
- Mesures hors plages physiologiques → `warning` ou `critical`
- Mesures borderline → vérifier cohérence des seuils

---

### 2.8 Robustesse des données

**Objectif** : Gérer les cas limites avant scoring.

| Cas | Comportement |
|-----|--------------|
| **Valeurs manquantes** | Imputation (médiane, dernière valeur connue) ou exclusion du scoring avec flag `skipped_reason` |
| **Valeurs impossibles** | Déjà gérées par `validate_measurement_values()` → `status: INVALID` ; ne pas scorer |
| **Mauvaise qualité de signal** | Si `signal_quality < 50` : optionnellement scorer avec pondération réduite ou marquer `low_confidence` |

**Règles** :

- Ne jamais scorer une mesure `INVALID`
- Documenter les stratégies d'imputation dans la configuration

---

### 2.9 Performance temps réel

**Objectif** : Scorer une mesure en temps quasi réel.

| Élément | Spécification |
|---------|----------------|
| **Latence cible** | < 100 ms par mesure (objectif) |
| **Modèle** | Isolation Forest léger, pré-entraîné, chargé en mémoire |
| **Pipeline** | Validation → préparation → `model.predict()` / `model.decision_function()` → décision |

**Optimisations** :

- Modèle sérialisé (pickle/joblib) chargé au démarrage
- Pas de réentraînement synchrone dans le flux temps réel

---

### 2.10 Traçabilité et audit

**Objectif** : Enregistrer toutes les décisions du modèle pour conformité médicale.

| Élément | Spécification |
|---------|----------------|
| **Données** | score, décision (niveau), modèle utilisé (version), timestamp |
| **Stockage** | Chaque décision enregistrée (ex. `ml_decisions` ou champs dans `measurements`) |

**Schéma proposé pour `ml_decisions`** (audit léger) :

```javascript
{
  "measurement_id": ObjectId,
  "device_id": "SIM-ESP32-001",
  "measured_at": ISODate,
  "anomaly_score": 0.42,
  "anomaly_level": "normal",
  "model_version": "v1.0.2",
  "contributing_variables": [...],
  "processed_at": ISODate
}
```

---

## 3. Intégration avec l'architecture existante

### 3.1 Flux de données

```
[MQTT] / [POST /api/me/measurements]
    | 
    v
validate_measurement_payload() / normalize_patient_measurement_payload()
    |
    v
[Si VALID] --> ml_module.score_measurement(measurement)
    |              |
    |              v
    |         score, level, contributing_variables
    |              |
    v              v
measurements.insert_one({ ..., ml_score, ml_level, ml_model_version })
    |
    v
[Si level == "critical"] --> ml_anomalies.insert_one()
    |
    v
evaluate_measurement_alerts()  [règles existantes]
```

### 3.2 Nouvelles collections MongoDB

| Collection | Usage |
|------------|-------|
| `ml_anomalies` | Anomalies critiques détectées, avec statut de validation |
| `ml_decisions` | Audit de toutes les décisions (optionnel si volumétrie élevée) |
| `ml_model_versions` | Métadonnées des modèles (version, date d'entraînement, paramètres) |
| `ml_anomaly_thresholds` | Seuils `normal_max`, `warning_max` (par scope si besoin) |

### 3.3 Extension du schéma `measurements`

Champs optionnels à ajouter :

```javascript
{
  // ... champs existants ...
  "ml_score": 0.35,
  "ml_level": "normal",
  "ml_model_version": "v1.0.2",
  "ml_contributing_variables": [...]
}
```

---

## 4. Dépendances techniques

| Dépendance | Usage |
|------------|-------|
| `scikit-learn` | Isolation Forest, préprocessing |
| `numpy` | Vecteurs, imputation |
| `joblib` | Sérialisation du modèle |

---

## 5. Résumé des livrables

| # | Fonctionnalité | Livrable |
|---|----------------|----------|
| 1 | Détection d'anomalies | Module ML avec Isolation Forest (ou équivalent) |
| 2 | Score et niveaux | Mapping score → normal/warning/critical, seuils configurables |
| 3 | Événements d'alerte | Collection `ml_anomalies`, insertion si critical |
| 4 | Validation humaine | API PATCH + champs status/validated_by/validated_at |
| 5 | Réentraînement | Job périodique + versioning des modèles |
| 6 | Interprétabilité | Structure `contributing_variables` (règles ou SHAP) |
| 7 | Tests | Endpoint/script d'injection de mesures simulées |
| 8 | Robustesse | Gestion manquants, impossibles, signal_quality |
| 9 | Performance | Modèle pré-chargé, latence < 100 ms |
| 10 | Traçabilité | Enregistrement score, décision, version, timestamp |

---

## 6. Annexes

### A. Références physiologiques (existantes)

```python
# api.py - ALERT_DEFAULT_THRESHOLDS
{
    "spo2_min": 92.0,
    "heart_rate_min": 50.0,
    "heart_rate_max": 120.0,
    "temperature_min": 35.5,
    "temperature_max": 38.0,
}
```

### B. Plages de validation (existantes)

```python
# validate_measurement_values()
# heart_rate: 30-220, spo2: 70-100, temperature: 34-42
# signal_quality: >= 50 si requis
```

### C. Mapping device_id ↔ user_id_auth

Via `users_devices` (Vitalio_Identity) : `user_id_auth` ↔ `device_id`.
