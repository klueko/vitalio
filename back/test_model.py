import pickle
from main import score_anomaly, interpret_anomaly_score

test_measurements = [
    {"heart_rate": 1220, "spo2": 900, "temperature": 37.9, "signal_quality": 78},
    {"heart_rate": 118, "spo2": 91, "temperature": 37.07, "signal_quality": 80},
]

def test_model(path: str, label: str):
    with open(path, "rb") as f:
        model = pickle.load(f)
    
    print(f"\n=== Test modèle {label} ===")
    for m in test_measurements:
        res = score_anomaly(model, m)
        level = interpret_anomaly_score(res["score"], res["decision"])
        print(m, "→", res, "niveau :", level)

if __name__ == "__main__":
    test_model("models/model_1.0.pkl", "v1.0 (baseline)")
    test_model("models/model_1.1.pkl", "v1.1 (réentraîné)")