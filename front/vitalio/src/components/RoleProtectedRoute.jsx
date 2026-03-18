import React, { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'

function normalizeRole(role) {
  const value = String(role || '').toLowerCase()
  if (value === 'superuser') return 'doctor'
  if (value === 'medecin') return 'doctor'
  if (value === 'médecin') return 'doctor'
  if (value === 'aidant') return 'caregiver'
  if (value === 'family') return 'caregiver'
  if (value === 'user') return 'patient'
  return value
}

function pickRole(candidate) {
  if (Array.isArray(candidate)) {
    for (const role of candidate) {
      const normalized = normalizeRole(role)
      if (normalized) return normalized
    }
    return ''
  }
  return normalizeRole(candidate)
}

export default function RoleProtectedRoute({ children, allowedRoles = [] }) {
  const { user, isLoading, getAccessTokenSilently } = useAuth0()
  const [fetchingRole, setFetchingRole] = useState(false)
  const [fetchedRole, setFetchedRole] = useState(null)
  const [fetchAttempted, setFetchAttempted] = useState(false)

  const storedSession = (() => {
    try {
      return JSON.parse(localStorage.getItem('vitalio_user') || '{}')
    } catch {
      return {}
    }
  })()
  const storedSessionValid = storedSession?.email && storedSession.email === user?.email

  
  
  let userRole =
    (fetchedRole ? pickRole(fetchedRole) : null) ||
    (storedSessionValid ? pickRole(storedSession?.role) : null) ||
    pickRole(user?.['https://vitalio.app/role']) ||
    pickRole(user?.['https://vitalio.app/roles']) ||
    pickRole(user?.app_metadata?.role) ||
    pickRole(user?.app_metadata?.roles) ||
    pickRole(user?.app_metadata?.authorization?.roles) ||
    pickRole(user?.user_metadata?.role) ||
    pickRole(user?.user_metadata?.roles) ||
    pickRole(user?.role) ||
    pickRole(user?.roles)

  const normalizedAllowedRoles = allowedRoles.map(normalizeRole)
  const hasAccess = normalizedAllowedRoles.includes(userRole)

  useEffect(() => {
    if (hasAccess || isLoading || !user?.sub || fetchingRole) return
    setFetchingRole(true)
    let cancelled = false
    getAccessTokenSilently()
      .then((token) =>
        fetch(`${import.meta.env.VITE_API_URL}/api/me/role`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      )
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.role) return
        const roleForAccess = normalizeRole(data.role)
        setFetchedRole(roleForAccess)
        try {
          const current = JSON.parse(localStorage.getItem('vitalio_user') || '{}')
          localStorage.setItem('vitalio_user', JSON.stringify({ ...current, role: data.role }))
        } catch {}
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) {
          setFetchingRole(false)
          setFetchAttempted(true)
        }
      })
    return () => { cancelled = true }
  }, [hasAccess, isLoading, user?.sub])

  const waitingForRoleCheck = !hasAccess && user?.sub && !fetchAttempted
  if (isLoading || (fetchingRole && !hasAccess) || waitingForRoleCheck) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        Chargement...
      </div>
    )
  }

  if (!hasAccess) {
    return <Navigate to="/home" replace />
  }

  return children
}
