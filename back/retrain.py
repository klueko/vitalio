"""
VitalIO — ÉTAPE 6 : Réentraînement contrôlé du modèle ML.

- Utilise UNIQUEMENT les anomalies VALIDÉES par un médecin (doctor_decision == "confirmed").
- Déclenché explicitement (jamais automatiquement).
- Produit une nouvelle version du modèle (1.0 → 1.1 → 1.2).
- Trace complète et auditable (manifest + journalisation).

Cette étape est la SEULE autorisée à modifier le modèle (sauvegarde pickle).
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path

from main import (
    DEFAULT_CONTAMINATION,
    DEFAULT_N_ESTIMATORS,
    DEFAULT_RANDOM_STATE,
    train_initial_model,
)

# -----------------------------------------------------------------------------
# Configuration (source des anomalies validées, stockage des modèles)
# -----------------------------------------------------------------------------

_BACK_DIR = Path(__file__).resolve().parent
VALIDATED_ANOMALIES_PATH = _BACK_DIR / "validated_anomalies.json"
MODELS_DIR = _BACK_DIR / "models"
MODEL_PREFIX = "model_"
MODEL_EXT = ".pkl"
MANIFEST_EXT = "_manifest.json"

# Champs requis pour considérer un événement comme validé par un médecin
REQUIRED_VALIDATED = True
REQUIRED_DOCTOR_DECISION = "confirmed"

logging.basicConfig(level=logging.INFO, format="%(levelname)s [%(name)s] %(message)s")
_log = logging.getLogger("retrain")


def load_validated_anomalies(path: str | Path | None = None) -> list[dict]:
    """
    Charge les anomalies VALIDÉES par un médecin (confirmées uniquement).

    Source : fichier JSON (liste d’AnomalyEvent). Seuls les événements avec
    validated == True et doctor_decision == "confirmed" sont retenus.
    Les anomalies rejetées ne sont jamais utilisées.

    Args:
        path: Chemin vers le fichier JSON. Par défaut : validated_anomalies.json
              dans le répertoire du script.

    Returns:
        Liste de dictionnaires (AnomalyEvent), chacun contenant au minimum
        "measurement" (données brutes), "validated", "doctor_decision", etc.
        Liste vide si le fichier est absent ou invalide.
    """
    p = Path(path) if path is not None else VALIDATED_ANOMALIES_PATH
    if not p.is_file():
        _log.info("Fichier des anomalies validées absent : %s", p)
        return []

    try:
        with open(p, encoding="utf-8") as f:
            raw = json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        _log.warning("Impossible de charger %s : %s", p, e)
        return []

    if not isinstance(raw, list):
        _log.warning("Le fichier %s ne contient pas une liste.", p)
        return []

    validated_anomalies = [
        event
        for event in raw
        if isinstance(event, dict)
        and event.get("validated") is True
        and event.get("doctor_decision") == REQUIRED_DOCTOR_DECISION
        and isinstance(event.get("measurement"), dict)
    ]
    _log.info(
        "Anomalies validées (confirmed) chargées : %d sur %d événements.",
        len(validated_anomalies),
        len(raw),
    )
    return validated_anomalies


def _get_next_version() -> str:
    """Détermine la prochaine version (1.0, 1.1, 1.2, …) à partir des modèles déjà sauvegardés."""
    if not MODELS_DIR.is_dir():
        return "1.1"  # premier réentraînement après 1.0 (simulées seules)

    versions = []
    for f in MODELS_DIR.glob(f"{MODEL_PREFIX}*{MODEL_EXT}"):
        try:
            # model_1.0.pkl -> 1.0, model_1.1.pkl -> 1.1
            name = f.stem
            if name.startswith(MODEL_PREFIX):
                v = name[len(MODEL_PREFIX) :]
                if v.replace(".", "").isdigit():
                    versions.append(float(v))
        except (ValueError, IndexError):
            continue
    if not versions:
        return "1.1"
    return f"{max(versions) + 0.1:.1f}"


def retrain_model(
    initial_measurements: list[dict] | None = None,
    validated_anomalies_path: str | Path | None = None,
) -> tuple["IsolationForest", str]:
    """
    Réentraînement explicite du modèle : données simulées + anomalies validées (confirmed).

    - Joue de données : initial_measurements (ou data.measurements) + mesures extraites
      des anomalies validées (confirmed) uniquement.
    - Réentraînement Isolation Forest (mêmes hyperparamètres, déterministe).
    - Nouvelle version (1.1, 1.2, …), horodatée, associée à un jeu de données précis.
    - Sauvegarde du modèle (pickle) et d’un manifest auditable.

    Args:
        initial_measurements: Mesures initiales (simulées). Si None, chargées depuis data.measurements.
        validated_anomalies_path: Chemin vers le fichier des anomalies. Si None, utilise VALIDATED_ANOMALIES_PATH.

    Returns:
        (model, version_str) : modèle entraîné (IsolationForest) et version (ex. "1.1").
    """
    import pickle

    if initial_measurements is None:
        from data import measurements as _m

        initial_measurements = _m

    validated_events = load_validated_anomalies(validated_anomalies_path)
    validated_measurements = [e["measurement"] for e in validated_events]

    combined_measurements = list(initial_measurements) + list(validated_measurements)
    n_initial = len(initial_measurements)
    n_validated = len(validated_measurements)

    _log.info(
        "Réentraînement : %d mesures initiales + %d anomalies validées (confirmed) = %d total.",
        n_initial,
        n_validated,
        len(combined_measurements),
    )

    model = train_initial_model(
        combined_measurements,
        random_state=DEFAULT_RANDOM_STATE,
        contamination=DEFAULT_CONTAMINATION,
        n_estimators=DEFAULT_N_ESTIMATORS,
    )

    version = _get_next_version()
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    model_path = MODELS_DIR / f"{MODEL_PREFIX}{version}{MODEL_EXT}"
    with open(model_path, "wb") as f:
        pickle.dump(model, f)
    _log.info("Modèle sauvegardé : %s", model_path)

    now = datetime.now(timezone.utc).isoformat()
    manifest = {
        "version": version,
        "timestamp_utc": now,
        "dataset": {
            "n_initial": n_initial,
            "n_validated_anomalies": n_validated,
            "n_total": len(combined_measurements),
            "description": "données simulées + anomalies validées (doctor_decision=confirmed)",
        },
        "model_path": str(model_path),
    }
    manifest_path = MODELS_DIR / f"{MODEL_PREFIX}{version}{MANIFEST_EXT}"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    _log.info("Manifest sauvegardé : %s", manifest_path)

    return model, version


if __name__ == "__main__":
    model, version = retrain_model()
    print(f"Réentraînement terminé. Modèle version {version}.")
