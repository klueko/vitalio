import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'
import { Activity, Thermometer, HeartPulse, ShieldAlert, User, Stethoscope, Users, X, Link2, Hash, CheckCircle2, AlertCircle } from 'lucide-react'
import {
  acceptDoctorInvitation,
  getLatestPatientFeedback,
  getPatientData,
  getPatientProfile,
  redeemCabinetCode,
  updatePatientProfile,
} from '../services/api'
import PatientLayout from '../components/PatientLayout'

const formatDateLabel = (isoValue) => {
  if (!isoValue) return ''
  const date = new Date(isoValue)
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

const safeNumber = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const MiniTrendChart = ({ points }) => {
  if (!points.length) {
    return <div className="empty-chart">Pas assez de mesures pour afficher une courbe.</div>
  }

  const width = 720
  const height = 220
  const padding = 20

  const values = points.map((point) => safeNumber(point.spo2))
  const minValue = Math.min(...values) - 1
  const maxValue = Math.max(...values) + 1
  const range = Math.max(maxValue - minValue, 1)

  const toX = (index) => {
    if (points.length === 1) return width / 2
    return padding + (index / (points.length - 1)) * (width - padding * 2)
  }

  const toY = (value) => {
    const normalized = (safeNumber(value) - minValue) / range
    return height - padding - normalized * (height - padding * 2)
  }

  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${toX(index)} ${toY(point.spo2)}`)
    .join(' ')

  return (
    <div className="trend-chart">
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="Courbe SpO2">
        <path d={linePath} className="line" />
        {points.map((point, index) => (
          <circle key={`${point.timestamp}-${index}`} cx={toX(index)} cy={toY(point.spo2)} r="3.5" className="dot" />
        ))}
      </svg>
      <div className="chart-labels">
        <span>{formatDateLabel(points[0].timestamp)}</span>
        <span>{formatDateLabel(points[points.length - 1].timestamp)}</span>
      </div>
    </div>
  )
}

export default function PatientView() {
  const navigate = useNavigate()
  const { logout, user, getAccessTokenSilently } = useAuth0()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [measurements, setMeasurements] = useState([])
  const [feedback, setFeedback] = useState([])
  const [inviteToken, setInviteToken] = useState('')
  const [cabinetCode, setCabinetCode] = useState('')
  const [linkingMessage, setLinkingMessage] = useState('')
  const [linkingError, setLinkingError] = useState('')
  const [profile, setProfile] = useState(null)
  const [patientModalOpen, setPatientModalOpen] = useState(false)
  const [doctorModalOpen, setDoctorModalOpen] = useState(false)
  const [caregiverModalOpen, setCaregiverModalOpen] = useState(false)
  const [selectedDoctor, setSelectedDoctor] = useState(null)
  const [selectedCaregiver, setSelectedCaregiver] = useState(null)
  const [caregiverInviteEmail, setCaregiverInviteEmail] = useState('')
  const [caregiverInviteMessage, setCaregiverInviteMessage] = useState('')
  const [caregiverInviteError, setCaregiverInviteError] = useState('')
  const [caregiverInviteSending, setCaregiverInviteSending] = useState(false)

  useEffect(() => {
    let mounted = true

    const fetchData = async () => {
      try {
        setLoading(true)
        setError('')
        const token = await getAccessTokenSilently()
        const feedbackPromise = user?.sub
          ? getLatestPatientFeedback(token, user.sub, 5)
          : Promise.resolve({ feedback: [] })
        const [data, feedbackRes, profileRes] = await Promise.all([
          getPatientData(token),
          feedbackPromise,
          getPatientProfile(token).catch(() => ({ profile: null, doctors: [], caregivers: [] })),
        ])
        if (mounted) {
          setMeasurements(Array.isArray(data.measurements) ? data.measurements : [])
          setFeedback(Array.isArray(feedbackRes.feedback) ? feedbackRes.feedback : [])
          const profileData = profileRes?.profile ?? profileRes
          const doctors = profileRes?.doctors ?? profileData?.doctors ?? []
          const caregivers = profileRes?.caregivers ?? profileData?.caregivers ?? []
          setProfile(profileData ? { ...profileData, doctors, caregivers } : null)
        }
      } catch (fetchError) {
        if (mounted) {
          setError(fetchError.message || "Impossible de charger vos mesures")
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    fetchData()
    return () => {
      mounted = false
    }
  }, [getAccessTokenSilently, user?.sub])

  const latest = measurements[0]
  // Auth0 met souvent user.name = email quand aucun nom n'est défini ; on l'exclut du fallback
  const auth0Name = user?.name && !String(user.name).includes('@') ? user.name : null
  const profileFullName = profile?.first_name || profile?.last_name
    ? `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim()
    : null
  const displayName = profile?.display_name ?? auth0Name ?? profileFullName ?? ''

  const chartPoints = useMemo(() => {
    if (!measurements.length) return []

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    const recentByDate = measurements
      .filter((item) => {
        const ts = new Date(item.timestamp).getTime()
        return Number.isFinite(ts) && ts >= sevenDaysAgo
      })
      .slice()
      .reverse()

    if (recentByDate.length >= 2) return recentByDate
    return measurements.slice(0, 50).slice().reverse()
  }, [measurements])

  const handleDisconnect = () => {
    logout({
      logoutParams: {
        returnTo: window.location.origin,
      },
    })
    localStorage.removeItem('vitalio_user')
  }

  const refreshProfile = async () => {
    try {
      const token = await getAccessTokenSilently()
      const profileRes = await getPatientProfile(token).catch(() => ({ profile: null, doctors: [], caregivers: [] }))
      const profileData = profileRes?.profile ?? profileRes
      const doctors = profileRes?.doctors ?? profileData?.doctors ?? []
      const caregivers = profileRes?.caregivers ?? profileData?.caregivers ?? []
      setProfile(profileData ? { ...profileData, doctors, caregivers } : null)
    } catch {
      // ignore
    }
  }

  const handleAcceptInvitation = async () => {
    try {
      setLinkingError('')
      setLinkingMessage('')
      const token = await getAccessTokenSilently()
      const data = await acceptDoctorInvitation(token, inviteToken.trim())
      setLinkingMessage(`Association réussie avec le médecin ${data.doctor_user_id_auth}`)
      setInviteToken('')
      await refreshProfile()
    } catch (e) {
      setLinkingError(e.message || "Échec d'acceptation de l'invitation")
    }
  }

  const handleRedeemCabinetCode = async () => {
    try {
      setLinkingError('')
      setLinkingMessage('')
      const token = await getAccessTokenSilently()
      const data = await redeemCabinetCode(token, cabinetCode.trim())
      setLinkingMessage(`Code valide. Association réussie avec ${data.doctor_user_id_auth}`)
      setCabinetCode('')
      await refreshProfile()
    } catch (e) {
      setLinkingError(e.message || 'Échec du code cabinet')
    }
  }

  const handleInviteCaregiver = async () => {
    const email = caregiverInviteEmail.trim()
    if (!email) {
      setCaregiverInviteError("L'email de l'aidant est requis.")
      return
    }
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRe.test(email)) {
      setCaregiverInviteError("Format d'email invalide.")
      return
    }
    setCaregiverInviteError('')
    setCaregiverInviteMessage('')
    setCaregiverInviteSending(true)
    try {
      const token = await getAccessTokenSilently()
      await updatePatientProfile(token, {
        emergency_contact: {
          first_name: null,
          last_name: null,
          email,
          phone: null,
        },
      })
      setCaregiverInviteMessage("Invitation envoyée. L'aidant recevra un e-mail pour créer son compte et se lier à votre profil.")
      setCaregiverInviteEmail('')
      await refreshProfile()
    } catch (e) {
      setCaregiverInviteError(e.message || "Échec de l'envoi de l'invitation")
    } finally {
      setCaregiverInviteSending(false)
    }
  }

  return (
    <PatientLayout>
      <div className="patient-container patient-theme">
      <main className="patient-dashboard">
        <header className="patient-header">
        <h1>Bonjour {displayName}</h1>
          <p>Voici vos dernières constantes vitales.</p>
        </header>

        {loading && <div className="panel">Chargement des mesures...</div>}

        {!loading && error && (
          <div className="panel panel-error">
            <ShieldAlert size={20} />
            <span>{error}</span>
          </div>
        )}

        {!loading && !error && (
          <>
            <section className="panel patient-profile-section">
              <div className="patient-profile-cards">
                <button
                  type="button"
                  className="patient-profile-card patient-profile-card-clickable"
                  onClick={() => setPatientModalOpen(true)}
                >
                  <User size={24} />
                  <div>
                    <h3>Mon profil</h3>
                    <p>{profile?.first_name || profile?.last_name ? `${profile.first_name} ${profile.last_name}`.trim() : profile?.email || user?.email || '-'}</p>
                  </div>
                </button>
                {profile?.doctors?.length ? (
                  profile.doctors.map((d) => (
                    <button
                      key={`doctor-${d.id}`}
                      type="button"
                      className="patient-profile-card patient-profile-card-clickable"
                      onClick={() => {
                        setSelectedDoctor(d)
                        setDoctorModalOpen(true)
                      }}
                    >
                      <Stethoscope size={24} />
                      <div>
                        <h3>Mon médecin</h3>
                        <p>{[d.first_name, d.last_name].filter(Boolean).join(' ') || d.contact || '-'}</p>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="patient-profile-card">
                    <Stethoscope size={24} />
                    <div>
                      <h3>Mon médecin</h3>
                      <p className="patient-no-doctor">Aucun médecin associé. Utilisez un lien d'invitation ou un code cabinet ci-dessous.</p>
                    </div>
                  </div>
                )}
                {(() => {
                  const caregiversFromApi = profile?.caregivers ?? []
                  const ec = profile?.emergency_contact
                  const effectiveCaregivers = caregiversFromApi.length > 0
                    ? caregiversFromApi
                    : ec && (ec.first_name || ec.last_name || ec.email)
                      ? [{ id: 'ec', first_name: ec.first_name, last_name: ec.last_name, email: ec.email, phone: ec.phone, contact: ec.email }]
                      : []
                  return effectiveCaregivers.map((c) => (
                    <button
                      key={`caregiver-${c.id}`}
                      type="button"
                      className="patient-profile-card patient-profile-card-clickable"
                      onClick={() => {
                        setSelectedCaregiver(c)
                        setCaregiverModalOpen(true)
                      }}
                    >
                      <Users size={24} />
                      <div>
                        <h3>Mon aidant</h3>
                        <p>{[c.first_name, c.last_name].filter(Boolean).join(' ') || c.contact || c.email || '-'}</p>
                      </div>
                    </button>
                  ))
                })()}
              </div>

              {patientModalOpen && (
                <div className="profile-modal-overlay" onClick={() => setPatientModalOpen(false)} role="dialog" aria-modal="true" aria-label="Informations personnelles">
                  <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="profile-modal-header">
                      <h2>Mes informations personnelles</h2>
                      <button type="button" className="profile-modal-close" onClick={() => setPatientModalOpen(false)} aria-label="Fermer">
                        <X size={24} />
                      </button>
                    </div>
                    <div className="profile-modal-body">
                      <div className="profile-modal-row">
                        <span className="profile-modal-label">Email</span>
                        <span className="profile-modal-value">{profile?.email || user?.email || '-'}</span>
                      </div>
                      <div className="profile-modal-row">
                        <span className="profile-modal-label">Prénom</span>
                        <span className="profile-modal-value">{profile?.first_name || '-'}</span>
                      </div>
                      <div className="profile-modal-row">
                        <span className="profile-modal-label">Nom</span>
                        <span className="profile-modal-value">{profile?.last_name || '-'}</span>
                      </div>
                      <div className="profile-modal-row">
                        <span className="profile-modal-label">Âge</span>
                        <span className="profile-modal-value">{profile?.age != null ? profile.age : '-'}</span>
                      </div>
                      <div className="profile-modal-row">
                        <span className="profile-modal-label">Sexe</span>
                        <span className="profile-modal-value">
                          {profile?.sex === 'f' || profile?.sex === 'femme' ? 'Femme' : profile?.sex === 'm' || profile?.sex === 'homme' ? 'Homme' : profile?.sex === 'autre' ? 'Autre' : profile?.sex || '-'}
                        </span>
                      </div>
                      {profile?.medical_history && (
                        <div className="profile-modal-row profile-modal-row--block">
                          <span className="profile-modal-label">Historique médical</span>
                          <span className="profile-modal-value">{profile.medical_history}</span>
                        </div>
                      )}
                      {profile?.emergency_contact && (
                        <div className="profile-modal-row">
                          <span className="profile-modal-label">Aidant</span>
                          <span className="profile-modal-value">
                            {[profile.emergency_contact.first_name, profile.emergency_contact.last_name].filter(Boolean).join(' ') || profile.emergency_contact.email || '-'}
                            {profile.emergency_contact.email && (
                              <><br /><small>{profile.emergency_contact.email}</small></>
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {doctorModalOpen && selectedDoctor && (
                <div className="profile-modal-overlay" onClick={() => { setDoctorModalOpen(false); setSelectedDoctor(null) }} role="dialog" aria-modal="true" aria-label="Informations médecin">
                  <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="profile-modal-header">
                      <h2>Mon médecin</h2>
                      <button type="button" className="profile-modal-close" onClick={() => { setDoctorModalOpen(false); setSelectedDoctor(null) }} aria-label="Fermer">
                        <X size={24} />
                      </button>
                    </div>
                    <div className="profile-modal-body">
                      <div className="profile-modal-row">
                        <span className="profile-modal-label">Prénom</span>
                        <span className="profile-modal-value">{selectedDoctor.first_name || '-'}</span>
                      </div>
                      <div className="profile-modal-row">
                        <span className="profile-modal-label">Nom</span>
                        <span className="profile-modal-value">{selectedDoctor.last_name || '-'}</span>
                      </div>
                      <div className="profile-modal-row">
                        <span className="profile-modal-label">Contact</span>
                        <span className="profile-modal-value">{selectedDoctor.contact || '-'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {caregiverModalOpen && selectedCaregiver && (
                <div className="profile-modal-overlay" onClick={() => { setCaregiverModalOpen(false); setSelectedCaregiver(null) }} role="dialog" aria-modal="true" aria-label="Informations aidant">
                  <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="profile-modal-header">
                      <h2>Mon aidant</h2>
                      <button type="button" className="profile-modal-close" onClick={() => { setCaregiverModalOpen(false); setSelectedCaregiver(null) }} aria-label="Fermer">
                        <X size={24} />
                      </button>
                    </div>
                    <div className="profile-modal-body">
                      <div className="profile-modal-row">
                        <span className="profile-modal-label">Prénom</span>
                        <span className="profile-modal-value">{selectedCaregiver.first_name || '-'}</span>
                      </div>
                      <div className="profile-modal-row">
                        <span className="profile-modal-label">Nom</span>
                        <span className="profile-modal-value">{selectedCaregiver.last_name || '-'}</span>
                      </div>
                      <div className="profile-modal-row">
                        <span className="profile-modal-label">Email</span>
                        <span className="profile-modal-value">{selectedCaregiver.email || '-'}</span>
                      </div>
                      <div className="profile-modal-row">
                        <span className="profile-modal-label">Téléphone</span>
                        <span className="profile-modal-value">{selectedCaregiver.phone || selectedCaregiver.contact || '-'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section className="vital-cards">
              <article className="card">
                <span className="label">SpO₂</span>
                <div className="value-row">
                  <Activity size={18} />
                  <strong>{safeNumber(latest?.spo2, 0).toFixed(0)}%</strong>
                </div>
              </article>
              <article className="card">
                <span className="label">FC</span>
                <div className="value-row">
                  <HeartPulse size={18} />
                  <strong>{safeNumber(latest?.heart_rate, 0).toFixed(0)} bpm</strong>
                </div>
              </article>
              <article className="card">
                <span className="label">Température</span>
                <div className="value-row">
                  <Thermometer size={18} />
                  <strong>{safeNumber(latest?.temperature, 0).toFixed(1)} C</strong>
                </div>
              </article>
            </section>

            <section className="panel">
              <div className="panel-title">
                <h2>Tendance SpO₂</h2>
                <span>{chartPoints.length} mesures</span>
              </div>
              <MiniTrendChart points={chartPoints} />
            </section>

            <section className="panel panel-cta">
              <div>
                <h2>Prise de mesure</h2>
                <p>Lancez un parcours guidé en 3 étapes pour envoyer une nouvelle mesure.</p>
              </div>
              <button onClick={() => navigate('/patient/measure')} className="primary-button">
                Démarrer
              </button>
            </section>

            {!profile?.doctors?.length && (
            <section className="panel">
              <div className="panel-title">
                <h2>Associer mon médecin</h2>
              </div>
              <p className="link-doctor-subtitle">
                Deux façons de vous connecter à votre médecin :
              </p>
              <div className="link-doctor-grid">
                <div className="link-doctor-card">
                  <div className="link-doctor-card-header">
                    <span className="link-doctor-icon link-doctor-icon--invite">
                      <Link2 size={18} />
                    </span>
                    <div>
                      <h3>Lien d'invitation</h3>
                      <p>Votre médecin vous a envoyé un token par e-mail.</p>
                    </div>
                  </div>
                  <div className="link-doctor-input-row">
                    <input
                      type="text"
                      className="link-doctor-input"
                      value={inviteToken}
                      onChange={(e) => setInviteToken(e.target.value)}
                      placeholder="Coller le token ici…"
                    />
                    <button
                      className="link-doctor-btn link-doctor-btn--invite"
                      onClick={handleAcceptInvitation}
                      disabled={!inviteToken.trim()}
                    >
                      Accepter
                    </button>
                  </div>
                </div>

                <div className="link-doctor-divider">
                  <span>ou</span>
                </div>

                <div className="link-doctor-card">
                  <div className="link-doctor-card-header">
                    <span className="link-doctor-icon link-doctor-icon--cabinet">
                      <Hash size={18} />
                    </span>
                    <div>
                      <h3>Code cabinet</h3>
                      <p>Code temporaire affiché chez votre médecin.</p>
                    </div>
                  </div>
                  <div className="link-doctor-input-row">
                    <input
                      type="text"
                      className="link-doctor-input"
                      value={cabinetCode}
                      onChange={(e) => setCabinetCode(e.target.value)}
                      placeholder="Code à 6 caractères…"
                    />
                    <button
                      className="link-doctor-btn link-doctor-btn--cabinet"
                      onClick={handleRedeemCabinetCode}
                      disabled={!cabinetCode.trim()}
                    >
                      Valider
                    </button>
                  </div>
                </div>
              </div>

              {linkingError && (
                <div className="link-doctor-feedback link-doctor-feedback--error">
                  <AlertCircle size={16} />
                  <span>{linkingError}</span>
                </div>
              )}
              {linkingMessage && (
                <div className="link-doctor-feedback link-doctor-feedback--success">
                  <CheckCircle2 size={16} />
                  <span>{linkingMessage}</span>
                </div>
              )}
            </section>
            )}

            {!profile?.caregivers?.length && !(profile?.emergency_contact && (profile.emergency_contact.first_name || profile.emergency_contact.last_name || profile.emergency_contact.email)) && (
            <section className="panel">
              <div className="panel-title">
                <h2>Inviter un aidant</h2>
              </div>
              <p className="link-doctor-subtitle">
                Envoyez une invitation par e-mail à une personne de confiance pour qu'elle puisse suivre vos constantes vitales.
              </p>
              <div className="link-doctor-grid">
                <div className="link-doctor-card link-doctor-card--full">
                  <div className="link-doctor-card-header">
                    <span className="link-doctor-icon link-doctor-icon--caregiver">
                      <Users size={18} />
                    </span>
                    <div>
                      <h3>Invitation par e-mail</h3>
                      <p>Indiquez l'adresse e-mail de votre aidant. Il recevra un lien pour créer son compte et se lier à votre profil.</p>
                    </div>
                  </div>
                  <div className="link-caregiver-form">
                    <div className="link-doctor-input-row">
                      <input
                        type="email"
                        className="link-doctor-input"
                        value={caregiverInviteEmail}
                        onChange={(e) => setCaregiverInviteEmail(e.target.value)}
                        placeholder="E-mail de l'aidant"
                        disabled={caregiverInviteSending}
                      />
                      <button
                        className="link-doctor-btn link-doctor-btn--caregiver"
                        onClick={handleInviteCaregiver}
                        disabled={caregiverInviteSending || !caregiverInviteEmail.trim()}
                      >
                        {caregiverInviteSending ? 'Envoi…' : 'Envoyer'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              {caregiverInviteError && (
                <div className="link-doctor-feedback link-doctor-feedback--error">
                  <AlertCircle size={16} />
                  <span>{caregiverInviteError}</span>
                </div>
              )}
              {caregiverInviteMessage && (
                <div className="link-doctor-feedback link-doctor-feedback--success">
                  <CheckCircle2 size={16} />
                  <span>{caregiverInviteMessage}</span>
                </div>
              )}
            </section>
            )}

            <section className="panel">
              <div className="panel-title">
                <h2>Derniers retours du médecin</h2>
                <span>{feedback.length} retour(s)</span>
              </div>
              <div className="patient-feedback-table-wrap">
                <table className="patient-feedback-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Sévérité</th>
                      <th>Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {feedback.map((item, index) => {
                      const severityLabels = { low: 'Faible', medium: 'Moyenne', high: 'Haute' }
                      const severityKey = (item.severity || 'medium').toLowerCase()
                      const severityLabel = severityLabels[severityKey] || severityLabels.medium
                      const severityClass = severityKey === 'high' ? 'feedback-severity--high' : severityKey === 'low' ? 'feedback-severity--low' : 'feedback-severity--medium'
                      return (
                        <tr key={`${item.created_at || index}-${index}`}>
                          <td>{item.created_at ? new Date(item.created_at).toLocaleString('fr-FR') : '-'}</td>
                          <td>
                            <span className={`feedback-severity-badge ${severityClass}`}>{severityLabel}</span>
                          </td>
                          <td>{item.message || '-'}</td>
                        </tr>
                      )
                    })}
                    {!feedback.length && (
                      <tr>
                        <td colSpan="4">Aucun retour médecin pour le moment.</td>
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
    </PatientLayout>
  )
}
