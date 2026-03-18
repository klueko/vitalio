# VitalIo - ML Anomaly Detection Workflow

## Architecture

```
IoT Device → MQTT → api.py (ingest) → run_ml_scoring()
                                          │
                         ┌────────────────┼────────────────┐
                         │                │                │
                   measurements      ml_decisions     ml_anomalies
                   (enriched)        (audit trail)    (critical events)
                         │                                │
                         └───────── DoctorMLView ─────────┘
                                   (validate/reject)
```

## 1. Entraînement initial (Bootstrap)

```bash
# Via l'API (requiert token doctor/superuser)
POST /api/admin/ml/bootstrap
Body: { "train_days": 365, "score_days": 365, "score_limit": 10000 }
```

Le bootstrap est **idempotent** :
1. Entraîne le modèle Isolation Forest sur les mesures historiques VALID
2. Score toutes les mesures non encore scorées
3. Crée les anomalies pour les scores critiques
4. Retourne un résumé `{ n_train, n_scored, n_critical, n_pending }`

## 2. Scoring temps réel

Chaque mesure reçue (API POST ou MQTT) passe automatiquement par `run_ml_scoring()` :

1. **score_measurement()** - Isolation Forest score normalisé [0,1]
2. **generate_clinical_suggestion()** - Règles déterministes physiologiques
3. **Enrichissement measurement** avec :
   - `ml_score`, `ml_level` (normal/warning/critical)
   - `ml_is_anomaly` (bool), `ml_criticality`
   - `ml_contributing_variables` (top variables avec poids)
   - `ml_recommended_action`, `ml_anomaly_status`
   - `ml_anomaly_id` (si événement critique créé)
4. **ml_decisions** - Document d'audit complet
5. **ml_anomalies** - Événement critique avec suggestion IA (si level=critical)

## 3. Suggestions IA (déterministes)

Moteur de règles basé sur seuils physiologiques :

| Condition | Action recommandée | Urgence |
|-----------|-------------------|---------|
| SpO₂ < 88% | Oxygénothérapie immédiate | immediate |
| SpO₂ < 92% | Surveillance rapprochée | priority |
| FC > 150 bpm | Évaluation cardiaque urgente | immediate |
| FC > 120 bpm | Surveillance cardiaque | priority |
| FC < 40 bpm | Bradycardie sévère | immediate |
| Temp > 39.5°C | Antipyrétiques + bilan | immediate |
| Temp > 38°C | Surveillance thermique | priority |
| Temp < 35°C | Réchauffement actif | immediate |

Chaque suggestion inclut :
- `recommended_action` - phrase claire pour le médecin
- `clinical_reasoning` - règles déclenchées (1-3)
- `urgency` - routine / priority / immediate

## 4. Validation médecin

### Flux

1. Le médecin voit les anomalies de ses patients dans `DoctorMLView`
2. Filtre par statut (pending/validated/rejected), sévérité, plage de dates
3. Clic sur "Voir" pour afficher la suggestion IA
4. Valide (ThumbsUp) ou rejette (ThumbsDown) l'anomalie

### Propagation

Le PATCH `/api/doctor/ml-anomalies/<id>` :
1. Met à jour `ml_anomalies` (status, validated_by, validated_at)
2. **Propage** dans `measurements` :
   - `ml_anomaly_status` → validated / rejected
   - `ml_validated_by`, `ml_validated_at`

### Sécurité

- Les anomalies sont filtrées par patients assignés au médecin (`user_id_auth`)
- Le PATCH vérifie que l'anomalie appartient à un patient assigné
- Superuser peut accéder à toutes les anomalies

## 5. Boucle d'amélioration continue

```
Mesures historiques ──→ train_model()
                            ↓
                     Scoring temps réel
                            ↓
                     Anomalies critiques
                            ↓
                   Validation médecin ──→ retrain avec feedback
                            ↓
                     Modèle amélioré
```

Le retraining (`POST /api/admin/ml/retrain`) intègre automatiquement
les anomalies validées/rejetées :
- **Validées** : surpoids x3 (cas anormaux confirmés)
- **Rejetées** : surpoids x2 (faux positifs réinjectés comme normaux)

## 6. API Endpoints ML

| Endpoint | Méthode | Rôle | Description |
|----------|---------|------|-------------|
| `/api/ml/info` | GET | Public | Metadata modèle |
| `/api/doctor/ml-anomalies` | GET | Doctor | Liste anomalies (filtrée) |
| `/api/doctor/ml-anomalies/<id>` | PATCH | Doctor | Valider/rejeter |
| `/api/admin/ml/retrain` | POST | Doctor+ | Réentraîner le modèle |
| `/api/admin/ml/batch-score` | POST | Doctor+ | Scorer les mesures non scorées |
| `/api/admin/ml/bootstrap` | POST | Doctor+ | Bootstrap complet |
| `/api/ml/decisions` | GET | Doctor+ | Audit trail des décisions ML |

## 7. Collections MongoDB

### measurements (enrichies)

```json
{
  "ml_score": 0.82,
  "ml_level": "critical",
  "ml_model_version": "v0.1.3",
  "ml_contributing_variables": [...],
  "ml_is_anomaly": true,
  "ml_criticality": "critical",
  "ml_anomaly_status": "pending",
  "ml_anomaly_id": ObjectId("..."),
  "ml_recommended_action": "Oxygénothérapie immédiate...",
  "ml_validated_by": null,
  "ml_validated_at": null
}
```

### ml_anomalies

```json
{
  "device_id": "SIM-ESP32-002",
  "user_id_auth": "auth0|...",
  "measurement_id": ObjectId("..."),
  "anomaly_score": 0.82,
  "anomaly_level": "critical",
  "status": "pending",
  "recommended_action": "...",
  "clinical_reasoning": ["SpO₂ < 88% : hypoxémie sévère"],
  "urgency": "immediate",
  "validated_by": null,
  "validated_at": null,
  "created_at": "2026-03-17T..."
}
```

## 8. Tests

```bash
cd vitalio/back
.venv\Scripts\python.exe -m unittest tests.test_ml_workflow -v
```

16 tests couvrant :
- Suggestions cliniques (SpO₂ basse, tachycardie, fièvre, bradycardie, hypothermie)
- Enrichissement des champs ML sur score_measurement
- Construction d'événements d'anomalie
- Cycle complet train → score → anomaly
- Validation des cas edge (INVALID, features manquantes)
