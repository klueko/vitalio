import React, { useEffect, useState } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import { User, Stethoscope, Users, X, Link2, Hash, CheckCircle2, AlertCircle } from 'lucide-react'
import {
  acceptDoctorInvitation,
  getPatientProfile,
  redeemCabinetCode,
  updatePatientProfile,
} from '../services/api'
import PatientLayout from '../components/PatientLayout'

export default function PatientProfileView() {
  const { user, getAccessTokenSilently } = useAuth0()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [profile, setProfile] = useState(null)
  const [inviteToken, setInviteToken] = useState('')
  const [cabinetCode, setCabinetCode] = useState('')
  const [linkingMessage, setLinkingMessage] = useState('')
  const [linkingError, setLinkingError] = useState('')
  const [patientModalOpen, setPatientModalOpen] = useState(false)
  const [doctorModalOpen, setDoctorModalOpen] = useState(false)
  const [caregiverModalOpen, setCaregiverModalOpen] = useState(false)
  const [selectedDoctor, setSelectedDoctor] = useState(null)
  const [selectedCaregiver, setSelectedCaregiver] = useState(null)
  const [caregiverInviteEmail, setCaregiverInviteEmail] = useState('')
  const [caregiverInviteMessage, setCaregiverInviteMessage] = useState('')
  const [caregiverInviteError, setCaregiverInviteError] = useState('')
  const [caregiverInviteSending, setCaregiverInviteSending] = useState(false)

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

  useEffect(() => {
    let mounted = true
    const fetchData = async () => {
      try {
        setLoading(true)
        setError('')
        const token = await getAccessTokenSilently()
        const profileRes = await getPatientProfile(token).catch(() => ({ profile: null, doctors: [], caregivers: [] }))
        const profileData = profileRes?.profile ?? profileRes
        const doctors = profileRes?.doctors ?? profileData?.doctors ?? []
        const caregivers = profileRes?.caregivers ?? profileData?.caregivers ?? []
        if (mounted) {
          setProfile(profileData ? { ...profileData, doctors, caregivers } : null)
        }
      } catch (fetchError) {
        if (mounted) {
          setError(fetchError.message || "Impossible de charger votre profil")
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }
    fetchData()
    return () => { mounted = false }
  }, [getAccessTokenSilently])

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

  const effectiveCaregivers = profile?.caregivers?.length > 0
    ? profile.caregivers
    : profile?.emergency_contact && (profile.emergency_contact.first_name || profile.emergency_contact.last_name || profile.emergency_contact.email)
      ? [{ id: 'ec', first_name: profile.emergency_contact.first_name, last_name: profile.emergency_contact.last_name, email: profile.emergency_contact.email, phone: profile.emergency_contact.phone, contact: profile.emergency_contact.email }]
      : []

  return (
    <PatientLayout>
      <div className="patient-container patient-theme">
        <main className="patient-dashboard patient-profile-page">
          <header className="patient-header">
            <h1>Mon profil</h1>
            <p>Vos informations personnelles, votre médecin et votre aidant.</p>
          </header>

          {loading && <div className="panel">Chargement du profil...</div>}

          {!loading && error && (
            <div className="panel panel-error">
              <AlertCircle size={20} />
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
                  {effectiveCaregivers.map((c) => (
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
                  ))}
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
            </>
          )}
        </main>
      </div>
    </PatientLayout>
  )
}
