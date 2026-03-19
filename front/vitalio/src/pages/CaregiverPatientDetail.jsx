import React, { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'
import {
  BrainCircuit,
  Mail,
  MessageSquare,
  Phone,
  Stethoscope,
  PhoneCall,
} from 'lucide-react'
import {
  getLatestPatientFeedback,
  getPatientMeasurementsById,
  getPatientDoctorInfo,
} from '../services/api'

export default function CaregiverPatientDetail() {
  const { patientId } = useParams()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const base = pathname.startsWith('/family') ? '/family' : '/caregiver'
  const { getAccessTokenSilently } = useAuth0()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [measurements, setMeasurements] = useState([])
  const [feedback, setFeedback] = useState([])
  const [doctors, setDoctors] = useState([])

  useEffect(() => {
    let mounted = true
    const loadDetail = async () => {
      try {
        setLoading(true)
        setError('')
        const token = await getAccessTokenSilently()
        const [measurementsRes, feedbackRes, doctorRes] = await Promise.all([
          getPatientMeasurementsById(token, patientId, { limit: 200 }),
          getLatestPatientFeedback(token, patientId, 10),
          getPatientDoctorInfo(token, patientId),
        ])

        if (mounted) {
          setMeasurements(Array.isArray(measurementsRes.measurements) ? measurementsRes.measurements : [])
          setFeedback(Array.isArray(feedbackRes.feedback) ? feedbackRes.feedback : [])
          setDoctors(Array.isArray(doctorRes.doctors) ? doctorRes.doctors : [])
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

  const getContactLink = (doc) => {
    if (!doc) return null
    const email = doc.email || (doc.contact?.includes('@') ? doc.contact : null)
    const phone = doc.phone || (doc.contact && !doc.contact.includes('@') ? doc.contact : null)
    if (email) return `mailto:${email}?subject=Urgence - VitalIO`
    if (phone) return `tel:${String(phone).replace(/\s/g, '')}`
    return null
  }

  return (
    <div className="caregiver-dashboard family-theme">
      <div className="main-content">
        <header className="caregiver-header">
          <div className="caregiver-header-left">
            <div>
              <h1 className="caregiver-title">Mon proche</h1>
              <p className="caregiver-subtitle">Constantes vitales et informations du médecin</p>
            </div>
          </div>
          <div className="caregiver-header-actions">
            <button
              type="button"
              className="caregiver-btn-analyses"
              onClick={() => navigate(`${base}/patient/${encodeURIComponent(patientId)}/ml`)}
            >
              <BrainCircuit size={18} />
              Voir les analyses
            </button>
          </div>
        </header>

        <main className="caregiver-main">
          {loading && (
            <div className="caregiver-loading">
              <div className="caregiver-loading-spinner" />
              <p>Chargement en cours...</p>
            </div>
          )}
          {!loading && error && <p className="caregiver-error">{error}</p>}
          {!loading && !error && (
            <>
              {doctors.length > 0 && (
                <section className="caregiver-doctor-section">
                  <h3><Stethoscope size={20} /> Médecin du patient</h3>
                  <div className="caregiver-doctor-cards">
                    {doctors.map((doc) => (
                      <article key={doc.id} className="caregiver-doctor-card">
                        <div className="caregiver-doctor-header">
                          <div className="caregiver-doctor-avatar">
                            {(doc.first_name || doc.display_name || 'M').charAt(0).toUpperCase()}
                          </div>
                          <div className="caregiver-doctor-info">
                            <strong className="caregiver-doctor-name">
                              {doc.display_name || `${doc.first_name} ${doc.last_name}`.trim() || 'Médecin'}
                            </strong>
                            {(doc.email || doc.phone || doc.contact) && (
                              <div className="caregiver-doctor-contact">
                                {doc.email && (
                                  <a href={`mailto:${doc.email}`} className="caregiver-contact-link">
                                    <Mail size={14} /> {doc.email}
                                  </a>
                                )}
                                {doc.phone && (
                                  <a href={`tel:${doc.phone.replace(/\s/g, '')}`} className="caregiver-contact-link">
                                    <Phone size={14} /> {doc.phone}
                                  </a>
                                )}
                                {!doc.email && !doc.phone && doc.contact && (
                                  <span className="caregiver-contact-text">
                                    {doc.contact.includes('@') ? (
                                      <a href={`mailto:${doc.contact}`} className="caregiver-contact-link">
                                        <Mail size={14} /> {doc.contact}
                                      </a>
                                    ) : (
                                      <a href={`tel:${doc.contact.replace(/\s/g, '')}`} className="caregiver-contact-link">
                                        <Phone size={14} /> {doc.contact}
                                      </a>
                                    )}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        {getContactLink(doc) && (
                          <a
                            href={getContactLink(doc)}
                            className="caregiver-contact-emergency-btn"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <PhoneCall size={18} />
                            Contacter en cas d'urgence
                          </a>
                        )}
                      </article>
                    ))}
                  </div>
                </section>
              )}

              {feedback.length > 0 && (
                <section className="caregiver-feedback-section">
                  <h3><MessageSquare size={20} /> Commentaires du médecin</h3>
                  <div className="caregiver-feedback-list">
                    {feedback.map((item, index) => (
                      <article key={`${item.created_at || index}-${index}`} className="caregiver-feedback-card">
                        <div className="caregiver-feedback-meta">
                          <span className="caregiver-feedback-date">
                            {item.created_at ? new Date(item.created_at).toLocaleString('fr-FR') : '-'}
                          </span>
                          {item.severity && (
                            <span className={`caregiver-feedback-severity caregiver-feedback-severity--${item.severity.toLowerCase()}`}>
                              {item.severity}
                            </span>
                          )}
                        </div>
                        <p className="caregiver-feedback-message">{item.message || '-'}</p>
                      </article>
                    ))}
                  </div>
                </section>
              )}

              <section className="caregiver-patients-section">
                <div className="section-header">
                  <h3>Historique des mesures</h3>
                </div>
                <div className="caregiver-table-wrap">
                  <table className="caregiver-table">
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
                          <td>{measurement.spo2 ?? '-'}</td>
                          <td>{measurement.heart_rate ?? '-'}</td>
                          <td>{measurement.temperature ?? '-'}</td>
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
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
