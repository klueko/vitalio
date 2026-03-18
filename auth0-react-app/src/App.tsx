import { useState, useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import LoginButton from "./LoginButton";
import LogoutButton from "./LogoutButton";
import Profile from "./Profile";

type VitalStatus = "normal" | "warning" | "critical";

type Vital = {
  label: string;
  value: number;
  unit: string;
  range: string;
  status: VitalStatus;
};

type Measurement = {
  timestamp: string;
  heart_rate: number;
  spo2: number;
  temperature: number;
};

type ApiResponse = {
  device_id: string;
  measurements: Measurement[];
  measurement_count: number;
};

const getVitalStatus = (
  label: string,
  value: number
): VitalStatus => {
  if (label === "Fréquence cardiaque") {
    if (value >= 60 && value <= 100) return "normal";
    if (value >= 50 && value < 60) return "warning";
    if (value > 100 && value <= 120) return "warning";
    return "critical";
  }
  if (label === "SpO₂") {
    if (value >= 95) return "normal";
    if (value >= 90 && value < 95) return "warning";
    return "critical";
  }
  if (label === "Température") {
    if (value >= 36.1 && value <= 37.8) return "normal";
    if ((value >= 35.5 && value < 36.1) || (value > 37.8 && value <= 38.5))
      return "warning";
    return "critical";
  }
  return "normal";
};

const createVitalsFromMeasurements = (
  latestMeasurement: Measurement | null
): Vital[] => {
  if (!latestMeasurement) {
    return [
      {
        label: "Fréquence cardiaque",
        value: 0,
        unit: "bpm",
        range: "60–100 au repos",
        status: "normal",
      },
      {
        label: "SpO₂",
        value: 0,
        unit: "%",
        range: "≥ 95 normal",
        status: "normal",
      },
      {
        label: "Température",
        value: 0,
        unit: "°C",
        range: "36,1–37,8",
        status: "normal",
      },
    ];
  }

  return [
    {
      label: "Fréquence cardiaque",
      value: latestMeasurement.heart_rate,
      unit: "bpm",
      range: "60–100 au repos",
      status: getVitalStatus("Fréquence cardiaque", latestMeasurement.heart_rate),
    },
    {
      label: "SpO₂",
      value: latestMeasurement.spo2,
      unit: "%",
      range: "≥ 95 normal",
      status: getVitalStatus("SpO₂", latestMeasurement.spo2),
    },
    {
      label: "Température",
      value: latestMeasurement.temperature,
      unit: "°C",
      range: "36,1–37,8",
      status: getVitalStatus("Température", latestMeasurement.temperature),
    },
  ];
};

const extractTrendPoints = (measurements: Measurement[]) => {
  const sorted = [...measurements]
    .sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )
    .slice(-10);

  return {
    hr: sorted.map((m) => m.heart_rate),
    spo2: sorted.map((m) => m.spo2),
    temp: sorted.map((m) => m.temperature),
  };
};

const normalize = (values: number[]) => {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return values.map((v) => (v - min) / range);
};

function VitalStatCard({ vital }: { vital: Vital }) {
  const statusClass =
    vital.status === "normal"
      ? "status-pill status-pill--normal"
      : vital.status === "warning"
        ? "status-pill status-pill--warning"
        : "status-pill status-pill--critical";

  const statusLabel =
    vital.status === "normal"
      ? "Dans la plage attendue"
      : vital.status === "warning"
        ? "Légèrement élevée"
        : "Nécessite une attention";

  return (
    <div className="vital-card">
      <div className="vital-label">{vital.label}</div>
      <div className="vital-value-row">
        <div>
          <span className="vital-value">{vital.value}</span>
          <span className="vital-unit"> {vital.unit}</span>
        </div>
        <span className={statusClass}>
          <span className="status-pill-dot" aria-hidden="true" />
          <span>{statusLabel}</span>
        </span>
      </div>
      <div className="vital-range">{vital.range}</div>
    </div>
  );
}

function VitalsTrendChart({
  trendPoints,
}: {
  trendPoints: { hr: number[]; spo2: number[]; temp: number[] };
}) {
  const width = 320;
  const height = 120;
  const paddingX = 12;
  const paddingY = 10;
  const pointsCount = trendPoints.hr.length || 1;
  const stepX = (width - paddingX * 2) / Math.max(pointsCount - 1, 1);

  const toPath = (values: number[]) => {
    const normalized = normalize(values);
    return normalized
      .map((v, i) => {
        const x = paddingX + i * stepX;
        const y = paddingY + (1 - v) * (height - paddingY * 2);
        return `${i === 0 ? "M" : "L"}${x},${y}`;
      })
      .join(" ");
  };

  const gridY1 = height / 3;
  const gridY2 = (height / 3) * 2;

  return (
    <svg
      className="trend-chart"
      role="img"
      aria-label="Tendance récente pour la fréquence cardiaque, la saturation en oxygène et la température"
    >
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill="transparent"
      />
      <line
        x1={paddingX}
        y1={gridY1}
        x2={width - paddingX}
        y2={gridY1}
        className="trend-chart-grid"
      />
      <line
        x1={paddingX}
        y1={gridY2}
        x2={width - paddingX}
        y2={gridY2}
        className="trend-chart-grid"
      />
      <line
        x1={paddingX}
        y1={paddingY}
        x2={paddingX}
        y2={height - paddingY}
        className="trend-chart-axis"
      />
      <path d={toPath(trendPoints.hr)} className="trend-chart-line-hr" />
      <path d={toPath(trendPoints.spo2)} className="trend-chart-line-spo2" />
      <path d={toPath(trendPoints.temp)} className="trend-chart-line-temp" />
    </svg>
  );
}

function App() {
  const { isAuthenticated, isLoading, error, getAccessTokenSilently } =
    useAuth0();
  const [apiData, setApiData] = useState<ApiResponse | null>(null);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";

  useEffect(() => {
    if (isAuthenticated) {
      const fetchPatientData = async () => {
        setApiLoading(true);
        setApiError(null);
        try {
          
          const token = await getAccessTokenSilently();
          const response = await fetch(`${apiUrl}/api/me/data`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(
              errorData.message || `Erreur HTTP: ${response.status}`
            );
          }

          const data: ApiResponse = await response.json();
          setApiData(data);
        } catch (err) {
          setApiError(
            err instanceof Error ? err.message : "Erreur lors du chargement des données"
          );
          console.error("Erreur API:", err);
        } finally {
          setApiLoading(false);
        }
      };

      fetchPatientData();
    }
  }, [isAuthenticated, getAccessTokenSilently, apiUrl]);

  const vitals = createVitalsFromMeasurements(
    apiData?.measurements?.[0] || null
  );
  const trendPoints = apiData?.measurements
    ? extractTrendPoints(apiData.measurements)
    : { hr: [], spo2: [], temp: [] };

  if (isLoading) {
    return (
      <div className="app-container">
        <div className="loading-state" role="status" aria-live="polite">
          <div className="loading-text">Préparation de la session sécurisée…</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-container">
        <div className="error-state" role="alert">
          <div className="error-title">Connexion impossible</div>
          <div className="error-message">
            Nous n&apos;avons pas pu terminer l&apos;authentification.
          </div>
          <div className="error-sub-message">{error.message}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="main-card-wrapper">
        <header className="app-header">
          <div className="app-title-row">
            <div>
              <h1 className="app-title">Surveillance connectée du patient</h1>
              <p className="app-subtitle">
                Observation continue des constantes vitales à distance via MQTT.
              </p>
            </div>
            <span className="tag-pill tag-pill--primary">
              <span className="tag-indicator" aria-hidden="true" />
              <span>Projet universitaire IoT santé</span>
            </span>
          </div>
          <div className="status-text-row">
            <span className="status-text">
              État :{" "}
              <span className="status-highlight">Session sécurisée avec Auth0</span>
            </span>
          </div>
        </header>

        {isAuthenticated ? (
          <div className="logged-in-section" aria-label="Monitoring summary">
            <div className="layout-grid">
              <div className="column-stack">
                <section
                  className="card patient-identity"
                  aria-labelledby="patient-identity-title"
                >
                  <div className="card-header">
                    <h2 id="patient-identity-title" className="card-title">
                      Identité du patient
                    </h2>
                    <span className="card-meta">
                      Source : profil authentifié
                    </span>
                  </div>
                  <Profile />
                  <div className="patient-extra">
                    <div>
                      <div className="patient-extra-label">Source du dossier</div>
                      <div className="patient-extra-value">
                        Annuaire utilisateur Auth0
                      </div>
                    </div>
                    <div>
                      <div className="patient-extra-label">Dernière vérification</div>
                      <div className="patient-extra-value">À l’instant</div>
                    </div>
                  </div>
                </section>

                <section
                  className="card"
                  aria-labelledby="device-status-title"
                >
                  <div className="card-header">
                    <h2 id="device-status-title" className="card-title">
                      Dispositif et connexion
                    </h2>
                  </div>
                  <div className="device-status-grid">
                    <div>
                      <div className="status-label">Connexion</div>
                      <div className="status-value">En ligne (simulée)</div>
                    </div>
                    <div>
                      <div className="status-label">Qualité du signal</div>
                      <div className="status-value">Bonne</div>
                    </div>
                    <div>
                      <div className="status-label">Dernier message</div>
                      <div className="status-value">Mis à jour &lt; 30 s</div>
                    </div>
                    <div>
                      <div className="status-label">Sujet</div>
                      <div className="status-value">/patient/bed-01/vitals</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <span className="status-pill status-pill--normal">
                      <span className="status-pill-dot" aria-hidden="true" />
                      <span>Flux de télémétrie stable</span>
                    </span>
                  </div>
                </section>
              </div>

              <section
                className="card"
                aria-labelledby="vital-measurements-title"
              >
                <div className="vitals-header-row">
                  <div className="card-header" style={{ padding: 0 }}>
                    <h2 id="vital-measurements-title" className="card-title">
                      Constantes vitales
                    </h2>
                    <span className="card-meta">Valeurs actuelles et tendances</span>
                  </div>
                </div>

                {apiLoading ? (
                  <div className="loading-state">
                    <div className="loading-text">
                      Chargement des données médicales…
                    </div>
                  </div>
                ) : apiError ? (
                  <div className="error-state">
                    <div className="error-title">Erreur de chargement</div>
                    <div className="error-message">{apiError}</div>
                  </div>
                ) : (
                  <>
                    <div className="vitals-grid">
                      {vitals.map((vital) => (
                        <VitalStatCard key={vital.label} vital={vital} />
                      ))}
                    </div>

                    <div className="trend-card">
                      <div className="trend-meta-row">
                        <span className="card-meta">
                          {apiData?.measurement_count || 0} mesure
                          {apiData?.measurement_count !== 1 ? "s" : ""}
                          {apiData?.device_id
                            ? ` (Device: ${apiData.device_id})`
                            : ""}
                        </span>
                        <div className="trend-legend">
                          <span className="legend-item">
                            <span className="legend-swatch legend-swatch--hr" />
                            <span>Fréquence cardiaque</span>
                          </span>
                          <span className="legend-item">
                            <span className="legend-swatch legend-swatch--spo2" />
                            <span>SpO₂</span>
                          </span>
                          <span className="legend-item">
                            <span className="legend-swatch legend-swatch--temp" />
                            <span>Température</span>
                          </span>
                        </div>
                      </div>
                      {trendPoints.hr.length > 0 ? (
                        <VitalsTrendChart trendPoints={trendPoints} />
                      ) : (
                        <div className="loading-text">
                          Aucune donnée disponible
                        </div>
                      )}
                    </div>
                  </>
                )}
              </section>
            </div>

            <div
              className="status-text-row"
              aria-label="Indication d’interprétation clinique"
            >
              <span className="status-text">
                Les valeurs et seuils sont fournis à titre de démonstration et{" "}
                <span className="status-highlight">
                  ne doivent pas être utilisés pour des décisions cliniques réelles.
                </span>
              </span>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <LogoutButton />
            </div>
          </div>
        ) : (
          <div
            className="action-card"
            aria-label="Authentification requise pour accéder à la vue de surveillance"
          >
            <h2 className="main-title">Connectez-vous pour voir la surveillance</h2>
            <p className="action-text">
              Utilisez votre compte institutionnel pour accéder au tableau de bord
              de surveillance du patient connecté. L’authentification est gérée de
              manière sécurisée par Auth0.
            </p>
            <LoginButton />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
