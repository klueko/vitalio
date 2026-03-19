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
  AreaChart, Area, BarChart, Bar, ComposedChart, Line, ReferenceLine, ReferenceArea,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts'
import { getMLModelInfo, getMLAnomalies, getMLDecisions, getDoctorPatients, getMLForecast, getPatientMLAnalysis, apiRequest } from '../services/api'
import DoctorLayout from '../components/DoctorLayout'

const CONFIDENCE_LEVELS = [
  { min: 80, label: 'Fiabilité élevée', color: '#047857', bg: '#ecfdf5' },
  { min: 60, label: 'Fiabilité modérée', color: '#b45309', bg: '#fffbeb' },
  { min: 40, label: 'Fiabilité faible', color: '#b45309', bg: '#fff7ed' },
  { min: 0,  label: 'Fiabilité très faible', color: '#b91c1c', bg: '#fef2f2' },
]

const RISK_CONFIG = {
  minimal:  { color: '#047857', bg: '#ecfdf5', label: 'Risque minimal' },
  low:      { color: '#1d4ed8', bg: '#eff6ff', label: 'Risque faible' },
  moderate: { color: '#b45309', bg: '#fffbeb', label: 'Risque modéré' },
  high:     { color: '#b91c1c', bg: '#fef2f2', label: 'Risque élevé' },
}

const URGENCY_CONFIG = {
  immediate: { color: '#b91c1c', bg: '#fef2f2', label: 'Immédiat' },
  priority:  { color: '#b45309', bg: '#fffbeb', label: 'Prioritaire' },
  routine:   { color: '#047857', bg: '#ecfdf5', label: 'Routine' },
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
  normal:   { color: '#047857', bg: '#ecfdf5', label: 'Normal',       Icon: CheckCircle2 },
  warning:  { color: '#b45309', bg: '#fffbeb', label: 'Surveillance', Icon: AlertTriangle },
  critical: { color: '#b91c1c', bg: '#fef2f2', label: 'Critique',     Icon: XCircle },
}

const STATUS_CONFIG = {
  pending:   { color: '#1d4ed8', bg: '#eff6ff', label: 'En attente' },
  validated: { color: '#047857', bg: '#ecfdf5', label: 'Validée' },
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
  const bg = type === 'success' ? '#ecfdf5' : '#fef2f2'
  const border = type === 'success' ? '#6ee7b7' : '#fecaca'
  const color = type === 'success' ? '#047857' : '#b91c1c'
  return (
    <div className="ml-toast" style={{ background: bg, borderColor: border, color }}>
      {type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
      <span>{message}</span>
    </div>
  )
}

function HeatmapChart({ heatmapData }) {
  const [hovered, setHovered] = useState(null)
  if (!heatmapData || heatmapData.total === 0) return null
  const { grid, anomalyGrid, maxCount, dayLabels } = heatmapData
  const cellW = 36
  const cellH = 20
  const paddingTop = 20
  const paddingLeft = 28
  const w = paddingLeft + 7 * cellW
  const h = paddingTop + 24 * cellH
  const getColor = (count) => {
    if (count === 0) return '#f1f5f9'
    const t = maxCount > 0 ? Math.min(count / maxCount, 1) : 0
    const r = Math.round(239 - 139 * t)
    const g = Math.round(246 - 166 * t)
    const b = Math.round(255 - 159 * t)
    return `rgb(${r},${g},${b})`
  }
  return (
    <div className="ml-heatmap-wrap" style={{ overflowX: 'auto' }}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="ml-heatmap-svg"
        onMouseLeave={() => setHovered(null)}
      >
        {dayLabels.map((label, day) => (
          <text
            key={day}
            x={paddingLeft + day * cellW + cellW / 2}
            y={14}
            textAnchor="middle"
            className="ml-heatmap-axis"
          >
            {label}
          </text>
        ))}
        {Array.from({ length: 24 }, (_, hour) => (
          <text
            key={hour}
            x={paddingLeft - 6}
            y={paddingTop + hour * cellH + cellH / 2 + 4}
            textAnchor="end"
            className="ml-heatmap-axis"
          >
            {hour}h
          </text>
        ))}
        {grid.map((row, hour) =>
          row.map((count, day) => {
            const anomalies = anomalyGrid[hour][day]
            const isHovered = hovered?.hour === hour && hovered?.day === day
            return (
              <rect
                key={`${hour}-${day}`}
                x={paddingLeft + day * cellW + 1}
                y={paddingTop + hour * cellH + 1}
                width={cellW - 2}
                height={cellH - 2}
                fill={getColor(count)}
                stroke={isHovered ? '#1d4ed8' : '#e2e8f0'}
                strokeWidth={isHovered ? 2 : 1}
                rx={3}
                onMouseEnter={() => setHovered({ hour, day, count, anomalies })}
              />
            )
          })
        )}
      </svg>
      {hovered != null && (
        <p className="ml-heatmap-hint">
          {dayLabels[hovered.day]} {hovered.hour}h : {hovered.count} mesure{hovered.count > 1 ? 's' : ''}
          {hovered.anomalies > 0 && ` · ${hovered.anomalies} anomalie${hovered.anomalies > 1 ? 's' : ''}`}
        </p>
      )}
    </div>
  )
}

function AlertsTimeline({ alerts }) {
  const [hoveredId, setHoveredId] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  if (!alerts?.length) return null
  const sorted = [...alerts].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
  const minT = new Date(sorted[0].timestamp).getTime()
  const maxT = new Date(sorted[sorted.length - 1].timestamp).getTime()
  const span = Math.max(maxT - minT, 1)
  const getX = (ts) => (span > 0 ? ((new Date(ts).getTime() - minT) / span) * 100 : 50)
  const LEVEL_COLORS = { critical: '#b91c1c', warning: '#b45309', normal: '#047857' }
  const handleHover = (id) => setHoveredId(id)
  const handleClick = (id) => setExpandedId((prev) => (prev === id ? null : id))
  return (
    <div className="ml-alerts-timeline">
      <div className="ml-alerts-timeline-track">
        {sorted.map((a) => {
          const x = getX(a.timestamp)
          const color = LEVEL_COLORS[a.level] || '#b91c1c'
          const isHovered = hoveredId === a.id
          const isExpanded = expandedId === a.id
          return (
            <div
              key={a.id}
              className="ml-alerts-timeline-marker"
              style={{ left: `${x}%` }}
              onMouseEnter={() => handleHover(a.id)}
              onMouseLeave={() => handleHover(null)}
              onClick={() => handleClick(a.id)}
            >
              <span
                className="ml-alerts-marker-dot"
                style={{
                  background: color,
                  borderColor: isHovered || isExpanded ? '#1e293b' : 'transparent',
                  boxShadow: isHovered || isExpanded ? '0 0 0 2px #fff' : 'none',
                }}
                title={a.label}
              />
              {(isHovered || isExpanded) && (
                <div className={`ml-alerts-marker-tooltip ${isExpanded ? 'ml-alerts-marker-tooltip--expanded' : ''}`}>
                  <p className="ml-alerts-tooltip-time">{a.label}</p>
                  <p>Score : {(a.score ?? 0).toFixed(3)} · {a.level}</p>
                  <p className="ml-alerts-tooltip-vitals">
                    FC : {a.heart_rate != null ? a.heart_rate.toFixed(0) : '-'} bpm
                    {' · '}SpO₂ : {a.spo2 != null ? a.spo2.toFixed(0) : '-'} %
                    {' · '}Temp : {a.temperature != null ? a.temperature.toFixed(1) : '-'} °C
                  </p>
                  {a.contributing_variables?.length > 0 && (
                    <p className="ml-alerts-tooltip-contrib">
                      Variables : {a.contributing_variables.slice(0, 3).map((c) => (typeof c === 'object' ? c.variable : c)).join(', ')}
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="ml-alerts-timeline-axis">
        <span>{formatTime(sorted[0].timestamp)}</span>
        <span>{formatTime(sorted[sorted.length - 1].timestamp)}</span>
      </div>
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

  const [analysisData, setAnalysisData] = useState(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisError, setAnalysisError] = useState('')

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
        horizon: 24,
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

  const loadPatientAnalysis = useCallback(async (patientId) => {
    if (!patientId) {
      setAnalysisData(null)
      setAnalysisError('')
      return
    }
    try {
      setAnalysisLoading(true)
      setAnalysisError('')
      setAnalysisData(null)
      const token = await getAccessTokenSilently()
      const data = await getPatientMLAnalysis(token, patientId, {
        days: 30,
        include_forecast: true,
      })
      setAnalysisData(data)
    } catch (e) {
      setAnalysisError(e.message || 'Erreur de chargement de l\'analyse patient')
    } finally {
      setAnalysisLoading(false)
    }
  }, [getAccessTokenSilently])

  useEffect(() => {
    if (selectedPatient) {
      loadPatientAnalysis(selectedPatient)
    } else {
      setAnalysisData(null)
      setAnalysisLoading(false)
      setAnalysisError('')
    }
  }, [selectedPatient, loadPatientAnalysis])

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

  const riskScoreSeries = useMemo(() => {
    if (!analysisData?.ml_score_timeline?.length) return []
    return analysisData.ml_score_timeline.slice().reverse().map((d, i) => ({
      timestamp: formatTime(d.timestamp),
      score: Number((d.score ?? 0).toFixed(3)),
      level: d.level || 'normal',
      index: i,
    }))
  }, [analysisData])

  const morningVsEveningData = useMemo(() => {
    if (!analysisData?.vitals) return []
    const FEAT_CONFIG = {
      heart_rate: { label: 'FC (bpm)', color: '#b91c1c' },
      spo2: { label: 'SpO₂ (%)', color: '#1d4ed8' },
      temperature: { label: 'Temp (°C)', color: '#047857' },
    }
    const result = []
    for (const [feat, cfg] of Object.entries(FEAT_CONFIG)) {
      const info = analysisData.vitals[feat]
      const series = info?.series || []
      const matinVals = []
      const soirVals = []
      for (const pt of series) {
        const ts = pt.timestamp
        if (!ts) continue
        const d = new Date(ts)
        const hour = d.getHours()
        const val = pt.value ?? pt[feat]
        if (val == null || isNaN(Number(val))) continue
        const num = Number(val)
        if (hour >= 6 && hour < 12) matinVals.push(num)
        else if (hour >= 18 && hour < 22) soirVals.push(num)
      }
      const matinMean = matinVals.length > 0 ? matinVals.reduce((a, b) => a + b, 0) / matinVals.length : null
      const soirMean = soirVals.length > 0 ? soirVals.reduce((a, b) => a + b, 0) / soirVals.length : null
      if (matinMean != null || soirMean != null) {
        result.push({
          name: cfg.label,
          feat,
          Matin: matinMean != null ? Number(matinMean.toFixed(1)) : null,
          Soir: soirMean != null ? Number(soirMean.toFixed(1)) : null,
          matinN: matinVals.length,
          soirN: soirVals.length,
        })
      }
    }
    return result
  }, [analysisData])

  const [variabilityWindow, setVariabilityWindow] = useState(6)
  const [radarPeriod, setRadarPeriod] = useState('7j')

  const radarData = useMemo(() => {
    if (!analysisData?.vitals) return []
    const FEATS = [
      { feat: 'heart_rate', label: 'FC', fullMark: 1 },
      { feat: 'spo2', label: 'SpO₂', fullMark: 1 },
      { feat: 'temperature', label: 'Temp', fullMark: 1 },
    ]
    const now = Date.now()
    const cutoffMs = radarPeriod === '24h'
      ? now - 24 * 60 * 60 * 1000
      : now - 7 * 24 * 60 * 60 * 1000
    const result = []
    for (const { feat, label, fullMark } of FEATS) {
      const info = analysisData.vitals[feat]
      const series = info?.series || []
      const range = info?.physiological_range
      const recent = series.filter((pt) => {
        const ts = pt.timestamp ? new Date(pt.timestamp).getTime() : 0
        return ts >= cutoffMs
      })
      const vals = recent
        .map((pt) => pt.value ?? pt[feat])
        .filter((v) => v != null && !isNaN(Number(v)))
        .map(Number)
      if (vals.length === 0) continue
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length
      const DEFAULT_RANGES = { heart_rate: [50, 120], spo2: [92, 100], temperature: [35.5, 38] }
      const [lo, hi] = range && range.length >= 2 ? range : (DEFAULT_RANGES[feat] || [0, 100])
      const span = hi - lo
      const value = span > 0 ? Math.max(0, Math.min(1, (mean - lo) / span)) : 0.5
      result.push({
        subject: label,
        value: Number(value.toFixed(3)),
        fullMark,
        rawValue: mean,
        unit: info?.unit || '',
      })
    }
    return result
  }, [analysisData, radarPeriod])

  const variabilityData = useMemo(() => {
    if (!analysisData?.vitals) return []
    const FEATS = [
      { feat: 'heart_rate', label: 'FC', color: '#b91c1c', dataKey: 'fc_std' },
      { feat: 'spo2', label: 'SpO₂', color: '#1d4ed8', dataKey: 'spo2_std' },
      { feat: 'temperature', label: 'Temp', color: '#047857', dataKey: 'temp_std' },
    ]
    const windowMs = variabilityWindow * 60 * 60 * 1000
    const allPoints = []
    for (const { feat } of FEATS) {
      const series = analysisData.vitals[feat]?.series || []
      for (const pt of series) {
        const ts = pt.timestamp
        if (!ts) continue
        const val = pt.value ?? pt[feat]
        if (val == null || isNaN(Number(val))) continue
        allPoints.push({ feat, ts: new Date(ts).getTime(), val: Number(val) })
      }
    }
    const uniqueTs = [...new Set(allPoints.map((p) => p.ts))].sort((a, b) => a - b)
    if (uniqueTs.length === 0) return []
    const std = (arr) => {
      if (arr.length < 2) return 0
      const m = arr.reduce((a, b) => a + b, 0) / arr.length
      const v = arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1)
      return Math.sqrt(v)
    }
    const result = []
    const step = uniqueTs.length > 200 ? Math.max(1, Math.floor(uniqueTs.length / 200)) : 1
    for (let i = 0; i < uniqueTs.length; i += step) {
      const t = uniqueTs[i]
      const tStart = t - windowMs
      const row = {
        label: formatTime(new Date(t).toISOString()),
        timestamp: t,
        fc_std: null,
        spo2_std: null,
        temp_std: null,
      }
      for (const { feat, dataKey } of FEATS) {
        const inWindow = allPoints.filter((p) => p.feat === feat && p.ts >= tStart && p.ts <= t)
        const vals = inWindow.map((p) => p.val)
        if (vals.length >= 2) row[dataKey] = Number(std(vals).toFixed(3))
        else if (vals.length === 1) row[dataKey] = 0
      }
      result.push(row)
    }
    return result
  }, [analysisData, variabilityWindow])

  const alertsTimelineData = useMemo(() => {
    if (!analysisData?.anomaly_summary?.recent?.length || !analysisData?.vitals) return []
    const recent = analysisData.anomaly_summary.recent
    const vitals = analysisData.vitals
    const findClosest = (feat, targetTs) => {
      const series = vitals[feat]?.series || []
      if (series.length === 0) return null
      let best = null
      let bestDist = Infinity
      const t = new Date(targetTs).getTime()
      for (const pt of series) {
        const ptTs = pt.timestamp ? new Date(pt.timestamp).getTime() : 0
        const dist = Math.abs(ptTs - t)
        if (dist < bestDist) {
          bestDist = dist
          best = pt.value ?? pt[feat]
        }
      }
      return best != null && !isNaN(Number(best)) ? Number(best) : null
    }
    return recent.map((a, i) => {
      const ts = a.timestamp || a.measured_at
      return {
        id: `alert-${i}`,
        timestamp: ts,
        label: formatTime(ts),
        score: a.score,
        level: a.level || 'critical',
        status: a.status || 'pending',
        contributing_variables: a.contributing_variables || [],
        heart_rate: findClosest('heart_rate', ts),
        spo2: findClosest('spo2', ts),
        temperature: findClosest('temperature', ts),
      }
    })
  }, [analysisData])

  const heatmapData = useMemo(() => {
    if (!analysisData?.vitals) return { grid: [], maxCount: 0, total: 0 }
    const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
    const grid = Array.from({ length: 24 }, () => Array(7).fill(0))
    const anomalyGrid = Array.from({ length: 24 }, () => Array(7).fill(0))
    const byTimestamp = new Map()
    Object.values(analysisData.vitals).forEach((info) => {
      (info?.series || []).forEach((pt) => {
        const ts = pt.timestamp
        if (!ts) return
        if (!byTimestamp.has(ts)) byTimestamp.set(ts, { hasAnomaly: false })
        if (pt.is_anomaly) byTimestamp.get(ts).hasAnomaly = true
      })
    })
    let maxCount = 0
    let total = 0
    byTimestamp.forEach((val, ts) => {
      const d = new Date(ts)
      const day = (d.getDay() + 6) % 7
      const hour = d.getHours()
      grid[hour][day]++
      if (val.hasAnomaly) anomalyGrid[hour][day]++
      maxCount = Math.max(maxCount, grid[hour][day])
      total++
    })
    return {
      grid,
      anomalyGrid,
      maxCount,
      total,
      dayLabels: DAY_LABELS,
    }
  }, [analysisData])

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
              <article className="ml-kpi-card" style={{ borderColor: '#1d4ed8', background: '#eff6ff' }}>
                <TrendingUp size={22} color="#1d4ed8" />
                <div>
                  <span className="ml-kpi-value" style={{ color: '#1d4ed8' }}>{stats.total}</span>
                  <span className="ml-kpi-label">Total analyses</span>
                </div>
              </article>
            </section>

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
                      const trendColor = trend.label === 'stable' ? '#047857' : trend.label === 'increasing' ? '#b45309' : '#1d4ed8'
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
                        const colors = { heart_rate: '#b91c1c', spo2: '#1d4ed8', temperature: '#047857' }
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
                                  <ReferenceLine x={forecastChartData[forecastSplitIndex - 1]?.label} stroke="#1d4ed8" strokeDasharray="6 3" label={{ value: 'Prévision →', fontSize: 10, fill: '#1d4ed8' }} />
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

            {/* Analyses détaillées par patient - données exclusivement de analysisData */}
            <section className="ml-panel ml-analysis-patient-section">
              <div className="ml-analysis-section-header">
                <h2><Users size={18} /> Analyses détaillées par patient</h2>
                <div className="ml-analysis-patient-controls">
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
                    onClick={() => loadPatientAnalysis(selectedPatient)}
                    disabled={analysisLoading || !selectedPatient}
                    style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem' }}
                  >
                    {analysisLoading ? 'Chargement...' : 'Actualiser'}
                  </button>
                </div>
              </div>

              {!selectedPatient ? (
                <div className="ml-empty ml-empty--section">
                  <Info size={20} />
                  <span>Sélectionnez un patient pour afficher les analyses détaillées.</span>
                </div>
              ) : analysisLoading ? (
                <div className="ml-empty ml-empty--section">
                  <Activity size={18} className="ml-spin" />
                  <span>Chargement de l&apos;analyse patient...</span>
                </div>
              ) : analysisError ? (
                <div className="ml-panel ml-panel--error ml-analysis-error">
                  <ShieldAlert size={16} />
                  <span>{analysisError}</span>
                  <button
                    className="ml-retrain-btn"
                    onClick={() => loadPatientAnalysis(selectedPatient)}
                    style={{ marginLeft: 'auto', padding: '0.3rem 0.7rem', fontSize: '0.75rem' }}
                  >
                    Réessayer
                  </button>
                </div>
              ) : analysisData && analysisData.patient_id !== selectedPatient ? (
                <div className="ml-empty ml-empty--section">
                  <Activity size={18} className="ml-spin" />
                  <span>Chargement des données du patient sélectionné...</span>
                </div>
              ) : analysisData && analysisData.patient_id === selectedPatient ? (
                (() => {
                  const hasInsufficientData = (analysisData.n_measurements ?? 0) < 3 ||
                    !analysisData.vitals ||
                    Object.keys(analysisData.vitals).length === 0 ||
                    !Object.values(analysisData.vitals || {}).some((v) => (v?.series?.length ?? 0) > 0)
                  if (hasInsufficientData) {
                    return (
                      <div className="ml-empty ml-empty--section">
                        <Info size={20} />
                        <span>
                          Données insuffisantes pour ce patient ({analysisData.n_measurements ?? 0} mesures).
                          Au moins 3 mesures avec constantes vitales sont nécessaires.
                        </span>
                      </div>
                    )
                  }
                  return (
                <div className="ml-analysis-ready">
                  <p className="ml-panel-sub ml-analysis-meta">
                    {analysisData.patient_display || selectedPatient}
                    {analysisData.n_measurements != null && ` · ${analysisData.n_measurements} mesures`}
                  </p>
                  {selectedPatient && riskScoreSeries.length > 0 && (
                    <div className="ml-risk-evolution-section">
                      <h3><Activity size={18} /> Évolution de l'indice de risque</h3>
                      <p className="ml-panel-sub">Score d'anomalie ML (0–1) par mesure. Seuils : &lt;0,45 normal, 0,45–0,70 surveillance, &gt;0,70 critique</p>
                      <div className="ml-chart-wrap">
                        <ResponsiveContainer width="100%" height={240}>
                          <AreaChart data={riskScoreSeries} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                            <defs>
                              <linearGradient id="mlRiskScoreGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#1d4ed8" stopOpacity={0.25} />
                                <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="timestamp" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                            <YAxis domain={[0, 1]} tick={{ fontSize: 11 }} />
                            <Tooltip content={({ active, payload }) => {
                              if (!active || !payload?.length) return null
                              const p = payload[0]?.payload
                              const lvl = p?.level || 'normal'
                              const cfg = LEVEL_CONFIG[lvl] || {}
                              return (
                                <div className="ml-chart-tooltip">
                                  <p className="ml-chart-tooltip-time">{p?.timestamp}</p>
                                  <p><strong>Indice :</strong> {p?.score?.toFixed(3)}</p>
                                  <p style={{ color: cfg.color }}><strong>Niveau :</strong> {cfg.label || lvl}</p>
                                </div>
                              )
                            }} />
                            <ReferenceArea y1={0} y2={0.45} fill="#047857" fillOpacity={0.06} />
                            <ReferenceArea y1={0.45} y2={0.70} fill="#b45309" fillOpacity={0.06} />
                            <ReferenceArea y1={0.70} y2={1} fill="#b91c1c" fillOpacity={0.06} />
                            <ReferenceLine y={0.45} stroke="#b45309" strokeDasharray="4 4" label={{ value: 'Surveillance', fontSize: 10, fill: '#b45309' }} />
                            <ReferenceLine y={0.70} stroke="#b91c1c" strokeDasharray="4 4" label={{ value: 'Critique', fontSize: 10, fill: '#b91c1c' }} />
                            <Area
                              type="monotone"
                              dataKey="score"
                              name="Indice de risque"
                              stroke="#1d4ed8"
                              fill="url(#mlRiskScoreGrad)"
                              strokeWidth={2}
                              dot={(props) => {
                                const { cx, cy, payload } = props
                                const c = (LEVEL_CONFIG[payload?.level] || {}).color || '#1d4ed8'
                                const r = payload?.level === 'critical' ? 5 : payload?.level === 'warning' ? 4 : 2
                                return <circle cx={cx} cy={cy} r={r} fill={c} stroke="#fff" strokeWidth={1} />
                              }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                  {selectedPatient && radarData.length > 0 && (
                    <div className="ml-radar-section">
                      <div className="ml-radar-header">
                        <h3>Profil des constantes (radar)</h3>
                        <div className="ml-radar-toggles">
                          {[
                            { key: '24h', label: '24h' },
                            { key: '7j', label: '7j' },
                          ].map(({ key, label }) => (
                            <button
                              key={key}
                              type="button"
                              className={`ml-filter-btn ${radarPeriod === key ? 'ml-filter-btn--active' : ''}`}
                              onClick={() => setRadarPeriod(key)}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <p className="ml-panel-sub">Moyennes normalisées [0–1] via plages physiologiques</p>
                      <div className="ml-radar-wrap">
                        <ResponsiveContainer width="100%" height={280}>
                          <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                            <PolarGrid stroke="#e2e8f0" />
                            <PolarAngleAxis
                              dataKey="subject"
                              tick={{ fontSize: 12, fill: '#475569' }}
                            />
                            <PolarRadiusAxis
                              angle={90}
                              domain={[0, 1]}
                              tick={{ fontSize: 10 }}
                            />
                            <Radar
                              name="Profil"
                              dataKey="value"
                              stroke="#1d4ed8"
                              fill="#1d4ed8"
                              fillOpacity={0.4}
                              strokeWidth={2}
                            />
                            <Tooltip
                              content={({ active, payload }) => {
                                if (!active || !payload?.[0]?.payload) return null
                                const p = payload[0].payload
                                return (
                                  <div className="ml-chart-tooltip">
                                    <p><strong>{p.subject}</strong></p>
                                    <p>Normalisé : {p.value?.toFixed(2)}</p>
                                    <p>Valeur : {p.rawValue?.toFixed(1)} {p.unit}</p>
                                  </div>
                                )
                              }}
                            />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                  {selectedPatient && heatmapData.total > 0 && (
                    <div className="ml-heatmap-section">
                      <h3>Répartition horaire des mesures (jour × heure)</h3>
                      <p className="ml-panel-sub">Nombre de mesures par créneau. Plus la couleur est foncée, plus il y a de mesures.</p>
                      <HeatmapChart heatmapData={heatmapData} />
                    </div>
                  )}
                  {selectedPatient && variabilityData.length > 0 && (
                    <div className="ml-variability-section">
                      <div className="ml-variability-header">
                        <div>
                          <h3>Score de variabilité</h3>
                          <p className="ml-panel-sub">Écart-type glissant ({variabilityWindow}h) — FC, SpO₂, Temp</p>
                        </div>
                        <div className="ml-variability-toggles">
                          {[6, 12].map((h) => (
                            <button
                              key={h}
                              type="button"
                              className={`ml-filter-btn ${variabilityWindow === h ? 'ml-filter-btn--active' : ''}`}
                              onClick={() => setVariabilityWindow(h)}
                            >
                              {h}h
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="ml-chart-wrap">
                        <ResponsiveContainer width="100%" height={220}>
                          <AreaChart data={variabilityData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                            <defs>
                              <linearGradient id="mlVarFc" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#b91c1c" stopOpacity={0.25} />
                                <stop offset="95%" stopColor="#b91c1c" stopOpacity={0} />
                              </linearGradient>
                              <linearGradient id="mlVarSpo2" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#1d4ed8" stopOpacity={0.25} />
                                <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0} />
                              </linearGradient>
                              <linearGradient id="mlVarTemp" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#047857" stopOpacity={0.25} />
                                <stop offset="95%" stopColor="#047857" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                            <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                            <Tooltip
                              formatter={(val, name) => [val != null ? Number(val).toFixed(3) : '-', name]}
                              contentStyle={{ borderRadius: '8px', fontSize: '0.8rem' }}
                            />
                            <Legend />
                            <Area type="monotone" dataKey="fc_std" name="FC (écart-type)" stroke="#b91c1c" fill="url(#mlVarFc)" strokeWidth={1.5} dot={false} connectNulls />
                            <Area type="monotone" dataKey="spo2_std" name="SpO₂ (écart-type)" stroke="#1d4ed8" fill="url(#mlVarSpo2)" strokeWidth={1.5} dot={false} connectNulls />
                            <Area type="monotone" dataKey="temp_std" name="Temp (écart-type)" stroke="#047857" fill="url(#mlVarTemp)" strokeWidth={1.5} dot={false} connectNulls />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                  {selectedPatient && alertsTimelineData.length > 0 && (
                    <div className="ml-alerts-timeline-section">
                      <h3>Timeline des alertes</h3>
                      <p className="ml-panel-sub">Survol ou clic pour afficher le contexte (FC, SpO₂, Temp) au moment de l&apos;alerte</p>
                      <AlertsTimeline alerts={alertsTimelineData} />
                    </div>
                  )}
                  {selectedPatient && morningVsEveningData.length > 0 && (
                    <div className="ml-morning-evening-section">
                      <h3>Comparaison matin vs soir</h3>
                      <p className="ml-panel-sub">Moyennes : Matin 6h–12h, Soir 18h–22h</p>
                      <div className="ml-chart-wrap">
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart
                            data={morningVsEveningData}
                            margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
                            barGap={4}
                            barCategoryGap="20%"
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                            <Tooltip
                              formatter={(val, name) => [val != null ? val.toFixed(1) : '-', name]}
                              content={({ active, payload }) => {
                                if (!active || !payload?.length) return null
                                const d = payload[0]?.payload
                                return (
                                  <div className="ml-chart-tooltip">
                                    <p><strong>{d?.name}</strong></p>
                                    <p>Matin : {d?.Matin != null ? d.Matin.toFixed(1) : '-'} ({d?.matinN ?? 0} mesures)</p>
                                    <p>Soir : {d?.Soir != null ? d.Soir.toFixed(1) : '-'} ({d?.soirN ?? 0} mesures)</p>
                                  </div>
                                )
                              }}
                            />
                            <Legend />
                            <Bar dataKey="Matin" name="Matin (6h–12h)" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="Soir" name="Soir (18h–22h)" fill="#64748b" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </div>
                  )
                })()
              ) : null}
            </section>

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
