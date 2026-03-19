import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'
import { ClipboardList, User, Heart, AlertCircle, Send, CheckCircle } from 'lucide-react'
import { completeOnboarding, updatePatientProfile } from '../services/api'

const SEX_OPTIONS = [
  { value: 'F', label: 'Féminin' },
  { value: 'M', label: 'Masculin' },
  { value: 'O', label: 'Autre' },
]

export default function PatientOnboarding() {
  const navigate = useNavigate()
  const { getAccessTokenSilently } = useAuth0()
  const [submitting, setSubmitting] = useState(false)
  const [sendingInvite, setSendingInvite] = useState(false)
  const [inviteSent, setInviteSent] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    given_name: '',
    family_name: '',
    email: '',
    phone_number: '',
    birthdate: '',
    sex: '',
    aidant_first_name: '',
    aidant_last_name: '',
    aidant_email: '',
    aidant_phone: '',
    medical_history: '',
  })

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setError('')
  }

  const handleSendInvitation = async () => {
    const email = (form.aidant_email || '').trim()
    if (!email) {
      setError('Veuillez renseigner l\'email de l\'aidant avant d\'envoyer l\'invitation.')
      return
    }
    setError('')
    setSendingInvite(true)
    try {
      const token = await getAccessTokenSilently()
      await updatePatientProfile(token, {
        emergency_contact: {
          first_name: form.aidant_first_name.trim() || null,
          last_name: form.aidant_last_name.trim() || null,
          email,
          phone: form.aidant_phone.trim() || null,
        },
      })
      setInviteSent(true)
    } catch (err) {
      setError(err.message || 'Erreur lors de l\'envoi de l\'invitation.')
    } finally {
      setSendingInvite(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    const givenName = (form.given_name || '').trim()
    const familyName = (form.family_name || '').trim()
    if (!givenName || !familyName) {
      setError('Le prénom et le nom sont requis.')
      return
    }
    if (!form.sex) {
      setError('Veuillez sélectionner votre sexe.')
      return
    }
    const birthdate = (form.birthdate || '').trim()
    if (!birthdate) {
      setError('La date de naissance est requise.')
      return
    }
    const patientEmail = (form.email || '').trim()
    if (!patientEmail) {
      setError('Votre email est requis.')
      return
    }
    const email = (form.aidant_email || '').trim()
    if (!email) {
      setError('L\'email de l\'aidant est requis.')
      return
    }
    const history = (form.medical_history || '').trim()
    if (!history) {
      setError('L\'historique médical est requis.')
      return
    }

    setSubmitting(true)
    try {
      const token = await getAccessTokenSilently()
      await completeOnboarding(token, {
        first_name: givenName,
        last_name: familyName,
        email: patientEmail,
        phone: form.phone_number.trim() || null,
        birthdate,
        sex: form.sex,
        emergency_contact: {
          first_name: form.aidant_first_name.trim() || null,
          last_name: form.aidant_last_name.trim() || null,
          email,
          phone: form.aidant_phone.trim() || null,
        },
        medical_history: history,
      })
      navigate('/patient', { replace: true })
    } catch (err) {
      setError(err.message || 'Erreur lors de l\'enregistrement.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="patient-onboarding">
      <div className="patient-onboarding-container">
        <header className="patient-onboarding-header">
          <ClipboardList size={32} />
          <h1>Onboarding médical</h1>
          <p>Complétez ces informations pour activer votre suivi VitalIO.</p>
        </header>

        <form onSubmit={handleSubmit} className="patient-onboarding-form">
          {error && (
            <div className="patient-onboarding-error">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <section className="patient-onboarding-section">
            <h2><User size={20} /> Vos informations</h2>
            <div className="patient-onboarding-grid">
              <div className="patient-onboarding-row">
                <label htmlFor="given_name">Prénom *</label>
                <input
                  id="given_name"
                  type="text"
                  value={form.given_name}
                  onChange={(e) => handleChange('given_name', e.target.value)}
                  placeholder="Prénom"
                  required
                />
              </div>
              <div className="patient-onboarding-row">
                <label htmlFor="family_name">Nom *</label>
                <input
                  id="family_name"
                  type="text"
                  value={form.family_name}
                  onChange={(e) => handleChange('family_name', e.target.value)}
                  placeholder="Nom"
                  required
                />
              </div>
            </div>
            <div className="patient-onboarding-row">
              <label htmlFor="email">Votre email *</label>
              <input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="email@exemple.fr"
                required
              />
            </div>
            <div className="patient-onboarding-row">
              <label htmlFor="phone_number">Téléphone</label>
              <input
                id="phone_number"
                type="text"
                value={form.phone_number}
                onChange={(e) => handleChange('phone_number', e.target.value)}
                placeholder="+33 6 00 00 00 00"
              />
            </div>
            <div className="patient-onboarding-row">
              <label htmlFor="birthdate">Date de naissance *</label>
              <input
                id="birthdate"
                type="text"
                value={form.birthdate}
                onChange={(e) => handleChange('birthdate', e.target.value)}
                placeholder="Date de naissance (AAAA-MM-JJ)"
              />
            </div>
            <div className="patient-onboarding-row">
              <label htmlFor="sex">Sexe *</label>
              <select
                id="sex"
                value={form.sex}
                onChange={(e) => handleChange('sex', e.target.value)}
                required
              >
                <option value="">- Sélectionner -</option>
                {SEX_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </section>

          <section className="patient-onboarding-section">
            <h2><Heart size={20} /> Aidant (contact d'urgence)</h2>
            <p className="patient-onboarding-hint">
              Renseignez l'email de votre aidant pour qu'il puisse suivre vos constantes. 
              Une invitation lui sera envoyée pour créer son compte VitalIO.
            </p>
            <div className="patient-onboarding-grid">
              <div className="patient-onboarding-row">
                <label htmlFor="aidant_first_name">Prénom</label>
                <input
                  id="aidant_first_name"
                  type="text"
                  value={form.aidant_first_name}
                  onChange={(e) => handleChange('aidant_first_name', e.target.value)}
                  placeholder="Prénom de l'aidant"
                />
              </div>
              <div className="patient-onboarding-row">
                <label htmlFor="aidant_last_name">Nom</label>
                <input
                  id="aidant_last_name"
                  type="text"
                  value={form.aidant_last_name}
                  onChange={(e) => handleChange('aidant_last_name', e.target.value)}
                  placeholder="Nom de l'aidant"
                />
              </div>
            </div>
            <div className="patient-onboarding-row">
              <label htmlFor="aidant_email">Email de l'aidant *</label>
              <input
                id="aidant_email"
                type="email"
                value={form.aidant_email}
                onChange={(e) => handleChange('aidant_email', e.target.value)}
                placeholder="email@exemple.fr"
                required
              />
            </div>
            <div className="patient-onboarding-row patient-onboarding-invite-row">
              <button
                type="button"
                className="patient-onboarding-invite-btn"
                onClick={handleSendInvitation}
                disabled={sendingInvite || !form.aidant_email?.trim()}
              >
                {sendingInvite ? (
                  'Envoi en cours...'
                ) : inviteSent ? (
                  <>
                    <CheckCircle size={18} />
                    Invitation envoyée
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    Envoyer une invitation
                  </>
                )}
              </button>
              {inviteSent && (
                <p className="patient-onboarding-invite-success">
                  Un email d'invitation a été envoyé à votre aidant.
                </p>
              )}
            </div>
            <div className="patient-onboarding-row">
              <label htmlFor="aidant_phone">Téléphone</label>
              <input
                id="aidant_phone"
                type="tel"
                value={form.aidant_phone}
                onChange={(e) => handleChange('aidant_phone', e.target.value)}
                placeholder="06 12 34 56 78"
              />
            </div>
          </section>

          <section className="patient-onboarding-section">
            <h2><ClipboardList size={20} /> Historique médical</h2>
            <div className="patient-onboarding-row">
              <label htmlFor="medical_history">Antécédents, pathologies, traitements en cours *</label>
              <textarea
                id="medical_history"
                value={form.medical_history}
                onChange={(e) => handleChange('medical_history', e.target.value)}
                placeholder="Décrivez votre historique médical : maladies chroniques, allergies, médicaments, interventions..."
                rows={5}
                required
              />
            </div>
          </section>

          <div className="patient-onboarding-actions">
            <button type="submit" className="primary-button" disabled={submitting}>
              {submitting ? 'Enregistrement...' : 'Valider et continuer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
