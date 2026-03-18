import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'
import { ArrowLeft } from 'lucide-react'
import { getLatestPatientFeedback, getPatientMeasurementsById } from '../services/api'

export default function CaregiverPatientDetail() {
  const { patientId } = useParams()
  const navigate = useNavigate()
  const { getAccessTokenSilently } = useAuth0()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [measurements, setMeasurements] = useState([])
  const [feedback, setFeedback] = useState([])

  useEffect(() => {
    let mounted = true
    const loadDetail = async () => {
      try {
        setLoading(true)
        setError('')
        const token = await getAccessTokenSilently()
        const [measurementsRes, feedbackRes] = await Promise.all([
          getPatientMeasurementsById(token, patientId, { limit: 200 }),
          getLatestPatientFeedback(token, patientId, 5),
        ])

        if (mounted) {
          setMeasurements(Array.isArray(measurementsRes.measurements) ? measurementsRes.measurements : [])
          setFeedback(Array.isArray(feedbackRes.feedback) ? feedbackRes.feedback : [])
        }
      } catch (fetchError) {
        if (mounted) {
          setError(fetchError.message || 'Erreur de chargement du détail patient')
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadDetail()
    return () => {
      mounted = false
    }
  }, [getAccessTokenSilently, patientId])

  return (
    <div className="doctor-container doctor-theme">
      <div className="main-content">
        <header>
          <h2>Détail patient (aidant)</h2>
          <div className="header-actions">
            <button className="bell-btn" onClick={() => navigate('/caregiver')}>
              <ArrowLeft size={20} />
            </button>
          </div>
        </header>

        <main>
          {loading && <p>Chargement en cours...</p>}
          {!loading && error && <p className="doctor-error">{error}</p>}
          {!loading && !error && (
            <>
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
                  <h3>Derniers retours médecin</h3>
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
                        <td colSpan="4">Aucun retour médecin disponible.</td>
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
  )
}
