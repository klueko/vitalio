"""
Les étps à suivrent.
ÉTAPE 1 : Préparation et transformation des données.
ÉTAPE 2 : Entraînement initial d’un modèle Isolation Forest.
ÉTAPE 3 : Scoring d’anomalie pour une nouvelle mesure.
"""

from __future__ import annotations

import math
from typing import Any

import numpy as np
from sklearn.ensemble import IsolationForest
import pickle
from pathlib import Path

# -----------------------------------------------------------------------------
# ÉTAPE 1 — Préparation des données
# -----------------------------------------------------------------------------

FEATURE_NAMES = ("heart_rate", "spo2", "temperature", "signal_quality")


def _to_float(value: Any) -> float:
    """Convertit une valeur en float ; retourne math.nan si manquante ou invalide."""
    if value is None:
        return math.nan
    try:
        return float(value)
    except (TypeError, ValueError):
        return math.nan


def _get_flat_value(measurement: dict, key: str, nested: dict | None) -> Any:
    """Récupère une valeur en priorité depuis le format plat, sinon depuis le format imbriqué."""
    if key in measurement:
        return measurement[key]
    if nested:
        if key == "heart_rate":
            return nested.get("MAX30102", {}).get("heart_rate")
        if key == "spo2":
            return nested.get("MAX30102", {}).get("spo2")
        if key == "temperature":
            return nested.get("MLX90614", {}).get("object_temp")
    if key == "signal_quality":
        return measurement.get("signal_quality")
    return None


def extract_features(measurement: dict) -> list[float]:
    """
    Transforme une mesure en vecteur numérique ML-ready.

    Chaque mesure doit contenir au minimum : heart_rate (int), spo2 (int),
    temperature (float), signal_quality (int). Gère les valeurs manquantes
    (retourne math.nan) et les types incorrects (conversion en float ou nan).

    Args:
        measurement: Dictionnaire d'une mesure (format plat ou imbriqué MQTT).

    Returns:
        Liste de 4 floats : [heart_rate, spo2, temperature, signal_quality].
    """
    nested = measurement.get("sensors")
    values = [
        _get_flat_value(measurement, "heart_rate", nested),
        _get_flat_value(measurement, "spo2", nested),
        _get_flat_value(measurement, "temperature", nested),
        _get_flat_value(measurement, "signal_quality", nested),
    ]
    return [_to_float(v) for v in values]


def prepare_training_data(measurements: list[dict]) -> np.ndarray:
    """
    Construit la matrice X à partir de la liste de mesures.

    Utilise extract_features pour chaque mesure, puis remplace les valeurs
    manquantes (nan) par la médiane de la colonne pour un entraînement robuste.

    Args:
        measurements: Liste de dictionnaires de mesures (depuis data.measurements).

    Returns:
        Matrice X de forme (n_samples, 4), prête pour l'entraînement.
    """
    rows = [extract_features(m) for m in measurements]
    X = np.array(rows, dtype=float)

    # Remplacement des nan par la médiane de la colonne (robuste aux outliers)
    for col in range(X.shape[1]):
        col_vals = X[:, col]
        mask = ~np.isnan(col_vals)
        if mask.any():
            median = np.nanmedian(col_vals)
            X[:, col] = np.where(mask, col_vals, median)
        else:
            X[:, col] = 0.0

    return X


# -----------------------------------------------------------------------------
# ÉTAPE 2 — Entraînement du modèle
# -----------------------------------------------------------------------------

# random_state=42 : reproductibilité stricte.
# contamination=0.1 : proportion attendue d'anomalies dans des données simulées
#   bruitées ; valeur courante pour démo sans labels.
# n_estimators=100 : bon compromis stabilité / temps ; standard pour Isolation Forest.
DEFAULT_RANDOM_STATE = 42
DEFAULT_CONTAMINATION = 0.1
DEFAULT_N_ESTIMATORS = 100


def train_initial_model(
    measurements: list[dict],
    *,
    random_state: int = DEFAULT_RANDOM_STATE,
    contamination: float = DEFAULT_CONTAMINATION,
    n_estimators: int = DEFAULT_N_ESTIMATORS,
) -> IsolationForest:
    """
    Entraîne un modèle Isolation Forest sur les mesures simulées.

    Le modèle apprend uniquement la "normalité" (non supervisé). Aucun label.
    Hyperparamètres fixés pour un comportement déterministe.

    Args:
        measurements: Liste de mesures (ex. depuis data.measurements).
        random_state: Graine pour reproductibilité.
        contamination: Proportion attendue d'outliers (défaut 0.1).
        n_estimators: Nombre d'arbres dans la forêt (défaut 100).

    Returns:
        Modèle IsolationForest entraîné (sklearn).
    """
    X = prepare_training_data(measurements)
    model = IsolationForest(
        random_state=random_state,
        contamination=contamination,
        n_estimators=n_estimators,
    )
    model.fit(X)
    return model


# -----------------------------------------------------------------------------
# ÉTAPE 3 — Scoring d’anomalie (une mesure)
# -----------------------------------------------------------------------------

# Valeurs de repli pour les champs manquants (cohérentes avec la plage simulée),
# utilisées lorsqu’une mesure contient des nan pour garder la fonction pure.
_FALLBACK_HEART_RATE = 75.0
_FALLBACK_SPO2 = 98.0
_FALLBACK_TEMPERATURE = 36.5
_FALLBACK_SIGNAL_QUALITY = 90.0
_FALLBACKS = (_FALLBACK_HEART_RATE, _FALLBACK_SPO2, _FALLBACK_TEMPERATURE, _FALLBACK_SIGNAL_QUALITY)


def score_anomaly(model: IsolationForest, measurement: dict) -> dict:
    raw = extract_features(measurement)
    row = [
        _FALLBACKS[i] if math.isnan(raw[i]) else raw[i]
        for i in range(len(FEATURE_NAMES))
    ]
    X = np.array([row], dtype=float)

    decision = int(model.predict(X)[0])

    # Score plus discriminant
    raw_score = float(model.score_samples(X)[0])

    return {
        "decision": decision,
        "score": raw_score
    }
# -----------------------------------------------------------------------------
# ÉTAPE 3 BIS — Interprétation métier du score (seuils)
# -----------------------------------------------------------------------------

# Seuils métiers (indépendants du modèle ML)
CRITICAL_ANOMALY_THRESHOLD = -0.09
WARNING_ANOMALY_THRESHOLD = -0.05

def interpret_anomaly_score(score: float, decision: int) -> str:
    if decision == -1 and score <= CRITICAL_ANOMALY_THRESHOLD:
        return "critical"
    if decision == -1:
        return "warning"
    return "normal"

# -----------------------------------------------------------------------------
# Point d'entrée
# -----------------------------------------------------------------------------

def main() -> IsolationForest:
    """Charge les données depuis data.py, entraîne le modèle et le retourne."""
    from data import measurements  # noqa: PLC0415

    model = train_initial_model(measurements)
    print("Modèle Isolation Forest entraîné avec succès.")
    print(f"  Nombre de mesures : {len(measurements)}")
    print(f"  Features : {list(FEATURE_NAMES)}")
    return model


if __name__ == "__main__":
    model = main()

    # Sauvegarde explicite du modèle baseline (v1.0)
    Path("models").mkdir(exist_ok=True)

    with open("models/model_1.0.pkl", "wb") as f:
        pickle.dump(model, f)

    print("Modèle v1.0 sauvegardé dans models/model_1.0.pkl")
