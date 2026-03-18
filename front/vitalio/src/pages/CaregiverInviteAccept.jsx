import React, { useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'
import { LogIn, CheckCircle, AlertCircle, Heart } from 'lucide-react'
import { acceptCaregiverInvitation } from '../services/api'

export default function CaregiverInviteAccept() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { isAuthenticated, isLoading, loginWithRedirect, getAccessTokenSilently, user } = useAuth0()
  const token = searchParams.get('token')?.trim() || ''

  const [accepting, setAccepting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = () => {
    loginWithRedirect({
      appState: { returnTo: `/invite-caregiver?token=${encodeURIComponent(token)}` },
      authorizationParams: { screen_hint: 'login' },
    })
  }

  const handleSignup = () => {
    loginWithRedirect({
      appState: { returnTo: `/invite-caregiver?token=${encodeURIComponent(token)}` },
      authorizationParams: { screen_hint: 'signup' },
    })
  }

  const handleAccept = async () => {
    if (!token) return
    try {
      setError('')
      setAccepting(true)
      const accessToken = await getAccessTokenSilently()
      await acceptCaregiverInvitation(accessToken, token)
      setSuccess(true)
      if (user) {
        localStorage.setItem('vitalio_user', JSON.stringify({
          email: user.email,
          name: user.name || user.email,
          role: 'caregiver',
          picture: user.picture,
        }))
      }
      setTimeout(() => navigate('/caregiver'), 2500)
    } catch (e) {
      setError(e.message || "Échec d'acceptation de l'invitation")
    } finally {
      setAccepting(false)
    }
  }

  if (!token) {
    return (
      <div className="login-container">
        <div className="login-card animate-fade-in">
          <AlertCircle size={48} style={{ color: '#dc2626', marginBottom: '16px' }} />
          <h2>Lien invalide</h2>
          <p>Cette invitation ne contient pas de token valide.</p>
          <button onClick={() => navigate('/')} className="login-button">
            Retour à l'accueil
          </button>
        </div>
      </div>
    )
  }

  if (!isAuthenticated && !isLoading) {
    return (
      <div className="login-container">
        <div className="login-card animate-fade-in">
          <Heart size={48} style={{ color: '#2563eb', marginBottom: '16px' }} />
          <h2>Invitation Aidant VitalIO</h2>
          <p>Un proche vous a désigné(e) comme contact d'urgence. Créez un compte ou connectez-vous pour accéder à ses données de santé.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button onClick={handleSignup} className="login-button">
              <LogIn size={20} />
              <span>Créer mon compte aidant</span>
            </button>
            <button onClick={handleLogin} className="login-button" style={{ background: 'transparent', color: 'var(--color-primary, #2563eb)' }}>
              <span>Déjà un compte ? Se connecter</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="login-container">
        <div className="login-card">
          <p>Chargement...</p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="login-container">
        <div className="login-card animate-fade-in">
          <CheckCircle size={48} style={{ color: '#16a34a', marginBottom: '16px' }} />
          <h2>Invitation acceptée</h2>
          <p>Vous êtes maintenant aidant de votre proche. Redirection vers votre tableau de bord...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="login-container">
      <div className="login-card animate-fade-in">
        <Heart size={48} style={{ color: '#2563eb', marginBottom: '16px' }} />
        <h2>Accepter l'invitation aidant</h2>
        <p>Un proche vous a désigné(e) comme contact d'urgence sur VitalIO. Acceptez pour consulter ses constantes vitales.</p>
        {error && (
          <div className="login-error" style={{ marginBottom: '16px' }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}
        <button
          onClick={handleAccept}
          disabled={accepting}
          className="login-button"
        >
          {accepting ? 'Acceptation en cours...' : "Accepter l'invitation"}
        </button>
      </div>
    </div>
  )
}
