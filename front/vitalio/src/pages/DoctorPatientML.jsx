import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'
import {
  ArrowLeft,
  BrainCircuit,
  Activity,
  Heart,
  Thermometer,
  Wind,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Gauge,
  Sparkles,
  ArrowRight,
  BarChart3,
  LineChart as LineChartIcon,
  ShieldAlert,
  CalendarDays,
  Info,
  Layers,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  ComposedChart, ReferenceLine, ReferenceArea,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, Brush,
} from 'recharts'
import { getPatientMLAnalysis } from '../services/api'
import DoctorLayout from '../components/DoctorLayout'

const VITAL_CONFIG = {
  heart_rate: {
    label: 'Fréquence cardiaque',
    unit: 'bpm',
    color: '#ef4444',
    gradient: ['#fecaca', '#ef4444'],
    Icon: Heart,
  },
  spo2: {
    label: 'SpO₂',
    unit: '%',
    color: '#3b82f6',
    gradient: ['#bfdbfe', '#3b82f6'],
    Icon: Wind,
  },
  temperature: {
    label: 'Température',
    unit: '°C',
    color: '#16a34a',
    gradient: ['#bbf7d0', '#16a34a'],
    Icon: Thermometer,
  },
}

const LEVEL_COLORS = {
  normal: '#22c55e',
  warning: '#f59e0b',
  critical: '#ef4444',
}

const RISK_CONFIG = {
  minimal:  { color: '#22c55e', bg: '#f0fdf4', label: 'Risque minimal' },
  low:      { color: '#3b82f6', bg: '#eff6ff', label: 'Risque faible' },
  moderate: { color: '#f59e0b', bg: '#fffbeb', label: 'Risque modéré' },
  high:     { color: '#ef4444', bg: '#fef2f2', label: 'Risque élevé' },
}

const formatTime = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const formatDate = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

function StatCard({ label, value, unit, icon: Icon, color, subtitle }) {
  return (
    <div className="pml-stat-card" style={{ borderLeftColor: color }}>
      <div className="pml-stat-icon" style={{ color }}><Icon size={20} /></div>
      <div className="pml-stat-content">
        <span className="pml-stat-value">{value ?? '-'}<small>{unit}</small></span>
        <span className="pml-stat-label">{label}</span>
        {subtitle && <span className="pml-stat-sub">{subtitle}</span>}
      </div>
    </div>
  )
}

function AnomalyDot(props) {
  const { cx, cy, payload, color } = props
  if (!payload?.is_anomaly) return <circle cx={cx} cy={cy} r={3} fill={color} />
  return (
    <g>
      <circle cx={cx} cy={cy} r={7} fill="#ef4444" fillOpacity={0.2} />
      <circle cx={cx} cy={cy} r={4} fill="#ef4444" stroke="#fff" strokeWidth={1.5} />
    </g>
  )
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="pml-tooltip">
      <p className="pml-tooltip-label">{label}</p>
      {payload.filter(p => p.value != null && !p.dataKey.includes('_area')).map((p, i) => (
        <p key={i} style={{ color: p.color || p.stroke }}>
          <strong>{p.name}:</strong> {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}
        </p>
      ))}
    </div>
  )
}

export default function DoctorPatientML() {
  const { patientId } = useParams()
  const navigate = useNavigate()
  const { getAccessTokenSilently } = useAuth0()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [analysis, setAnalysis] = useState(null)
  const [days, setDays] = useState(30)
  const [activeVital, setActiveVital] = useState('heart_rate')
  const [showMA, setShowMA] = useState(true)
  const [showAnomalies, setShowAnomalies] = useState(true)

  const loadAnalysis = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const token = await getAccessTokenSilently()
      const data = await getPatientMLAnalysis(token, patientId, {
        days,
        include_forecast: true,
        forecast_horizon: 8,
      })
      setAnalysis(data)
    } catch (e) {
      setError(e.message || 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [getAccessTokenSilently, patientId, days])

  useEffect(() => { loadAnalysis() }, [loadAnalysis])

  const vitalData = useMemo(() => {
    if (!analysis?.vitals?.[activeVital]?.series) return []
    return analysis.vitals[activeVital].series.map((pt, i) => ({
      ...pt,
      label: formatTime(pt.timestamp),
      index: i,
    }))
  }, [analysis, activeVital])

  const mlScoreData = useMemo(() => {
    if (!analysis?.ml_score_timeline?.length) return []
    return analysis.ml_score_timeline.slice().reverse().map((d, i) => ({
      timestamp: formatTime(d.timestamp),
      score: Number((d.score ?? 0).toFixed(3)),
      level: d.level,
      index: i,
    }))
  }, [analysis])

  const dailyData = useMemo(() => {
    if (!analysis?.vitals?.[activeVital]?.daily_segments) return []
    return analysis.vitals[activeVital].daily_segments.map((s, i) => ({
      ...s,
      label: `J${i + 1}`,
      range: s.max - s.min,
    }))
  }, [analysis, activeVital])

  const forecastData = useMemo(() => {
    if (!analysis?.forecast) return []
    const hist = (analysis.forecast.history || []).map((p, i) => ({
      index: i,
      label: formatTime(p.timestamp),
      type: 'history',
      heart_rate: p.heart_rate,
      spo2: p.spo2,
      temperature: p.temperature,
    }))
    const lastIdx = hist.length
    const preds = (analysis.forecast.predictions || []).map((p, i) => ({
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
  }, [analysis])

  const forecastSplit = analysis?.forecast?.history?.length ?? 0

  const correlations = analysis?.correlations || {}

  const vitalInfo = analysis?.vitals?.[activeVital] || {}
  const stats = vitalInfo.statistics || {}
  const trend = vitalInfo.trend || {}
  const cfg = VITAL_CONFIG[activeVital]

  return (
    <DoctorLayout>
      <div className="pml-page">
        {}
        <header className="pml-header">
          <div className="pml-header-left">
            <button className="pml-back-btn" onClick={() => navigate(`/doctor/patient/${patientId}`)}>
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1><BrainCircuit size={26} /> Suivi avancé - {analysis?.patient_display || patientId}</h1>
              <p>Tendances, détection des signes d'alerte et prévisions des constantes vitales</p>
            </div>
          </div>
          <div className="pml-header-actions">
            <div className="pml-period-selector">
              <CalendarDays size={15} />
              {[7, 14, 30, 90].map(d => (
                <button
                  key={d}
                  className={`pml-period-btn ${days === d ? 'pml-period-btn--active' : ''}`}
                  onClick={() => setDays(d)}
                >
                  {d}j
                </button>
              ))}
            </div>
          </div>
        </header>

        {loading && <div className="pml-panel pml-loading">Chargement de l'analyse...</div>}
        {!loading && error && (
          <div className="pml-panel pml-panel--error"><ShieldAlert size={20} /> {error}</div>
        )}

        {!loading && !error && analysis && (
          <>
            {}
            <section className="pml-stats-row">
              {Object.entries(VITAL_CONFIG).map(([feat, vc]) => {
                const info = analysis.vitals?.[feat]
                if (!info || info.status !== 'ok') return null
                const s = info.statistics || {}
                const t = info.trend || {}
                const trendIcon = t.label === 'increasing' ? '↗' : t.label === 'decreasing' ? '↘' : '→'
                return (
                  <StatCard
                    key={feat}
                    label={vc.label}
                    value={s.mean}
                    unit={vc.unit}
                    icon={vc.Icon}
                    color={vc.color}
                    subtitle={`${trendIcon} ${({ negligible: 'Stable', mild: 'Légère variation', moderate: 'Variation modérée', strong: 'Variation marquée' })[t.strength] || t.strength} · écart-type ${s.std}`}
                  />
                )
              })}
              <StatCard
                label="Alertes cliniques"
                value={analysis.anomaly_summary?.total ?? 0}
                unit=""
                icon={AlertTriangle}
                color="#f59e0b"
                subtitle={`${analysis.anomaly_summary?.by_status?.validated ?? 0} confirmées · ${analysis.anomaly_summary?.by_status?.pending ?? 0} en attente`}
              />
            </section>

            {}
            <div className="pml-vital-tabs">
              {Object.entries(VITAL_CONFIG).map(([feat, vc]) => (
                <button
                  key={feat}
                  className={`pml-vital-tab ${activeVital === feat ? 'pml-vital-tab--active' : ''}`}
                  style={activeVital === feat ? { borderColor: vc.color, color: vc.color } : {}}
                  onClick={() => setActiveVital(feat)}
                >
                  <vc.Icon size={16} /> {vc.label}
                </button>
              ))}
            </div>

            {}
            {vitalInfo.status === 'ok' && (
              <section className="pml-panel pml-trend-panel">
                <div className="pml-panel-header">
                  <h2><Activity size={18} /> Tendance - {cfg.label}</h2>
                  <div className="pml-panel-controls">
                    <label className="pml-toggle">
                      <input type="checkbox" checked={showMA} onChange={() => setShowMA(!showMA)} />
                      <span>Courbes de tendance</span>
                    </label>
                    <label className="pml-toggle">
                      <input type="checkbox" checked={showAnomalies} onChange={() => setShowAnomalies(!showAnomalies)} />
                      <span>Valeurs anormales</span>
                    </label>
                  </div>
                </div>

                <div className="pml-chart-wrap">
                  <ResponsiveContainer width="100%" height={320}>
                    <ComposedChart data={vitalData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id={`grad_${activeVital}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={cfg.color} stopOpacity={0.15} />
                          <stop offset="95%" stopColor={cfg.color} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                      <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} />
                      <Tooltip content={<CustomTooltip />} />

                      {vitalInfo.physiological_range && (
                        <ReferenceArea
                          y1={vitalInfo.physiological_range[0]}
                          y2={vitalInfo.physiological_range[1]}
                          fill={cfg.color}
                          fillOpacity={0.04}
                          label={{ value: 'Valeurs normales', fontSize: 10, fill: '#94a3b8' }}
                        />
                      )}
                      {vitalInfo.physiological_range && (
                        <ReferenceLine y={vitalInfo.physiological_range[0]} stroke="#94a3b8" strokeDasharray="4 4" />
                      )}
                      {vitalInfo.physiological_range && (
                        <ReferenceLine y={vitalInfo.physiological_range[1]} stroke="#94a3b8" strokeDasharray="4 4" />
                      )}

                      <Area
                        type="monotone"
                        dataKey="value"
                        fill={`url(#grad_${activeVital})`}
                        stroke="none"
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        name={`${cfg.label} (mesures)`}
                        stroke={cfg.color}
                        strokeWidth={1.5}
                        dot={showAnomalies ? (props) => <AnomalyDot {...props} color={cfg.color} /> : { r: 2, fill: cfg.color }}
                        connectNulls
                      />
                      <Line
                        type="monotone"
                        dataKey="ema"
                        name="Tendance lissée"
                        stroke={cfg.color}
                        strokeWidth={2.5}
                        strokeOpacity={0.7}
                        dot={false}
                        connectNulls
                      />

                      {showMA && (
                        <>
                          <Line type="monotone" dataKey="ma_6" name="Moyenne 6h" stroke="#a855f7" strokeWidth={1} strokeDasharray="4 2" dot={false} connectNulls />
                          <Line type="monotone" dataKey="ma_12" name="Moyenne 12h" stroke="#06b6d4" strokeWidth={1} strokeDasharray="6 3" dot={false} connectNulls />
                          <Line type="monotone" dataKey="ma_24" name="Moyenne 24h" stroke="#f59e0b" strokeWidth={1} strokeDasharray="8 4" dot={false} connectNulls />
                        </>
                      )}

                      <Legend />
                      <Brush dataKey="label" height={25} stroke={cfg.color} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                {}
                <div className="pml-trend-summary">
                  <div className="pml-trend-direction">
                    {trend.label === 'increasing' && <TrendingUp size={20} color="#f59e0b" />}
                    {trend.label === 'decreasing' && <TrendingDown size={20} color="#3b82f6" />}
                    {trend.label === 'stable' && <Activity size={20} color="#22c55e" />}
                    <span>
                      {trend.label === 'stable' ? 'Stable' : trend.label === 'increasing' ? 'En hausse' : 'En baisse'}
                      {' '}({({ negligible: 'négligeable', mild: 'légère', moderate: 'modérée', strong: 'marquée' })[trend.strength] || trend.strength})
                      {trend.significant && <span className="pml-sig-badge">Significatif</span>}
                    </span>
                  </div>
                  <div className="pml-trend-stats">
                    <span>Moyenne : <strong>{stats.mean}</strong></span>
                    <span>Médiane : <strong>{stats.median}</strong></span>
                    <span>Écart-type : <strong>{stats.std}</strong></span>
                    <span>Dispersion : <strong>{stats.iqr}</strong></span>
                    <span>Variabilité : <strong>{stats.cv}%</strong></span>
                    <span>Min : <strong>{stats.min}</strong></span>
                    <span>Max : <strong>{stats.max}</strong></span>
                  </div>
                </div>

                {}
                {vitalInfo.clinical_alerts?.length > 0 && (
                  <div className="pml-clinical-alerts">
                    {vitalInfo.clinical_alerts.map((a, i) => (
                      <div key={i} className={`pml-alert pml-alert--${a.severity}`}>
                        <AlertTriangle size={15} />
                        <span>{a.message}</span>
                        <span className="pml-alert-eta">~{a.estimated_breach_hours}h</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {}
            {mlScoreData.length > 0 && (
              <section className="pml-panel">
                <h2><ShieldAlert size={18} /> Évolution de l'indice de risque</h2>
                <div className="pml-chart-wrap">
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={mlScoreData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="mlScoreGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="timestamp" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                      <YAxis domain={[0, 1]} tick={{ fontSize: 11 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <ReferenceArea y1={0} y2={0.45} fill="#22c55e" fillOpacity={0.06} />
                      <ReferenceArea y1={0.45} y2={0.70} fill="#f59e0b" fillOpacity={0.06} />
                      <ReferenceArea y1={0.70} y2={1} fill="#ef4444" fillOpacity={0.06} />
                      <ReferenceLine y={0.45} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'Surveillance', fontSize: 10, fill: '#f59e0b' }} />
                      <ReferenceLine y={0.70} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Critique', fontSize: 10, fill: '#ef4444' }} />
                      <Area
                        type="monotone"
                        dataKey="score"
                        name="Indice de risque"
                        stroke="#6366f1"
                        fill="url(#mlScoreGrad)"
                        strokeWidth={2}
                        dot={(props) => {
                          const { cx, cy, payload } = props
                          const c = LEVEL_COLORS[payload?.level] || '#6366f1'
                          const r = payload?.level === 'critical' ? 5 : payload?.level === 'warning' ? 4 : 2
                          return <circle cx={cx} cy={cy} r={r} fill={c} stroke="#fff" strokeWidth={1} />
                        }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </section>
            )}

            {/* Anomaly points detail */}
            {vitalInfo.anomalous_points?.length > 0 && (
              <section className="pml-panel">
                <div className="pml-panel-header">
                  <h2><AlertTriangle size={18} /> Valeurs anormales détectées - {cfg.label}</h2>
                  <span className="pml-badge pml-badge--warning">{vitalInfo.n_anomalies} détectées</span>
                </div>
                <div className="pml-anomaly-list">
                  {vitalInfo.anomalous_points.slice(0, 20).map((a, i) => (
                    <div key={i} className={`pml-anomaly-item pml-anomaly-item--${a.severity}`}>
                      <span className="pml-anomaly-value">{a.value} {cfg.unit}</span>
                      <span className="pml-anomaly-time">t+{a.t_hours}h</span>
                      <div className="pml-anomaly-reasons">
                        {a.reasons.map((r, j) => (
                          <span key={j} className="pml-anomaly-reason">{r.replace(/_/g, ' ')}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Daily pattern */}
            {dailyData.length > 1 && (
              <section className="pml-panel">
                <h2><BarChart3 size={18} /> Profil journalier - {cfg.label}</h2>
                <div className="pml-chart-wrap">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={dailyData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="mean" name="Moyenne" fill={cfg.color} radius={[4, 4, 0, 0]} fillOpacity={0.8} />
                      <Bar dataKey="range" name="Amplitude" fill={cfg.color} radius={[4, 4, 0, 0]} fillOpacity={0.3} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            )}

            {/* Forecast section */}
            {analysis.forecast && !analysis.forecast.error && forecastData.length > 0 && (
              <section className="pml-panel pml-forecast-section">
                <h2><LineChartIcon size={18} /> Prévisions</h2>

                {analysis.forecast.summary && (
                  <div className="pml-forecast-summary">
                    <div className="pml-forecast-summary-badges">
                      <span className="pml-badge" style={{
                        background: analysis.forecast.confidence_score >= 60 ? '#f0fdf4' : '#fffbeb',
                        color: analysis.forecast.confidence_score >= 60 ? '#22c55e' : '#f59e0b',
                      }}>
                        <Gauge size={13} /> {analysis.forecast.confidence_score}/100
                      </span>
                      {(() => {
                        const riskCfg = RISK_CONFIG[analysis.forecast.summary.risk_level] || RISK_CONFIG.minimal
                        return (
                          <span className="pml-badge" style={{ background: riskCfg.bg, color: riskCfg.color }}>
                            {riskCfg.label}
                          </span>
                        )
                      })()}
                    </div>
                    <div className="pml-forecast-text">
                      <Sparkles size={15} />
                      <div>
                        <p>{analysis.forecast.summary.text}</p>
                        <p className="pml-forecast-action"><ArrowRight size={13} /> {analysis.forecast.summary.recommended_action}</p>
                      </div>
                    </div>
                  </div>
                )}

                {['heart_rate', 'spo2', 'temperature'].map(feat => {
                  const fInfo = analysis.forecast?.vitals?.[feat]
                  if (!fInfo || fInfo.status !== 'ok') return null
                  const vc = VITAL_CONFIG[feat]
                  const ranges = fInfo.physiological_range
                  const hasData = forecastData.some(d => d[feat] != null)
                  if (!hasData) return null

                  return (
                    <div key={feat} className="pml-chart-wrap pml-forecast-chart">
                      <div className="pml-chart-header">
                        <h3><vc.Icon size={16} /> {vc.label} ({vc.unit})</h3>
                        <span className="pml-badge" style={{
                          background: fInfo.confidence_score >= 60 ? '#f0fdf4' : '#fffbeb',
                          color: fInfo.confidence_score >= 60 ? '#22c55e' : '#f59e0b',
                        }}>
                          {fInfo.confidence_score}/100
                        </span>
                      </div>
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={forecastData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                          <Tooltip content={<CustomTooltip />} />
                          {ranges && <ReferenceLine y={ranges[0]} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: 'Seuil bas', fontSize: 10, fill: '#94a3b8' }} />}
                          {ranges && <ReferenceLine y={ranges[1]} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: 'Seuil haut', fontSize: 10, fill: '#94a3b8' }} />}
                          <ReferenceLine
                            x={forecastData[forecastSplit - 1]?.label}
                            stroke="#6366f1"
                            strokeDasharray="6 3"
                            label={{ value: 'Prévision →', fontSize: 10, fill: '#6366f1' }}
                          />
                          <Area
                            dataKey={`${feat}_upper`}
                            stroke="none"
                            fill={vc.color}
                            fillOpacity={0.1}
                            connectNulls={false}
                            dot={false}
                            activeDot={false}
                            legendType="none"
                            tooltipType="none"
                          />
                          <Area
                            dataKey={`${feat}_lower`}
                            stroke="none"
                            fill={vc.color}
                            fillOpacity={0.1}
                            connectNulls={false}
                            dot={false}
                            activeDot={false}
                            legendType="none"
                            tooltipType="none"
                          />
                          <Line
                            type="monotone"
                            dataKey={feat}
                            name={vc.label}
                            stroke={vc.color}
                            strokeWidth={2}
                            dot={(props) => {
                              const { cx, cy, index } = props
                              if (index >= forecastSplit) {
                                return <circle key={index} cx={cx} cy={cy} r={4} fill="#fff" stroke={vc.color} strokeWidth={2} strokeDasharray="3 2" />
                              }
                              return <circle key={index} cx={cx} cy={cy} r={3} fill={vc.color} />
                            }}
                            connectNulls
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )
                })}
              </section>
            )}

            {/* Correlations matrix */}
            {Object.keys(correlations).length > 0 && (
              <section className="pml-panel">
                <h2><Layers size={18} /> Corrélations entre signes vitaux</h2>
                <div className="pml-corr-matrix">
                  <table className="pml-corr-table">
                    <thead>
                      <tr>
                        <th></th>
                        {Object.keys(correlations).map(f => (
                          <th key={f}>{VITAL_CONFIG[f]?.label || f}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(correlations).map(([f1, row]) => (
                        <tr key={f1}>
                          <td className="pml-corr-label">{VITAL_CONFIG[f1]?.label || f1}</td>
                          {Object.entries(row).map(([f2, val]) => {
                            const abs = Math.abs(val)
                            const bg = f1 === f2 ? '#e2e8f0'
                              : abs > 0.7 ? '#fecaca'
                              : abs > 0.4 ? '#fef3c7'
                              : abs > 0.2 ? '#e0f2fe'
                              : '#f8fafc'
                            return (
                              <td key={f2} style={{ background: bg, fontWeight: abs > 0.5 ? 600 : 400 }}>
                                {val.toFixed(2)}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Anomaly summary */}
            {analysis.anomaly_summary?.total > 0 && (
              <section className="pml-panel">
                <h2><ShieldAlert size={18} /> Historique des alertes cliniques</h2>
                <div className="pml-anomaly-summary-grid">
                  <div className="pml-anomaly-count-card" style={{ borderColor: '#f59e0b' }}>
                    <span className="pml-count">{analysis.anomaly_summary.total}</span>
                    <span>Total</span>
                  </div>
                  <div className="pml-anomaly-count-card" style={{ borderColor: '#6366f1' }}>
                    <span className="pml-count">{analysis.anomaly_summary.by_status?.pending ?? 0}</span>
                    <span>En attente</span>
                  </div>
                  <div className="pml-anomaly-count-card" style={{ borderColor: '#22c55e' }}>
                    <span className="pml-count">{analysis.anomaly_summary.by_status?.validated ?? 0}</span>
                    <span>Validées</span>
                  </div>
                  <div className="pml-anomaly-count-card" style={{ borderColor: '#94a3b8' }}>
                    <span className="pml-count">{analysis.anomaly_summary.by_status?.rejected ?? 0}</span>
                    <span>Rejetées</span>
                  </div>
                </div>

                {analysis.anomaly_summary.recent?.length > 0 && (
                  <div className="pml-anomaly-recent">
                    <h3>Alertes récentes</h3>
                    <div className="pml-anomaly-table-wrap">
                      <table className="pml-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Indice de risque</th>
                            <th>Niveau</th>
                            <th>Statut</th>
                            <th>Paramètres impliqués</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analysis.anomaly_summary.recent.map((a, i) => (
                            <tr key={i}>
                              <td>{formatTime(a.timestamp)}</td>
                              <td>{(a.score ?? 0).toFixed(3)}</td>
                              <td>
                                <span className="pml-level-dot" style={{ background: LEVEL_COLORS[a.level] || '#6366f1' }} />
                                {a.level}
                              </td>
                              <td>{a.status}</td>
                              <td>
                                {(a.contributing_variables || []).slice(0, 3).map((cv, j) => (
                                  <span key={j} className="pml-contrib-tag">
                                    {cv.variable} ({(cv.contribution_weight * 100).toFixed(0)}%)
                                  </span>
                                ))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Data quality info */}
            <section className="pml-panel pml-data-info">
              <Info size={15} />
              <span>
                {analysis.n_measurements} mesures analysées · {Math.round(analysis.time_span_hours || 0)}h de données
                · Généré le {formatTime(analysis.generated_at)}
              </span>
            </section>
          </>
        )}
      </div>
    </DoctorLayout>
  )
}
