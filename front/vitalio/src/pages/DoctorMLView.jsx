import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import {
  BrainCircuit,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  TrendingUp,
  TrendingDown,
  Activity,
  Info,
  ThumbsUp,
  ThumbsDown,
  LineChart as LineChartIcon,
  Users,
  Gauge,
  TriangleAlert,
  Sparkles,
  ArrowRight,
  Filter,
  Stethoscope,
  Clock,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, ComposedChart, Line, ReferenceLine,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell,
} from 'recharts'
import { getMLModelInfo, getMLAnomalies, getMLDecisions, getDoctorPatients, getMLForecast, apiRequest } from '../services/api'
import DoctorLayout from '../components/DoctorLayout'

const CONFIDENCE_LEVELS = [
  { min: 80, label: 'Fiabilité élevée', color: '#22c55e', bg: '#f0fdf4' },
  { min: 60, label: 'Fiabilité modérée', color: '#f59e0b', bg: '#fffbeb' },
  { min: 40, label: 'Fiabilité faible', color: '#f97316', bg: '#fff7ed' },
  { min: 0,  label: 'Fiabilité très faible', color: '#ef4444', bg: '#fef2f2' },
]

const RISK_CONFIG = {
  minimal:  { color: '#22c55e', bg: '#f0fdf4', label: 'Risque minimal' },
  low:      { color: '#3b82f6', bg: '#eff6ff', label: 'Risque faible' },
  moderate: { color: '#f59e0b', bg: '#fffbeb', label: 'Risque modéré' },
  high:     { color: '#ef4444', bg: '#fef2f2', label: 'Risque élevé' },
}

const URGENCY_CONFIG = {
  immediate: { color: '#ef4444', bg: '#fef2f2', label: 'Immédiat' },
  priority:  { color: '#f59e0b', bg: '#fffbeb', label: 'Prioritaire' },
  routine:   { color: '#22c55e', bg: '#f0fdf4', label: 'Routine' },
}

function getConfidenceLevel(score) {
  return CONFIDENCE_LEVELS.find(l => score >= l.min) || CONFIDENCE_LEVELS[CONFIDENCE_LEVELS.length - 1]
}

function ConfidenceBadge({ score }) {
  const level = getConfidenceLevel(score)
  return (
    <span className="ml-confidence-badge" style={{ background: level.bg, color: level.color, borderColor: level.color }}>
      <Gauge size={13} /> {score}/100 - {level.label}
    </span>
  )
}

const LEVEL_CONFIG = {
  normal:   { color: '#22c55e', bg: '#f0fdf4', label: 'Normal',       Icon: CheckCircle2 },
  warning:  { color: '#f59e0b', bg: '#fffbeb', label: 'Surveillance', Icon: AlertTriangle },
  critical: { color: '#ef4444', bg: '#fef2f2', label: 'Critique',     Icon: XCircle },
}

const STATUS_CONFIG = {
  pending:   { color: '#6366f1', bg: '#eef2ff', label: 'En attente' },
  validated: { color: '#22c55e', bg: '#f0fdf4', label: 'Validée' },
  rejected:  { color: '#94a3b8', bg: '#f8fafc', label: 'Rejetée' },
}

const formatTime = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function Toast({ message, type, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3500)
    return () => clearTimeout(timer)
  }, [onClose])
  const bg = type === 'success' ? '#f0fdf4' : '#fef2f2'
  const border = type === 'success' ? '#86efac' : '#fca5a5'
  const color = type === 'success' ? '#15803d' : '#991b1b'
  return (
    <div className="ml-toast" style={{ background: bg, borderColor: border, color }}>
      {type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
      <span>{message}</span>
    </div>
  )
}

function SuggestionCard({ anomaly }) {
  const urgCfg = URGENCY_CONFIG[anomaly.urgency] || URGENCY_CONFIG.routine
  if (!anomaly.recommended_action && !anomaly.clinical_reasoning?.length) return null
  return (
    <div className="ml-suggestion-card">
      <div className="ml-suggestion-header">
        <Stethoscope size={15} />
        <span className="ml-suggestion-title">Recommandation clinique</span>
        <span className="ml-urgency-badge" style={{ background: urgCfg.bg, color: urgCfg.color, borderColor: urgCfg.color }}>
          {urgCfg.label}
        </span>
      </div>
      {anomaly.recommended_action && (
        <p className="ml-suggestion-action">
          <ArrowRight size={13} /> {anomaly.recommended_action}
        </p>
      )}
      {anomaly.clinical_reasoning?.length > 0 && (
        <ul className="ml-suggestion-reasoning">
          {anomaly.clinical_reasoning.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      )}
    </div>
  )
}

export default function DoctorMLView() {
  const { getAccessTokenSilently } = useAuth0()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modelInfo, setModelInfo] = useState(null)
  const [anomalies, setAnomalies] = useState([])
  const [decisions, setDecisions] = useState([])
  const [statusFilter, setStatusFilter] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [validatingId, setValidatingId] = useState(null)
  const [retraining, setRetraining] = useState(false)
  const [retrainResult, setRetrainResult] = useState(null)
  const [expandedAnomaly, setExpandedAnomaly] = useState(null)
  const [toast, setToast] = useState(null)

  const [patients, setPatients] = useState([])
  const [selectedPatient, setSelectedPatient] = useState('')
  const [forecastData, setForecastData] = useState(null)
  const [forecastLoading, setForecastLoading] = useState(false)
  const [forecastError, setForecastError] = useState('')

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const token = await getAccessTokenSilently()
      const anomalyParams = { limit: 100 }
      if (statusFilter) anomalyParams.status = statusFilter
      if (severityFilter) anomalyParams.severity = severityFilter
      if (dateFrom) anomalyParams.from_date = dateFrom
      if (dateTo) anomalyParams.to_date = dateTo

      const [mlInfo, anomalyRes, decisionRes, patientsRes] = await Promise.all([
        getMLModelInfo().catch(() => null),
        getMLAnomalies(token, anomalyParams).catch(() => ({ anomalies: [] })),
        getMLDecisions(token, { limit: 200 }).catch(() => ({ decisions: [] })),
        getDoctorPatients(token).catch(() => ({ patients: [] })),
      ])
      setModelInfo(mlInfo)
      setAnomalies(Array.isArray(anomalyRes.anomalies) ? anomalyRes.anomalies : [])
      setDecisions(Array.isArray(decisionRes.decisions) ? decisionRes.decisions : [])
      const patientList = Array.isArray(patientsRes.patients) ? patientsRes.patients : []
      setPatients(patientList)
      if (!selectedPatient && patientList.length > 0) {
        setSelectedPatient(patientList[0].patient_id)
      }
    } catch (e) {
      setError(e.message || 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [getAccessTokenSilently, statusFilter, severityFilter, dateFrom, dateTo])

  useEffect(() => { loadData() }, [loadData])

  const handleValidate = async (anomalyId, newStatus) => {
    try {
      setValidatingId(anomalyId)
      const token = await getAccessTokenSilently()
      await apiRequest(`/api/doctor/ml-anomalies/${anomalyId}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      })
      setAnomalies((prev) =>
        prev.map((a) =>
          (a.anomaly_id === anomalyId)
            ? { ...a, status: newStatus }
            : a
        )
      )
      setToast({
        message: newStatus === 'validated' ? 'Alerte confirmée avec succès' : 'Alerte classée comme non pertinente',
        type: 'success',
      })
    } catch (e) {
      setToast({ message: e.message || 'Erreur lors du traitement', type: 'error' })
    } finally {
      setValidatingId(null)
    }
  }

  const handleRetrain = async () => {
    try {
      setRetraining(true)
      setRetrainResult(null)
      const token = await getAccessTokenSilently()
      const result = await apiRequest('/api/admin/ml/retrain', token, {
        method: 'POST',
        body: JSON.stringify({ days: 30 }),
      })
      setRetrainResult(result)
      const mlInfo = await getMLModelInfo().catch(() => null)
      setModelInfo(mlInfo)
    } catch (e) {
      setRetrainResult({ error: e.message })
    } finally {
      setRetraining(false)
    }
  }

  const handleForecast = useCallback(async (patientId) => {
    if (!patientId) return
    try {
      setForecastLoading(true)
      setForecastError('')
      setForecastData(null)
      const token = await getAccessTokenSilently()
      const data = await getMLForecast(token, patientId, {
        train_days: 30,
        history_hours: 48,
        horizon: 6,
      })
      setForecastData(data)
    } catch (e) {
      setForecastError(e.message || 'Impossible de calculer les prévisions')
    } finally {
      setForecastLoading(false)
    }
  }, [getAccessTokenSilently])

  useEffect(() => {
    if (selectedPatient) handleForecast(selectedPatient)
  }, [selectedPatient, handleForecast])

  const forecastChartData = useMemo(() => {
    if (!forecastData) return []
    const rawHist = forecastData.history || []
    const step = rawHist.length > 80 ? Math.ceil(rawHist.length / 80) : 1
    const sampled = step > 1 ? rawHist.filter((_, i) => i % step === 0 || i === rawHist.length - 1) : rawHist
    const hist = sampled.map((p, i) => ({
      index: i,
      label: p.timestamp ? formatTime(p.timestamp) : `H${i}`,
      type: 'history',
      heart_rate: p.heart_rate,
      spo2: p.spo2,
      temperature: p.temperature,
    }))
    const lastIdx = hist.length
    const preds = (forecastData.predictions || []).map((p, i) => ({
      index: lastIdx + i,
      label: p.timestamp ? formatTime(p.timestamp) : `+${i + 1}`,
      type: 'prediction',
      heart_rate: p.heart_rate,
      spo2: p.spo2,
      temperature: p.temperature,
      heart_rate_upper: p.heart_rate_upper,
      heart_rate_lower: p.heart_rate_lower,
      spo2_upper: p.spo2_upper,
      spo2_lower: p.spo2_lower,
      temperature_upper: p.temperature_upper,
      temperature_lower: p.temperature_lower,
    }))
    return [...hist, ...preds]
  }, [forecastData])

  const forecastSplitIndex = useMemo(() => {
    if (!forecastData) return 0
    const rawLen = forecastData.history?.length || 0
    const step = rawLen > 80 ? Math.ceil(rawLen / 80) : 1
    if (step > 1) {
      const sampledLen = Math.floor(rawLen / step) + (rawLen % step === 0 ? 0 : 1)
      return sampledLen
    }
    return rawLen
  }, [forecastData])

  const stats = useMemo(() => {
    const counts = { normal: 0, warning: 0, critical: 0 }
    decisions.forEach((d) => {
      const lvl = d.anomaly_level || 'normal'
      if (counts[lvl] !== undefined) counts[lvl]++
    })
    return { counts, total: decisions.length }
  }, [decisions])

  const scoreSeries = useMemo(() =>
    decisions.slice().reverse().map((d) => ({
      timestamp: formatTime(d.measured_at),
      score: Number((d.anomaly_score ?? 0).toFixed(3)),
    })),
    [decisions]
  )

  return (
    <DoctorLayout>
      <div className="doctor-ml">
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

        <header className="ml-header">
          <div>
            <h1><BrainCircuit size={28} /> Surveillance avancée</h1>
            <p>Détection des signes d'alerte et suivi prédictif des constantes vitales.</p>
          </div>
          <div className="ml-header-actions">
            {modelInfo && (
              <div className="ml-model-badge">
                <Info size={14} />
                <span>Version {modelInfo.version}{modelInfo.loaded ? '' : ' (indisponible)'}</span>
              </div>
            )}
            <button
              className="ml-retrain-btn"
              onClick={handleRetrain}
              disabled={retraining}
            >
              {retraining ? 'Mise à jour...' : 'Mettre à jour'}
            </button>
          </div>
        </header>

        {retrainResult && (
          <div className={`ml-panel ${retrainResult.error ? 'ml-panel--error' : 'ml-panel--success'}`}>
            {retrainResult.error
              ? <><ShieldAlert size={18} /> <span>{retrainResult.error}</span></>
              : <><CheckCircle2 size={18} /> <span>Système mis à jour (version {retrainResult.version}, {retrainResult.n_samples} mesures intégrées)</span></>
            }
          </div>
        )}

        {loading && <div className="ml-panel">Chargement...</div>}
        {!loading && error && (
          <div className="ml-panel ml-panel--error"><ShieldAlert size={20} /> <span>{error}</span></div>
        )}

        {!loading && !error && (
          <>
            {/* KPI */}
            <section className="ml-kpi-grid">
              {Object.entries(LEVEL_CONFIG).map(([level, cfg]) => (
                <article key={level} className="ml-kpi-card" style={{ borderColor: cfg.color, background: cfg.bg }}>
                  <cfg.Icon size={22} color={cfg.color} />
                  <div>
                    <span className="ml-kpi-value" style={{ color: cfg.color }}>{stats.counts[level]}</span>
                    <span className="ml-kpi-label">{cfg.label}</span>
                  </div>
                </article>
              ))}
              <article className="ml-kpi-card" style={{ borderColor: '#6366f1', background: '#eef2ff' }}>
                <TrendingUp size={22} color="#6366f1" />
                <div>
                  <span className="ml-kpi-value" style={{ color: '#6366f1' }}>{stats.total}</span>
                  <span className="ml-kpi-label">Total analyses</span>
                </div>
              </article>
            </section>

            {/* Score timeline */}
            {scoreSeries.length > 0 && (
              <section className="ml-panel">
                <h2><Activity size={18} /> Évolution de l'indice de risque</h2>
                <div className="ml-chart-wrap">
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={scoreSeries} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="docScoreGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="timestamp" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 1]} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Area type="monotone" dataKey="score" name="Indice de risque" stroke="#3b82f6" fill="url(#docScoreGrad)" strokeWidth={2} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </section>
            )}

            {}
            {stats.total > 0 && (
              <section className="ml-panel">
                <h2>Répartition des niveaux</h2>
                <div className="ml-chart-wrap">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart
                      data={[
                        { name: 'Normal', value: stats.counts.normal, fill: '#22c55e' },
                        { name: 'Surveillance', value: stats.counts.warning, fill: '#f59e0b' },
                        { name: 'Critique', value: stats.counts.critical, fill: '#ef4444' },
                      ]}
                      margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="value" name="Mesures" radius={[6, 6, 0, 0]}>
                        {['#22c55e', '#f59e0b', '#ef4444'].map((fill, i) => (
                          <Cell key={i} fill={fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            )}

            {}
            <section className="ml-panel ml-forecast-section">
              <div className="ml-anomaly-header">
                <h2><LineChartIcon size={18} /> Prévision des constantes vitales</h2>
                <div className="ml-forecast-controls">
                  <Users size={16} />
                  <select
                    className="ml-patient-select"
                    value={selectedPatient}
                    onChange={(e) => setSelectedPatient(e.target.value)}
                  >
                    {patients.length === 0 && <option value="">Aucun patient</option>}
                    {patients.map((p) => (
                      <option key={p.patient_id} value={p.patient_id}>
                        {p.display_name ? `${p.display_name} (${p.patient_id})` : p.patient_id}
                      </option>
                    ))}
                  </select>
                  <button
                    className="ml-retrain-btn"
                    onClick={() => handleForecast(selectedPatient)}
                    disabled={forecastLoading || !selectedPatient}
                    style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem' }}
                  >
                    {forecastLoading ? 'Calcul...' : 'Recalculer'}
                  </button>
                </div>
              </div>

              {patients.length === 0 && !loading && (
                <div className="ml-empty">
                  <Info size={20} />
                  <span>Aucun patient associé. Invitez un patient pour accéder aux prévisions.</span>
                </div>
              )}
              {forecastLoading && <div className="ml-empty"><Activity size={18} className="ml-spin" /> Analyse en cours...</div>}
              {forecastError && (
                <div className="ml-panel ml-panel--error" style={{ marginTop: '0.5rem' }}>
                  <ShieldAlert size={16} />
                  <span>{forecastError}</span>
                  <button
                    className="ml-retrain-btn"
                    onClick={() => handleForecast(selectedPatient)}
                    style={{ marginLeft: 'auto', padding: '0.3rem 0.7rem', fontSize: '0.75rem' }}
                  >
                    Réessayer
                  </button>
                </div>
              )}

              {forecastData && !forecastLoading && (
                <>
                  <div className="ml-forecast-summary">
                    <div className="ml-forecast-summary-left">
                      <ConfidenceBadge score={forecastData.confidence_score ?? 0} />
                      {forecastData.summary && (() => {
                        const riskCfg = RISK_CONFIG[forecastData.summary.risk_level] || RISK_CONFIG.minimal
                        return (
                          <span className="ml-risk-badge" style={{ background: riskCfg.bg, color: riskCfg.color, borderColor: riskCfg.color }}>
                            {riskCfg.label}
                          </span>
                        )
                      })()}
                      <span className="ml-forecast-meta">
                        {forecastData.data_quality?.n_used ?? forecastData.n_measurements} mesures
                        · {forecastData.data_quality?.time_span_hours != null ? `${Math.round(forecastData.data_quality.time_span_hours)}h de données` : '-'}
                        {forecastData.history_hours ? <> · historique {forecastData.history_hours}h</> : null}
                        {forecastData.train_days ? <> · période de référence {forecastData.train_days}j</> : null}
                        {forecastData.data_quality?.n_outliers_removed > 0 && (
                          <> · {forecastData.data_quality.n_outliers_removed} valeurs aberrantes exclues</>
                        )}
                      </span>
                    </div>
                    <span className="ml-forecast-version">{forecastData.model_version}</span>
                  </div>

                  {forecastData.summary && (
                    <div className="ml-forecast-interpretation">
                      <Sparkles size={15} />
                      <div>
                        <p className="ml-forecast-interpretation-text">{forecastData.summary.text}</p>
                        <p className="ml-forecast-interpretation-action">
                          <ArrowRight size={13} /> {forecastData.summary.recommended_action}
                        </p>
                      </div>
                    </div>
                  )}

                  {forecastData.data_quality?.warnings?.length > 0 && (
                    <div className="ml-forecast-warnings">
                      <TriangleAlert size={14} />
                      <span>{forecastData.data_quality.warnings.map(w => w.replace(/_/g, ' ')).join(' · ')}</span>
                    </div>
                  )}

                  <div className="ml-forecast-trends">
                    {Object.entries(forecastData.vitals || {}).map(([feat, info]) => {
                      if (info.status !== 'ok') return null
                      const trend = info.trend || {}
                      const trendIcon = trend.label === 'increasing' ? '↗' : trend.label === 'decreasing' ? '↘' : '→'
                      const trendColor = trend.label === 'stable' ? '#22c55e' : trend.label === 'increasing' ? '#f59e0b' : '#3b82f6'
                      const FEAT_LABELS = { heart_rate: 'Fréquence cardiaque', spo2: 'SpO₂', temperature: 'Température' }
                      const strengthLabel = { negligible: 'Stable', mild: 'Légère', moderate: 'Modérée', strong: 'Marquée' }[trend.strength] || trend.strength
                      const dirLabel = trend.label === 'stable' ? '' : trend.label === 'increasing' ? ' hausse' : ' baisse'
                      const confLevel = getConfidenceLevel(info.confidence_score || 0)
                      const predNext = info.predictions?.[0]?.value

                      return (
                        <div key={feat} className="ml-forecast-trend-card">
                          <div className="ml-trend-card-header">
                            <span className="ml-forecast-trend-name">{FEAT_LABELS[feat] || feat.replace('_', ' ')}</span>
                            <span className="ml-trend-confidence-dot" style={{ background: confLevel.color }} title={`Fiabilité : ${info.confidence_score}/100`} />
                          </div>
                          <div className="ml-trend-card-body">
                            <span className="ml-forecast-trend-arrow" style={{ color: trendColor }}>{trendIcon}</span>
                            <span className="ml-forecast-trend-detail">
                              {info.current_ema ?? info.last_raw} → {predNext ?? '-'} {info.unit}
                            </span>
                          </div>
                          <div className="ml-trend-card-footer">
                            <span className="ml-forecast-trend-label" style={{ color: trendColor }}>
                              {strengthLabel}{dirLabel}
                            </span>
                            {trend.significant && (
                              <span className="ml-trend-sig" title="Tendance statistiquement significative">Significatif</span>
                            )}
                            {!trend.significant && trend.label !== 'stable' && (
                              <span className="ml-trend-ns" title="Tendance observée mais non confirmée statistiquement">À surveiller</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {(() => {
                    const allAlerts = Object.entries(forecastData.vitals || {})
                      .flatMap(([feat, info]) => (info.clinical_alerts || []).map(a => ({ ...a, feat })))
                    if (allAlerts.length === 0) return null
                    return (
                      <div className="ml-clinical-alerts">
                        {allAlerts.map((a, i) => (
                          <div key={i} className={`ml-clinical-alert ml-clinical-alert--${a.severity}`}>
                            <AlertTriangle size={15} />
                            <span>{a.message}</span>
                            <span className="ml-clinical-alert-eta">~{a.estimated_breach_hours}h</span>
                          </div>
                        ))}
                      </div>
                    )
                  })()}

                  {forecastChartData.length > 0 && (
                    <>
                      {['heart_rate', 'spo2', 'temperature'].map((feat) => {
                        const vitalInfo = forecastData.vitals?.[feat]
                        if (!vitalInfo || vitalInfo.status !== 'ok') return null
                        const ranges = vitalInfo.physiological_range
                        const hasData = forecastChartData.some((d) => d[feat] != null)
                        if (!hasData) return null
                        const colors = { heart_rate: '#ef4444', spo2: '#3b82f6', temperature: '#16a34a' }
                        const labels = { heart_rate: 'Fréquence cardiaque (bpm)', spo2: 'SpO₂ (%)', temperature: 'Température (°C)' }
                        return (
                          <div key={feat} className="ml-chart-wrap" style={{ marginTop: '1rem' }}>
                            <div className="ml-chart-header">
                              <h3>{labels[feat]}</h3>
                              <ConfidenceBadge score={vitalInfo.confidence_score || 0} />
                            </div>
                            <ResponsiveContainer width="100%" height={240}>
                              <ComposedChart data={forecastChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                                <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                                <Tooltip
                                  contentStyle={{ borderRadius: '8px', fontSize: '0.82rem' }}
                                  formatter={(val, name) => {
                                    if (!val || name.includes('upper') || name.includes('lower') || name.includes('band')) return [null, null]
                                    return [typeof val === 'number' ? val.toFixed(1) : val, name]
                                  }}
                                />
                                {ranges && <ReferenceLine y={ranges[0]} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: 'Seuil bas', fontSize: 10, fill: '#94a3b8' }} />}
                                {ranges && <ReferenceLine y={ranges[1]} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: 'Seuil haut', fontSize: 10, fill: '#94a3b8' }} />}
                                {forecastSplitIndex > 0 && forecastSplitIndex < forecastChartData.length && (
                                  <ReferenceLine x={forecastChartData[forecastSplitIndex - 1]?.label} stroke="#6366f1" strokeDasharray="6 3" label={{ value: 'Prévision →', fontSize: 10, fill: '#6366f1' }} />
                                )}
                                <Area
                                  dataKey={`${feat}_upper`}
                                  stroke="none"
                                  fill={colors[feat]}
                                  fillOpacity={0.1}
                                  connectNulls={false}
                                  dot={false}
                                  activeDot={false}
                                  legendType="none"
                                  tooltipType="none"
                                  isAnimationActive={false}
                                />
                                <Area
                                  dataKey={`${feat}_lower`}
                                  stroke="none"
                                  fill="#fff"
                                  fillOpacity={1}
                                  connectNulls={false}
                                  dot={false}
                                  activeDot={false}
                                  legendType="none"
                                  tooltipType="none"
                                  isAnimationActive={false}
                                />
                                <Line
                                  type="monotone"
                                  dataKey={feat}
                                  name={labels[feat]}
                                  stroke={colors[feat]}
                                  strokeWidth={2}
                                  dot={(props) => {
                                    const { cx, cy, index, payload } = props
                                    if (!cx || !cy) return null
                                    if (payload?.type === 'prediction') {
                                      return <circle key={`pred-${index}`} cx={cx} cy={cy} r={4} fill="#fff" stroke={colors[feat]} strokeWidth={2} />
                                    }
                                    return <circle key={`hist-${index}`} cx={cx} cy={cy} r={2} fill={colors[feat]} />
                                  }}
                                  connectNulls
                                />
                                <Legend />
                              </ComposedChart>
                            </ResponsiveContainer>
                          </div>
                        )
                      })}
                    </>
                  )}
                </>
              )}
            </section>

            {}
            <section className="ml-panel">
              <div className="ml-anomaly-header">
                <h2><AlertTriangle size={18} /> Alertes cliniques</h2>
                <div className="ml-anomaly-filters">
                  <div className="ml-filter-group">
                    {['', 'pending', 'validated', 'rejected'].map((val) => (
                      <button
                        key={val}
                        className={`ml-filter-btn ${statusFilter === val ? 'ml-filter-btn--active' : ''}`}
                        onClick={() => setStatusFilter(val)}
                      >
                        {val === '' ? 'Toutes' : STATUS_CONFIG[val]?.label || val}
                      </button>
                    ))}
                  </div>
                  <div className="ml-filter-group">
                    <button
                      className={`ml-filter-btn ${severityFilter === '' ? 'ml-filter-btn--active' : ''}`}
                      onClick={() => setSeverityFilter('')}
                    >
                      Tous niveaux
                    </button>
                    <button
                      className={`ml-filter-btn ${severityFilter === 'critical' ? 'ml-filter-btn--active' : ''}`}
                      onClick={() => setSeverityFilter('critical')}
                    >
                      <XCircle size={12} /> Critiques uniquement
                    </button>
                  </div>
                  <div className="ml-date-filters">
                    <Clock size={14} />
                    <input
                      type="date"
                      className="ml-date-input"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      placeholder="Du"
                    />
                    <span className="ml-date-sep">→</span>
                    <input
                      type="date"
                      className="ml-date-input"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      placeholder="Au"
                    />
                    {(dateFrom || dateTo) && (
                      <button className="ml-filter-btn" onClick={() => { setDateFrom(''); setDateTo('') }}>
                        Réinitialiser
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {anomalies.length === 0 ? (
                <div className="ml-empty">
                  <Info size={20} />
                  <span>Aucune alerte {statusFilter ? `avec le statut « ${STATUS_CONFIG[statusFilter]?.label} »` : 'détectée'}.</span>
                </div>
              ) : (
                <div className="ml-anomaly-table-wrap">
                  <table className="ml-anomaly-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Capteur</th>
                        <th>Indice de risque</th>
                        <th>Niveau</th>
                        <th>Statut</th>
                        <th>Recommandation</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {anomalies.map((a, i) => {
                        const lvlCfg = LEVEL_CONFIG[a.anomaly_level] || LEVEL_CONFIG.warning
                        const stCfg = STATUS_CONFIG[a.status] || STATUS_CONFIG.pending
                        const id = a.anomaly_id || `row-${i}`
                        const isExpanded = expandedAnomaly === id
                        const hasSuggestion = a.recommended_action || a.clinical_reasoning?.length > 0
                        return (
                          <React.Fragment key={id}>
                            <tr className={isExpanded ? 'ml-row-expanded' : ''}>
                              <td>{formatTime(a.measured_at || a.created_at)}</td>
                              <td className="ml-table-mono">{a.device_id || '-'}</td>
                              <td>{(a.anomaly_score ?? 0).toFixed(3)}</td>
                              <td>
                                <span className="ml-level-badge" style={{ background: lvlCfg.bg, color: lvlCfg.color }}>
                                  {lvlCfg.label}
                                </span>
                              </td>
                              <td>
                                <span className="ml-level-badge" style={{ background: stCfg.bg, color: stCfg.color }}>
                                  {stCfg.label}
                                </span>
                              </td>
                              <td>
                                {hasSuggestion ? (
                                  <button
                                    className="ml-suggestion-toggle"
                                    onClick={() => setExpandedAnomaly(isExpanded ? null : id)}
                                  >
                                    <Stethoscope size={14} />
                                    {isExpanded ? 'Masquer' : 'Voir'}
                                  </button>
                                ) : (
                                  <span className="ml-table-mono" style={{ color: '#94a3b8' }}>-</span>
                                )}
                              </td>
                              <td>
                                {a.status === 'pending' && (
                                  <div className="ml-action-btns">
                                    <button
                                      className="ml-action-btn ml-action-btn--validate"
                                      onClick={() => handleValidate(id, 'validated')}
                                      disabled={validatingId === id}
                                      title="Confirmer l'alerte"
                                    >
                                      <ThumbsUp size={15} />
                                    </button>
                                    <button
                                      className="ml-action-btn ml-action-btn--reject"
                                      onClick={() => handleValidate(id, 'rejected')}
                                      disabled={validatingId === id}
                                      title="Classer comme non pertinente"
                                    >
                                      <ThumbsDown size={15} />
                                    </button>
                                  </div>
                                )}
                                {a.status !== 'pending' && (
                                  <span className="ml-table-validated">
                                    {a.status === 'validated' ? 'Confirmée' : 'Non pertinente'}
                                  </span>
                                )}
                              </td>
                            </tr>
                            {isExpanded && hasSuggestion && (
                              <tr className="ml-suggestion-row">
                                <td colSpan={7}>
                                  <SuggestionCard anomaly={a} />
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </DoctorLayout>
  )
}
