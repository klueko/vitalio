import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'
import { ArrowLeft, BrainCircuit } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import {
  createDoctorFeedback,
  getDoctorPatientMeasurements,
  getDoctorPatientTrends,
  getLatestPatientFeedback,
} from '../services/api'
import DoctorLayout from '../components/DoctorLayout'

function formatDay(timestamp) {
  if (!timestamp) return ''
  return new Date(timestamp).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

export default function DoctorPatientDetail() {
  const { patientId } = useParams()
  const navigate = useNavigate()
  const { getAccessTokenSilently } = useAuth0()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [measurements, setMeasurements] = useState([])
  const [trends, setTrends] = useState(null)
  const [windowDays, setWindowDays] = useState(7)
  const [feedback, setFeedback] = useState([])
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [feedbackSeverity, setFeedbackSeverity] = useState('medium')
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false)
  const [feedbackError, setFeedbackError] = useState('')

  useEffect(() => {
    let mounted = true

    const loadPatientDetail = async () => {
      try {
        setLoading(true)
        setError('')
        const token = await getAccessTokenSilently()
        const [measurementsRes, trendsRes] = await Promise.all([
          getDoctorPatientMeasurements(token, patientId, 30),
          getDoctorPatientTrends(token, patientId),
        ])
        const feedbackRes = await getLatestPatientFeedback(token, patientId, 5)
        if (mounted) {
          const rows = Array.isArray(measurementsRes.measurements) ? measurementsRes.measurements : []
          setMeasurements(rows)
          setTrends(trendsRes.trends || null)
          setFeedback(Array.isArray(feedbackRes.feedback) ? feedbackRes.feedback : [])
        }
      } catch (fetchError) {
        if (mounted) {
          setError(fetchError.message || 'Erreur de chargement des données patient')
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    loadPatientDetail()
    return () => {
      mounted = false
    }
  }, [getAccessTokenSilently, patientId])

  const selectedTrend = windowDays === 7 ? trends?.['7d'] : trends?.['30d']

  const chartData = useMemo(() => {
    const source = selectedTrend?.series || []
    return source.map((row) => ({
      date: formatDay(row.timestamp),
      spo2: row.spo2,
      heart_rate: row.heart_rate,
      temperature: row.temperature,
    }))
  }, [selectedTrend])

  const latest = measurements[0]

  const submitFeedback = async () => {
    const trimmedMessage = feedbackMessage.trim()
    if (!trimmedMessage) {
      setFeedbackError('Le message est obligatoire.')
      return
    }

    try {
      setFeedbackSubmitting(true)
      setFeedbackError('')
      const token = await getAccessTokenSilently()
      await createDoctorFeedback(token, patientId, {
        message: trimmedMessage,
        severity: feedbackSeverity,
        status: 'new',
      })
      const feedbackRes = await getLatestPatientFeedback(token, patientId, 5)
      setFeedback(Array.isArray(feedbackRes.feedback) ? feedbackRes.feedback : [])
      setFeedbackMessage('')
    } catch (submitError) {
      setFeedbackError(submitError.message || 'Impossible de publier le retour.')
    } finally {
      setFeedbackSubmitting(false)
    }
  }

  return (
    <DoctorLayout>
      <div className="doctor-container doctor-theme">
        <div className="main-content">
          <header>
            <h2>Détail patient</h2>
            <div className="header-actions">
              <button
                className="trend-button"
                onClick={() => navigate(`/doctor/patient/${patientId}/ml`)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <BrainCircuit size={16} /> Suivi avancé
              </button>
              <button className="bell-btn" onClick={() => navigate('/doctor')}>
                <ArrowLeft size={20} />
              </button>
            </div>
          </header>

          <main>
          {loading && <p>Chargement des mesures...</p>}
          {!loading && error && <p className="doctor-error">{error}</p>}
          {!loading && !error && (
            <>
              <div className="stats-bar">
                <div className="stat-card">
                  <p className="title">SpO2</p>
                  <div className="content-row">
                    <span className="value">{latest?.spo2 ?? '-'}</span>
                  </div>
                </div>
                <div className="stat-card">
                  <p className="title">FC</p>
                  <div className="content-row">
                    <span className="value">{latest?.heart_rate ?? '-'}</span>
                  </div>
                </div>
                <div className="stat-card">
                  <p className="title">Temperature</p>
                  <div className="content-row">
                    <span className="value">{latest?.temperature ?? '-'}</span>
                  </div>
                </div>
              </div>

              <div className="patient-table-section">
                <div className="section-header">
                  <h3>Tendances ({windowDays} jours)</h3>
                  <div>
                    <button className="trend-button" onClick={() => setWindowDays(7)}>7 jours</button>
                    <button className="trend-button" onClick={() => setWindowDays(30)}>30 jours</button>
                  </div>
                </div>
                <div className="chart-area">
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={chartData}>
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="spo2" stroke="#2563eb" dot={false} />
                      <Line type="monotone" dataKey="heart_rate" stroke="#b91c1c" dot={false} />
                      <Line type="monotone" dataKey="temperature" stroke="#047857" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="patient-table-section">
                <div className="section-header">
                  <h3>Historique des mesures</h3>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>SpO2</th>
                      <th>FC</th>
                      <th>Température</th>
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {measurements.map((measurement, index) => (
                      <tr key={`${measurement.timestamp}-${index}`}>
                        <td>{new Date(measurement.timestamp).toLocaleString('fr-FR')}</td>
                        <td>{measurement.spo2}</td>
                        <td>{measurement.heart_rate}</td>
                        <td>{measurement.temperature}</td>
                        <td>{measurement.status || '-'}</td>
                      </tr>
                    ))}
                    {!measurements.length && (
                      <tr>
                        <td colSpan="5">Aucune mesure disponible.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="patient-table-section">
                <div className="section-header">
                  <h3>Nouveau commentaire médecin</h3>
                </div>
                <div style={{ display: 'grid', gap: '12px' }}>
                  <textarea
                    value={feedbackMessage}
                    onChange={(event) => setFeedbackMessage(event.target.value)}
                    placeholder="Saisir un commentaire clinique..."
                    rows={4}
                  />
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <label htmlFor="severity">Sévérité :</label>
                    <select
                      id="severity"
                      value={feedbackSeverity}
                      onChange={(event) => setFeedbackSeverity(event.target.value)}
                    >
                      <option value="low">Faible</option>
                      <option value="medium">Moyenne</option>
                      <option value="high">Haute</option>
                    </select>
                    <button
                      className="trend-button"
                      onClick={submitFeedback}
                      disabled={feedbackSubmitting}
                    >
                      {feedbackSubmitting ? 'Envoi...' : 'Publier'}
                    </button>
                  </div>
                  {feedbackError && <p className="doctor-error">{feedbackError}</p>}
                </div>
              </div>

              <div className="patient-table-section">
                <div className="section-header">
                  <h3>Derniers commentaires médecin</h3>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Sévérité</th>
                      <th>Message</th>
                      <th>Médecin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {feedback.map((item, index) => (
                      <tr key={`${item.created_at || index}-${index}`}>
                        <td>{item.created_at ? new Date(item.created_at).toLocaleString('fr-FR') : '-'}</td>
                        <td>{item.severity || '-'}</td>
                        <td>{item.message || '-'}</td>
                        <td>{item.doctor_user_id_auth || '-'}</td>
                      </tr>
                    ))}
                    {!feedback.length && (
                      <tr>
                        <td colSpan="4">Aucun commentaire médecin disponible.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
          </main>
        </div>
      </div>
    </DoctorLayout>
  )
}
